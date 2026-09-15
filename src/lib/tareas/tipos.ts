/**
 * Programar: encargarle algo a ECLIPSE para que lo haga solo, cada día o cada
 * semana, sin que haya que acordarse de pedirlo.
 *
 * La diferencia con el chat no es técnica, es de uso: en el chat tú preguntas y
 * él contesta; aquí le dejas dicho una vez qué quieres saber y te lo encuentras
 * hecho. "Cada jueves, planes para el finde". "Cada mañana, cómo van los
 * pedidos de la tienda". "Cada lunes, qué tengo pendiente en Notion".
 *
 * Por qué el día y no la hora exacta: el reloj que dispara esto corre una vez
 * al día en el servidor, así que lo honesto es prometer el día y no la hora. Se
 * dice en la propia pantalla, y además la aplicación pone al día lo que le
 * tocaba cuando la abres, así que nada se queda sin hacer por un reloj que no
 * llegó a sonar.
 */

/** Cuándo toca. Nombres de la vida real, no expresiones de cron. */
export type Cuando =
  | { tipo: "diario" }
  | { tipo: "laborables" }
  | { tipo: "semanal"; dia: number }
  /**
   * Un día del mes. Hasta el 28 y no hasta el 31 a propósito: "cada día 30" se
   * salta febrero todos los años y quien lo puso no se entera nunca.
   */
  | { tipo: "mensual"; dia: number }
  /**
   * Un día concreto y ya. Es lo que hace que esto sea un calendario y no solo
   * una lista de costumbres: "el 3, prepárame lo del viaje".
   */
  | { tipo: "unavez"; fecha: string };

/** Los días, como se dicen. El 0 es domingo, como en JavaScript. */
export const DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

export interface Tarea {
  id: string;
  /** Cómo se llama en la lista. Corto. */
  titulo: string;
  /** Lo que se le pide de verdad, con sus palabras. */
  instruccion: string;
  cuando: Cuando;
  activa: boolean;
  creada: number;
  /** Cuándo se hizo por última vez, para no repetirla el mismo día. */
  ultima?: number;
  /** Si la última salió mal, qué pasó. */
  ultimoFallo?: string;
  /**
   * Cuántas veces ha fallado hoy.
   *
   * Existe para no tener que elegir entre dos cosas malas. Si un fallo marca la
   * tarea como hecha, un corte de red de diez segundos te deja sin el parte del
   * día entero. Si no la marca, una tarea que falla siempre se reintenta sin
   * parar y se come el cupo del motor. Así: se reintenta una vez, y a la
   * segunda se deja para mañana.
   */
  fallos?: number;
}

export interface Resultado {
  id: string;
  tareaId: string;
  titulo: string;
  texto: string;
  hecha: number;
  /** Sin leer todavía: es lo que enciende el punto en el menú. */
  nueva: boolean;
}

/** Cuánto se guarda de cada tarea. Más que esto es acumular por acumular. */
export const MAX_RESULTADOS = 20;
/** Y cuántas tareas puede tener una persona. */
export const MAX_TAREAS = 12;

/** El día de un momento, como se escribe: 2026-09-15. */
export function fechaDe(momento: Date): string {
  return momento.toISOString().slice(0, 10);
}

/**
 * ¿Este encargo cae ESE día exacto?
 *
 * Es la pregunta del calendario, que no es la misma que la de ejecutarlo: aquí
 * un encargo de un día concreto sale solo en su día, para poder pintar el mes
 * sin que un encargo del martes pasado manche todos los días siguientes.
 */
export function caeEn(cuando: Cuando, dia: Date): boolean {
  const semana = dia.getUTCDay();
  if (cuando.tipo === "diario") return true;
  if (cuando.tipo === "laborables") return semana >= 1 && semana <= 5;
  if (cuando.tipo === "semanal") return semana === cuando.dia;
  if (cuando.tipo === "mensual") return dia.getUTCDate() === cuando.dia;
  return cuando.fecha === fechaDe(dia);
}

/**
 * ¿Le toca hoy a esta tarea?
 *
 * Igual que `caeEn`, con una diferencia que importa: un encargo de un día
 * concreto que no llegó a hacerse —porque el reloj no sonó, o porque nadie
 * abrió la aplicación aquel día— sigue tocando después. Lo contrario es
 * perderlo en silencio, que es justo lo que no puede pasar con algo que te
 * dejaste dicho para un día.
 */
export function tocaHoy(cuando: Cuando, ahora: Date): boolean {
  if (cuando.tipo === "unavez") return cuando.fecha <= fechaDe(ahora);
  return caeEn(cuando, ahora);
}

/** ¿Ya se hizo hoy? Se compara el día, no las horas. */
export function yaHechaHoy(ultima: number | undefined, ahora: Date): boolean {
  if (!ultima) return false;
  const antes = new Date(ultima);
  return (
    antes.getUTCFullYear() === ahora.getUTCFullYear() &&
    antes.getUTCMonth() === ahora.getUTCMonth() &&
    antes.getUTCDate() === ahora.getUTCDate()
  );
}

/** Las que hay que hacer ahora mismo. */
export function pendientes(tareas: Tarea[], ahora: Date): Tarea[] {
  return tareas.filter(
    (t) => t.activa && tocaHoy(t.cuando, ahora) && !yaHechaHoy(t.ultima, ahora),
  );
}

/** Cómo se lee un "cuándo" en la pantalla. */
export function textoDe(cuando: Cuando): string {
  if (cuando.tipo === "diario") return "Cada día";
  if (cuando.tipo === "laborables") return "De lunes a viernes";
  if (cuando.tipo === "mensual") return `Cada día ${cuando.dia} del mes`;
  if (cuando.tipo === "unavez") {
    const [ano, mes, dia] = cuando.fecha.split("-");
    return `El ${Number(dia)} de ${MESES[Number(mes) - 1] ?? mes} de ${ano}`;
  }
  return `Cada ${DIAS[cuando.dia] ?? "semana"}`;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/** Un día del calendario, con lo que le toca. */
export interface DiaDelPlan {
  fecha: string;
  /** 0 domingo, como en JavaScript. */
  semana: number;
  tareas: Tarea[];
}

/**
 * Los próximos días, con lo que cae en cada uno.
 *
 * Esto es lo que convierte una lista de encargos en un calendario. Se calcula
 * aquí, aparte y sin nada alrededor, porque es la cuenta que decide lo que ve
 * la gente y tiene que poder comprobarse sola.
 */
export function proximosDias(tareas: Tarea[], desde: Date, cuantos = 14): DiaDelPlan[] {
  const dias: DiaDelPlan[] = [];
  for (let i = 0; i < cuantos; i++) {
    const dia = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate() + i));
    dias.push({
      fecha: fechaDe(dia),
      semana: dia.getUTCDay(),
      tareas: tareas.filter((t) => t.activa && caeEn(t.cuando, dia)),
    });
  }
  return dias;
}
