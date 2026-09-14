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
  | { tipo: "semanal"; dia: number };

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

/** ¿Le toca hoy a esta tarea? */
export function tocaHoy(cuando: Cuando, ahora: Date): boolean {
  const dia = ahora.getUTCDay();
  if (cuando.tipo === "diario") return true;
  if (cuando.tipo === "laborables") return dia >= 1 && dia <= 5;
  return dia === cuando.dia;
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
  return `Cada ${DIAS[cuando.dia] ?? "semana"}`;
}
