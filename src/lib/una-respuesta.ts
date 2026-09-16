import { getClient, MODEL } from "./anthropic";
import { oneShot as oneShotGoogle } from "./gemini";
import { KEY_PROVIDERS, resolveKey } from "./keys";
import { unaVezCompat, type CompatProvider } from "./openai-compat";
import { activeProvider, type Provider } from "./provider";
import type { Attachment } from "./types";

/**
 * Una respuesta entera del motor que haya, sea cual sea.
 *
 * Existe por un fallo que se veía en producción y no aquí: ECLIPSE contestaba
 * en el chat pero se quedaba MUDO en los grupos, y Programar decía "no se ha
 * podido planificar" sin decir por qué. El motivo era el mismo en los dos
 * sitios: esas dos cosas solo sabían hablar con Mistral, Groq y OpenRouter,
 * porque están escritas sobre el bucle de herramientas. Con Google de motor
 * —que es lo que mucha gente tiene puesto— devolvían un aviso que nadie leía y
 * la pantalla se quedaba igual que si no hubieras escrito nada.
 *
 * Aquí no hacen falta herramientas: es escribir. Así que habla con los cinco
 * motores, y si el primero falla prueba con el siguiente que tenga clave en vez
 * de rendirse. Y cuando no puede, dice POR QUÉ, con las palabras del que falló.
 */

export interface Peticion {
  /** Las instrucciones. Van aparte porque sin ellas un plan no sale. */
  sistema?: string;
  mensaje: string;
  /** Cuánto puede escribir. Un título son 40; un plan, mil y pico. */
  tope?: number;
  /**
   * Fotos, PDF o archivos que hay que MIRAR.
   *
   * Lo usa el Modo Examen para leer los apuntes de alguien. Con adjuntos
   * cambia el orden en que se prueban los motores: delante los que ven, que no
   * son todos, y por eso esto no es solo un parámetro más.
   */
  adjuntos?: Attachment[];
  signal?: AbortSignal;
}

export type Respuesta =
  | { ok: true; texto: string; motor: Provider }
  | { ok: false; error: string };

/**
 * El orden en que se prueban: primero el de siempre, luego los que haya.
 *
 * Con adjuntos delante, el orden cambia y manda Google. No es preferencia: es
 * que sus modelos miran imágenes y leen PDF SIEMPRE, y los de los demás
 * dependen de qué tenga la cuenta ese día. Leer unos apuntes con un motor que
 * no ve es perder el viaje y, peor, arriesgarse a que conteste algo de memoria
 * en vez de decir que no ha visto nada.
 */
async function motoresAProbar(conAdjuntos = false): Promise<Provider[]> {
  const primero = await activeProvider();
  const orden: Provider[] = primero ? [primero] : [];

  for (const p of KEY_PROVIDERS) {
    if (p !== primero && (await resolveKey(p))) orden.push(p);
  }
  if (primero !== "anthropic" && process.env.ANTHROPIC_API_KEY) orden.push("anthropic");

  if (conAdjuntos && orden.includes("google"))
    return ["google", ...orden.filter((p) => p !== "google")];
  return orden;
}

async function conUno(motor: Provider, p: Peticion): Promise<string> {
  const tope = p.tope ?? 1200;

  if (motor === "anthropic") {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: tope,
      ...(p.sistema ? { system: p.sistema } : {}),
      messages: [{ role: "user", content: p.mensaje }],
    });
    return res.content
      .filter((b): b is { type: "text"; text: string; citations: null } => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  }

  const key = await resolveKey(motor);
  if (!key) throw new Error(`No hay clave de ${motor}.`);

  if (motor === "google") {
    // Gemini no separa instrucciones y pregunta en esta llamada corta, así que
    // van pegadas. Es lo mismo que hace el titulador desde siempre.
    return (
      await oneShotGoogle(
        p.sistema ? `${p.sistema}\n\n${p.mensaje}` : p.mensaje,
        key,
        tope,
        p.adjuntos,
      )
    ).trim();
  }

  return unaVezCompat({
    provider: motor as CompatProvider,
    key,
    sistema: p.sistema,
    prompt: p.mensaje,
    tope,
    adjuntos: p.adjuntos,
    signal: p.signal,
  });
}

export async function unaRespuesta(p: Peticion): Promise<Respuesta> {
  const motores = await motoresAProbar(Boolean(p.adjuntos?.length));
  if (!motores.length)
    return {
      ok: false,
      error:
        "Este servidor no tiene ningún motor configurado. Pega una clave gratuita en Ajustes y vuelve a intentarlo.",
    };

  let ultimo = "";
  for (const motor of motores) {
    // Si quien manda ha cortado, se para: eso no es un fallo del motor y
    // probar con el siguiente sería trabajar para nadie.
    if (p.signal?.aborted) break;

    try {
      const texto = await conUno(motor, p);
      if (texto) return { ok: true, texto, motor };
      ultimo = `${motor} no ha escrito nada.`;
    } catch (err) {
      ultimo = err instanceof Error ? err.message : `${motor} ha fallado.`;
    }
  }

  return { ok: false, error: ultimo || "Ningún motor ha podido contestar." };
}
