import { resolveKey } from "./keys";
import { oneShotCompat, type CompatProvider } from "./openai-compat";

/**
 * Traduce lo que escribe una persona a lo que entiende un modelo de imagen.
 *
 * Los modelos de imagen libres (Flux y compañía) están entrenados casi solo en
 * inglés y responden mucho mejor a una descripción larga y concreta que a una
 * frase suelta. «Una imagen de unos eclipses» da cualquier cosa; la misma idea
 * escrita como una ficha de fotografía —encuadre, luz, óptica, estilo— da lo
 * que la persona tenía en la cabeza.
 *
 * Y algo más importante todavía: un modelo de imagen no tiene memoria. Cuando
 * alguien dice «cámbiala, que sea más profesional» no está pidiendo una imagen
 * nueva de la nada, está hablando de la anterior. Si solo se le manda esa
 * frase, dibuja lo que le sugiera «profesional» y aparece cualquier cosa que no
 * tiene nada que ver. Por eso aquí entra también la descripción anterior.
 */

const INSTRUCCIONES = `You turn a user's request into ONE prompt for a text-to-image model.

Rules:
- Answer with the prompt ONLY. No preamble, no quotes, no explanation, no options.
- Write it in English, even when the request is in another language.
- One single line, 30 to 60 words.
- Describe: main subject, setting, composition, lighting, colour, mood, and a
  photographic or artistic style (lens, film, render, illustration technique).
- Be concrete. Replace vague words like "professional" or "nice" with the
  concrete choices a professional would make.
- If a PREVIOUS PROMPT is given, the user is asking to change THAT image: keep
  its subject and rewrite the rest according to the new request.
- Never invent text, logos or watermarks inside the image.`;

const MOTORES: CompatProvider[] = ["groq", "openrouter"];

/**
 * Devuelve el prompt listo para el modelo de imagen. Si no hay ningún motor de
 * texto a mano o falla, devuelve lo que escribió la persona: peor resultado,
 * pero imagen al fin y al cabo.
 */
export async function prepararPrompt(pedido: string, anterior?: string): Promise<string> {
  const limpio = pedido.trim();
  if (!limpio) return limpio;

  const encargo = [
    INSTRUCCIONES,
    anterior ? `\nPREVIOUS PROMPT:\n${anterior.slice(0, 600)}` : "",
    `\nREQUEST:\n${limpio.slice(0, 600)}`,
  ].join("\n");

  for (const motor of MOTORES) {
    const clave = await resolveKey(motor);
    if (!clave) continue;

    try {
      const salida = await oneShotCompat(motor, clave, encargo, 220);
      const linea = limpiar(salida);
      if (linea.length > 12) return linea;
    } catch {
      /* Con el siguiente motor, y si no, con lo que escribió la persona. */
    }
  }

  return anterior ? `${anterior}. ${limpio}` : limpio;
}

/** El modelo a veces se arranca con «Sure, here's…» o entrecomilla la frase. */
function limpiar(texto: string): string {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^(sure|here('s| is)|prompt\s*:)/i.test(l))
    .join(" ")
    .replace(/^["“'`]+|["”'`]+$/g, "")
    .replace(/^prompt\s*:\s*/i, "")
    .trim();
}
