import {
  margenDeSobra,
  streamCompat,
  type CompatProvider,
  type LlamadaCruda,
  type TurnoExtra,
} from "../openai-compat";
import type { Attachment, Mode, Plan, Source, Speed } from "../types";
import { comoEsquemaOpenAI, ejecutarHerramienta, herramientasPara } from "./registro";

/**
 * El bucle de herramientas: lo que convierte a ECLIPSE en algo que *hace*.
 *
 * Un modelo por sí solo solo escribe. Cuando quiere buscar o crear un archivo
 * no lo hace: pide que alguien lo haga y espera el resultado. Este bucle es ese
 * alguien. Habla con el modelo, y si en vez de texto pide herramientas, las
 * ejecuta, le devuelve lo que salió y le vuelve a preguntar, hasta que ya no
 * pide más y escribe la respuesta.
 *
 * Tiene tope de vueltas por una razón concreta: un modelo puede quedarse en un
 * bucle —buscar, no quedar convencido, volver a buscar— y cada vuelta cuesta
 * dinero y segundos. Al llegar al tope se le dice que ya no hay más
 * herramientas y que responda con lo que tenga, que es mejor que cortarle.
 */

export interface EventoBucle {
  /** Texto de la respuesta final. */
  texto?: string;
  /** Ha empezado a usar una herramienta. */
  herramienta?: { nombre: string; detalle: string };
  /** Ha terminado de usarla. */
  hecha?: { nombre: string; ok: boolean; detalle: string };
  /** Fuentes acumuladas hasta ahora. */
  fuentes?: Source[];
  /** Un archivo listo para descargar. */
  archivo?: { nombre: string; mime: string; contenido: string };
  /** Una imagen creada, ya con su marca de agua. */
  imagen?: { url: string; prompt: string };
  /** El modelo que está respondiendo. */
  modelo?: string;
  /** Su deliberación, para el panel de razonamiento. */
  pensando?: string;
  /** Se quedó a medias por falta de espacio. */
  cortado?: boolean;
  /** Había fotos y este motor no ha podido con ellas. */
  sinVista?: boolean;
}

/** Cuántas rondas de herramientas se permiten según lo que pida el usuario. */
function topeVueltas(speed: Speed): number {
  if (speed === "rapido") return 2;
  if (speed === "profundo") return 8;
  return 4;
}

/** Lo que el modelo escribió mal como argumentos no puede tumbar la respuesta. */
function leerArgumentos(crudo: string): Record<string, unknown> {
  try {
    const v = JSON.parse(crudo || "{}");
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Un resumen corto de la llamada, para poder enseñarla en pantalla. */
function detalleDe(nombre: string, args: Record<string, unknown>): string {
  if (nombre === "buscar_web") return String(args.consulta ?? "");
  if (nombre === "crear_archivo") return String(args.nombre ?? "");
  if (nombre === "crear_imagen") return String(args.descripcion ?? "").slice(0, 60);
  return "";
}

export async function* conversarConHerramientas(opts: {
  provider: CompatProvider;
  key: string;
  system: string;
  turns: { role: "user" | "assistant"; content: string; attachments?: Attachment[] }[];
  speed: Speed;
  mode: Mode;
  plan: Plan;
  signal?: AbortSignal;
}): AsyncGenerator<EventoBucle> {
  const ultimoTurno = [...opts.turns].reverse().find((t) => t.role === "user");
  const herramientas = await herramientasPara(opts.mode, opts.plan, {
    texto: ultimoTurno?.content ?? "",
    conImagen: Boolean(ultimoTurno?.attachments?.some((a) => a.kind === "image" && a.data)),
  });

  // Sin herramientas que ofrecer, esto es una conversación normal y corriente.
  if (herramientas.length === 0) {
    for await (const e of streamCompat({ ...opts, modo: opts.mode })) {
      if (e.text) yield { texto: e.text };
      if (e.pensando) yield { pensando: e.pensando };
      if (e.cortado) yield { cortado: true };
      if (e.sinVista) yield { sinVista: true };
      if (e.modelo) yield { modelo: e.modelo };
    }
    return;
  }

  const esquema = comoEsquemaOpenAI(herramientas);
  const extra: TurnoExtra[] = [];
  /**
   * No todos los modelos de la capa gratuita aceptan herramientas, y los que no
   * las aceptan contestan con un error en la primera palabra. Si eso pasa antes
   * de haber escrito nada, se repite la respuesta sin herramientas: el usuario
   * prefiere una respuesta normal a una pantalla con un error.
   */
  let escritoAlgo = false;
  const fuentes: Source[] = [];
  const vistas = new Set<string>();
  const tope = topeVueltas(opts.speed);

  for (let vuelta = 0; vuelta <= tope; vuelta++) {
    // En la última vuelta se le quitan las herramientas: así no puede pedir
    // otra ronda y está obligado a responder con lo que ya tiene.
    const ultima = vuelta === tope;
    let llamadas: LlamadaCruda[] = [];
    let escrito = "";

    try {
      for await (const e of streamCompat({
        ...opts,
        modo: opts.mode,
        tools: ultima ? undefined : esquema,
        extra,
      })) {
        if (e.text) {
          escrito += e.text;
          escritoAlgo = true;
          yield { texto: e.text };
        }
        if (e.pensando) yield { pensando: e.pensando };
        if (e.cortado) yield { cortado: true };
        if (e.sinVista) yield { sinVista: true };
        if (e.modelo && vuelta === 0) yield { modelo: e.modelo };
        if (e.llamadas) llamadas = e.llamadas;
      }
    } catch (err) {
      if (escritoAlgo || vuelta > 0 || (err as Error)?.name === "AbortError") throw err;

      // Primer intento fallido y sin una sola palabra escrita: se reintenta a
      // pelo. Si vuelve a fallar, ahí sí es un problema de verdad y sube.
      for await (const e of streamCompat({ ...opts, modo: opts.mode, tools: undefined })) {
        if (e.text) yield { texto: e.text };
      }
      return;
    }

    if (llamadas.length === 0) return;

    // El modelo tiene que ver su propia petición antes que las respuestas.
    extra.push({ role: "assistant", content: escrito, tool_calls: llamadas });

    for (const llamada of llamadas) {
      const args = leerArgumentos(llamada.function.arguments);
      const detalle = detalleDe(llamada.function.name, args);
      yield { herramienta: { nombre: llamada.function.name, detalle } };

      const resultado = await ejecutarHerramienta(llamada.function.name, args, {
        plan: opts.plan,
        modo: opts.mode,
        margenAmplio: margenDeSobra(opts.provider),
        signal: opts.signal,
      });

      if (resultado.fuentes?.length) {
        for (const f of resultado.fuentes) {
          if (vistas.has(f.url)) continue;
          vistas.add(f.url);
          fuentes.push(f);
        }
        yield { fuentes: [...fuentes] };
      }

      if (resultado.archivo) yield { archivo: resultado.archivo };
      if (resultado.imagen) yield { imagen: resultado.imagen };

      yield {
        hecha: {
          nombre: llamada.function.name,
          ok: !resultado.error,
          detalle: resultado.error ?? detalle,
        },
      };

      // El error se le cuenta al modelo como resultado, no se lanza: así puede
      // probar otra cosa o explicárselo al usuario en vez de quedarse mudo.
      extra.push({
        role: "tool",
        tool_call_id: llamada.id,
        content: resultado.error ? `ERROR: ${resultado.error}` : resultado.texto,
      });
    }
  }
}
