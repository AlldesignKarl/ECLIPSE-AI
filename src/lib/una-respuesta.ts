import { getClient, MODEL } from "./anthropic";
import { oneShot as oneShotGoogle } from "./gemini";
import { KEY_PROVIDERS, resolveKey } from "./keys";
import { unaVezCompat, type CompatProvider } from "./openai-compat";
import { activeProvider, type Provider } from "./provider";

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
  signal?: AbortSignal;
}

export type Respuesta =
  | { ok: true; texto: string; motor: Provider }
  | { ok: false; error: string };

/** El orden en que se prueban: primero el de siempre, luego los que haya. */
async function motoresAProbar(): Promise<Provider[]> {
  const primero = await activeProvider();
  const orden: Provider[] = primero ? [primero] : [];

  for (const p of KEY_PROVIDERS) {
    if (p !== primero && (await resolveKey(p))) orden.push(p);
  }
  if (primero !== "anthropic" && process.env.ANTHROPIC_API_KEY) orden.push("anthropic");
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
      await oneShotGoogle(p.sistema ? `${p.sistema}\n\n${p.mensaje}` : p.mensaje, key, tope)
    ).trim();
  }

  return unaVezCompat({
    provider: motor as CompatProvider,
    key,
    sistema: p.sistema,
    prompt: p.mensaje,
    tope,
    signal: p.signal,
  });
}

export async function unaRespuesta(p: Peticion): Promise<Respuesta> {
  const motores = await motoresAProbar();
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
