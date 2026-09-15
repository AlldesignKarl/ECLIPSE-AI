import { misConexiones } from "../conexiones/almacen";
import { servicioDe } from "../conexiones/registro";
import { unaRespuesta } from "../una-respuesta";
import { DIAS, fechaDe, MAX_TAREAS, type Cuando } from "./tipos";

/**
 * Que lo planifique ECLIPSE.
 *
 * El problema de Programar no era que no funcionara: era que empezaba con un
 * formulario en blanco y con la promesa de que mañana, si eso, aparecería algo.
 * Dos esperas seguidas —pensar tú qué encargar, y esperar a ver si sirve— para
 * algo que todavía no sabes si quieres.
 *
 * Esto le da la vuelta. Dices qué quieres conseguir, en una línea y como se
 * habla, y ECLIPSE devuelve un plan entero repartido por días, al momento y sin
 * ejecutar nada. Lo miras, quitas lo que no, lo añades de un toque. Y si no te
 * cuadra, le pides el cambio con palabras —"mejor los martes", "quita el del
 * SEO", "¿tú qué harías?"— y te lo vuelve a repartir.
 *
 * Lo que aquí NO se hace: ejecutar. Planificar es barato y se ve al momento;
 * ejecutar cuesta medio minuto por encargo y es lo que había que dejar de
 * esperar.
 */

/** Un encargo propuesto, todavía sin guardar en ninguna parte. */
export interface Propuesta {
  titulo: string;
  instruccion: string;
  cuando: Cuando;
}

export interface Plan {
  /** Qué ha decidido y por qué, o el consejo que le han pedido. */
  nota: string;
  encargos: Propuesta[];
}

/** Cuántos encargos como mucho trae un plan. Más no se lee, se hojea. */
const MAX_POR_PLAN = 5;

/**
 * Cuánto se le deja pensar.
 *
 * Veinticinco segundos de los sesenta del hosting. Un plan que tarda más que
 * eso ya ha dejado de ser "al momento", que es lo único que lo hace mejor que
 * el formulario en blanco de antes.
 */
const LIMITE_MS = 25_000;

function limpiar(v: unknown, maximo: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, maximo) : "";
}

/**
 * El "cuándo" que ha escrito el modelo, puesto en su sitio.
 *
 * Dos decisiones que se notan: lo que no se entiende se convierte en "cada
 * lunes" —un día razonable es mejor que perder el encargo—, pero una fecha ya
 * pasada devuelve null y ese encargo se cae del plan. Enseñar una tarjeta que
 * dice "el 3 de septiembre" cuando estamos a 15 es enseñar algo roto.
 */
export function leerCuandoDelPlan(v: unknown, hoy: string): Cuando | null {
  const c = v as { tipo?: string; dia?: unknown; fecha?: unknown } | null;

  if (c?.tipo === "diario") return { tipo: "diario" };
  if (c?.tipo === "laborables") return { tipo: "laborables" };

  if (c?.tipo === "semanal") {
    const dia = Number(c.dia);
    return Number.isInteger(dia) && dia >= 0 && dia <= 6
      ? { tipo: "semanal", dia }
      : { tipo: "semanal", dia: 1 };
  }

  if (c?.tipo === "mensual") {
    const dia = Number(c.dia);
    // Hasta 28: "cada día 31" no existe en cuatro meses del año.
    return { tipo: "mensual", dia: Number.isInteger(dia) ? Math.min(Math.max(dia, 1), 28) : 1 };
  }

  if (c?.tipo === "unavez") {
    const fecha = limpiar(c.fecha, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
    if (fecha < hoy) return null;
    return { tipo: "unavez", fecha };
  }

  return { tipo: "semanal", dia: 1 };
}

/**
 * Lo que ha contestado el modelo, convertido en un plan.
 *
 * Aparte y sin red por medio para poder comprobarlo solo, que es donde de
 * verdad se rompe esto: un modelo contesta con el JSON envuelto en comillas de
 * bloque, o con una frase delante, o con un campo de menos. Nada de eso puede
 * acabar en una pantalla en blanco.
 */
export function leerPlan(crudo: string, hoy: string): Plan {
  const texto = crudo.replace(/```(?:json)?/gi, "").trim();
  const abre = texto.indexOf("{");
  const cierra = texto.lastIndexOf("}");
  if (abre === -1 || cierra <= abre) return { nota: "", encargos: [] };

  let leido: { nota?: unknown; encargos?: unknown };
  try {
    leido = JSON.parse(texto.slice(abre, cierra + 1)) as { nota?: unknown; encargos?: unknown };
  } catch {
    return { nota: "", encargos: [] };
  }

  const crudos = Array.isArray(leido.encargos) ? leido.encargos : [];
  const encargos: Propuesta[] = [];

  for (const e of crudos.slice(0, MAX_POR_PLAN)) {
    const uno = e as { titulo?: unknown; instruccion?: unknown; cuando?: unknown };
    const instruccion = limpiar(uno.instruccion, 1000);
    if (!instruccion) continue;

    const cuando = leerCuandoDelPlan(uno.cuando, hoy);
    if (!cuando) continue;

    encargos.push({
      // Sin título se usa el principio del encargo, como en el formulario de
      // toda la vida: nadie quiere rellenar dos campos para decir una cosa.
      titulo:
        limpiar(uno.titulo, 60) ||
        `${instruccion.slice(0, 48)}${instruccion.length > 48 ? "…" : ""}`,
      instruccion,
      cuando,
    });
  }

  return { nota: limpiar(leido.nota, 300), encargos };
}

/** Lo que ya tiene puesto, para que no le proponga lo mismo otra vez. */
function loQueYaHay(titulos: string[]): string {
  if (!titulos.length) return "Todavía no tiene ningún encargo puesto.";
  return `Ya tiene estos encargos, NO los repitas: ${titulos.join("; ")}.`;
}

/** Con qué cuenta de verdad: lo que tiene conectado y nada más. */
async function loQuePuedeMirar(): Promise<string> {
  const conectadas = await misConexiones().catch(() => []);
  if (!conectadas.length)
    return `No tiene ninguna cuenta conectada, así que los encargos solo pueden apoyarse en
buscar en internet y en lo que tú sepas. NO propongas nada que empiece por "mira
en tu tienda" o "revisa tu Notion": no hay nada que mirar.`;

  const nombres = conectadas
    .map((c) => servicioDe(c.servicio)?.nombre ?? c.servicio)
    .join(", ");
  return `Tiene conectados: ${nombres}. Puedes proponer encargos que miren ahí dentro, y
son los que más valen. De lo que no esté en esa lista, ni hablar.`;
}

function instrucciones(hoy: Date, yaTiene: string[], conexiones: string, cuantosCaben: number): string {
  return `Eres ECLIPSE y estás montándole a alguien su plan de encargos automáticos.

Un encargo es algo que tú haces solo, el día que toque, sin nadie delante, y que
esa persona se encuentra hecho al abrir la aplicación. No es un recordatorio:
tú haces el trabajo y entregas el resultado escrito.

Hoy es ${DIAS[hoy.getUTCDay()]} ${fechaDe(hoy)}.
${conexiones}
${loQueYaHay(yaTiene)}

Devuelve SOLO un JSON, sin nada delante ni detrás, con esta forma exacta:

{"nota":"una o dos líneas","encargos":[{"titulo":"corto","instruccion":"lo que tienes que hacer","cuando":{"tipo":"semanal","dia":1}}]}

El "cuando" puede ser:
- {"tipo":"diario"}
- {"tipo":"laborables"}                      (de lunes a viernes)
- {"tipo":"semanal","dia":N}                 (0 domingo … 6 sábado)
- {"tipo":"mensual","dia":N}                 (1 a 28)
- {"tipo":"unavez","fecha":"AAAA-MM-DD"}     (un día concreto, nunca uno pasado)

Cómo tiene que ser el plan:

- Entre 2 y ${Math.min(cuantosCaben, 5)} encargos. Menos y bien hechos, mejor que muchos.
- REPÁRTELOS por la semana. Todos el mismo día es lo mismo que uno solo.
- Cada "instruccion" se la estás escribiendo a ti mismo para dentro de una
  semana, cuando no te acuerdes de esta conversación: tiene que entenderse sola,
  decir exactamente qué entregar y no hacer ninguna pregunta, porque no habrá
  nadie para contestarla.
- Concreta. "Resumen de la tienda" no vale; "cuántos pedidos hubo ayer, cuánto
  suman y qué producto se ha quedado sin stock" sí.
- Nada que no puedas hacer: no mandas correos, no llamas por teléfono, no
  compras nada y no haces vídeos.
- Los títulos, de dos o tres palabras, para que se lean en una lista.
- La "nota": qué has decidido y por qué, en dos líneas, hablándole de tú. Si te
  han pedido consejo, ahí va el consejo. Nada de "¡Aquí tienes tu plan!".`;
}

export type Resultado =
  | { ok: true; plan: Plan }
  | { ok: false; error: string };

/**
 * Pedirle el plan al modelo.
 *
 * Sin herramientas y de una sola pasada: es escribir, no investigar, y cada
 * vuelta de más son segundos de espera en una pantalla donde la gracia era no
 * esperar.
 */
export async function planificar(opciones: {
  deseo: string;
  /** El cambio que se le pide sobre el plan anterior: "mejor los martes". */
  ajuste?: string;
  anterior?: Plan;
  yaTiene?: string[];
  cuantosCaben?: number;
  ahora?: Date;
  signal?: AbortSignal;
}): Promise<Resultado> {
  const ahora = opciones.ahora ?? new Date();
  const sistema = instrucciones(
    ahora,
    opciones.yaTiene ?? [],
    await loQuePuedeMirar(),
    opciones.cuantosCaben ?? MAX_TAREAS,
  );

  const peticion = opciones.ajuste
    ? `Lo que quería: ${opciones.deseo}

Le propusiste esto:
${JSON.stringify(opciones.anterior?.encargos ?? [], null, 0)}

Y ahora te dice: «${opciones.ajuste}»

Devuelve el plan entero otra vez, ya con ese cambio hecho. Si lo que te pide es
una opinión y no un cambio, contéstale en la "nota" y deja los encargos como
estaban.`
    : `Lo que quiere conseguir: ${opciones.deseo}`;

  const reloj = opciones.signal
    ? AbortSignal.any([opciones.signal, AbortSignal.timeout(LIMITE_MS)])
    : AbortSignal.timeout(LIMITE_MS);

  const r = await unaRespuesta({
    sistema,
    mensaje: peticion,
    tope: 1400,
    signal: reloj,
  });

  /*
    Cuando falla, se dice lo que ha dicho el motor.

    Un "no se ha podido, inténtalo otra vez" es lo que había, y con eso no se
    arregla nada: ni lo entiende quien lo lee ni se puede averiguar después qué
    pasó. Si Mistral dice que esa clave no llega a ese modelo, eso es lo que
    tiene que salir en pantalla.
  */
  if (!r.ok)
    return {
      ok: false,
      error: reloj.aborted
        ? "Ha tardado demasiado en planificarlo. Inténtalo otra vez."
        : `No ha salido el plan: ${r.error}`,
    };

  const plan = leerPlan(r.texto, fechaDe(ahora));
  if (!plan.encargos.length)
    return {
      ok: false,
      error:
        "El motor ha contestado algo que no es un plan. Vuelve a intentarlo, y si quieres dile con más detalle qué buscas.",
    };

  return { ok: true, plan };
}
