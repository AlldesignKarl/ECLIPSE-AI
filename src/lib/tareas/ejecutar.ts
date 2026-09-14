import { buildSystemPrompt } from "../prompts";
import { activeProvider } from "../provider";
import { resolveKey } from "../keys";
import { conversarConHerramientas } from "../tools/bucle";
import type { CompatProvider } from "../openai-compat";
import { anotarEjecucion, apuntarResultado, tareasDe } from "./almacen";
import { pendientes, textoDe, type Tarea } from "./tipos";

/**
 * Hacer lo que toca hoy.
 *
 * Esto corre sin nadie delante, y eso cambia tres cosas respecto al chat:
 *
 * - No hay pantalla, así que no hay flujo: se espera a que termine y se guarda
 *   el texto entero.
 * - No hay a quién preguntarle nada, así que las instrucciones dicen que
 *   entregue algo terminado y no un cuestionario.
 * - No hay cookies, así que la clave del motor tiene que venir del servidor.
 *   Quien tenga la suya solo en el móvil no puede tener tareas, y se dice.
 */

/** Cuánto se deja correr una tarea antes de darla por perdida. */
const LIMITE_MS = 90_000;

const COMO_CONTESTAR = `Esto es un encargo programado: nadie lo está leyendo en
directo y nadie te va a contestar. Así que entrega algo TERMINADO.

- Nada de preguntas: no hay quien las responda. Lo que falte, decídelo tú.
- Empieza por lo que importa. Quien lo lea va a verlo de un vistazo por la
  mañana, no va a leerse tres párrafos de introducción.
- Si has buscado o has mirado en alguna cuenta conectada, cuenta lo que has
  encontrado con los datos delante, no en general.
- Si hoy no hay nada que contar, dilo en una línea y ya. Inventarse relleno para
  que parezca que ha pasado algo es lo peor que puedes hacer aquí.
- Sin saludos ni despedidas. Es un parte, no una carta.`;

export interface Ejecucion {
  tarea: string;
  ok: boolean;
  detalle: string;
}

/** Una tarea, de principio a fin. */
export async function ejecutarUna(email: string, tarea: Tarea): Promise<Ejecucion> {
  const provider = await activeProvider();

  /*
    Sin motor del servidor no hay tareas, y hay que decirlo claro.

    La clave puede estar en una cookie del navegador de quien la puso, y aquí no
    hay navegador. No es un fallo que se pueda reintentar: es que esto no puede
    funcionar así, y quien lo lea tiene que saber por qué.
  */
  if (!provider || provider === "anthropic" || provider === "google") {
    const motivo =
      !provider
        ? "No hay ningún motor configurado en el servidor."
        : "Las tareas necesitan un motor con herramientas (Mistral, Groq u OpenRouter) puesto en el servidor.";
    await anotarEjecucion(email, tarea.id, motivo);
    return { tarea: tarea.titulo, ok: false, detalle: motivo };
  }

  const key = await resolveKey(provider);
  if (!key) {
    const motivo =
      "La clave del motor no está en el servidor, solo en un navegador. Una tarea corre sin nadie delante, así que no puede usarla.";
    await anotarEjecucion(email, tarea.id, motivo);
    return { tarea: tarea.titulo, ok: false, detalle: motivo };
  }

  const reloj = AbortSignal.timeout(LIMITE_MS);
  let texto = "";

  try {
    const sistema = `${buildSystemPrompt({
      mode: "chat",
      // Las tareas son del plan Pro, así que aquí se trabaja como Pro.
      plan: "pro",
      web: true,
      engine: provider,
    })}\n\n${COMO_CONTESTAR}`;

    for await (const evento of conversarConHerramientas({
      provider: provider as CompatProvider,
      key,
      system: sistema,
      turns: [
        {
          role: "user",
          content: `${tarea.instruccion}\n\n(Encargo programado «${tarea.titulo}», ${textoDe(
            tarea.cuando,
          ).toLowerCase()}.)`,
        },
      ],
      speed: "equilibrado",
      mode: "chat",
      plan: "pro",
      signal: reloj,
    })) {
      if (evento.texto) texto += evento.texto;
    }
  } catch (err) {
    const motivo =
      (err as Error)?.name === "TimeoutError"
        ? "Ha tardado demasiado y se ha cortado."
        : err instanceof Error
          ? err.message
          : "Ha fallado sin decir por qué.";
    await anotarEjecucion(email, tarea.id, motivo);
    return { tarea: tarea.titulo, ok: false, detalle: motivo };
  }

  const limpio = texto.trim();
  if (!limpio) {
    const motivo = "No ha escrito nada.";
    await anotarEjecucion(email, tarea.id, motivo);
    return { tarea: tarea.titulo, ok: false, detalle: motivo };
  }

  await apuntarResultado(email, {
    tareaId: tarea.id,
    titulo: tarea.titulo,
    texto: limpio,
    hecha: Date.now(),
  });
  await anotarEjecucion(email, tarea.id);
  return { tarea: tarea.titulo, ok: true, detalle: `${limpio.length} caracteres` };
}

/**
 * Todo lo que le toque hoy a una persona.
 *
 * De una en una y no todas a la vez: son varias llamadas al motor, y lanzarlas
 * juntas es la forma más rápida de que el proveedor las rechace por cupo y no
 * salga ninguna.
 */
export async function ejecutarPendientes(
  email: string,
  ahora = new Date(),
): Promise<Ejecucion[]> {
  const tareas = await tareasDe(email);
  const toca = pendientes(tareas, ahora);

  const hechas: Ejecucion[] = [];
  for (const tarea of toca) hechas.push(await ejecutarUna(email, tarea));
  return hechas;
}
