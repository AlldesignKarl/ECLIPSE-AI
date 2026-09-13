import { keyAvailable, preferredCodeEngine, preferredEngine, type KeyProvider } from "./keys";

export type Provider = KeyProvider | "anthropic";

/*
  Motores con capa gratuita de verdad, en el orden en que se prueban.

  Mistral va primero porque es el que más margen deja con diferencia —medio
  millón de tokens por minuto frente a los ocho mil de Groq—, y ese margen es
  justo lo que decide si un archivo largo sale entero o se corta. Además trae
  modelos para programar y uno que mira imágenes, así que sirve para todo.
*/
const FREE_ORDER: KeyProvider[] = ["mistral", "groq", "google", "openrouter"];

/**
 * Qué motor usa el chat.
 *
 * Manda, por este orden: la variable AI_PROVIDER (si el hosting quiere fijar
 * uno), el motor que el usuario eligió en Ajustes, y si no, el primero que
 * tenga clave. Se prueban antes los gratuitos que los de pago, para que la
 * aplicación funcione sin tarjeta.
 */
export async function activeProvider(): Promise<Provider | null> {
  const forced = (process.env.AI_PROVIDER || "").toLowerCase();
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

  if (forced === "anthropic" && hasAnthropic) return "anthropic";
  for (const p of FREE_ORDER) if (forced === p && (await keyAvailable(p))) return p;

  const chosen = await preferredEngine();
  if (chosen && (await keyAvailable(chosen))) return chosen;

  for (const p of FREE_ORDER) if (await keyAvailable(p)) return p;
  return hasAnthropic ? "anthropic" : null;
}

export function providerLabel(p: Provider | null): string {
  if (p === "groq") return "Groq · gratis";
  if (p === "google") return "Google · capa gratuita";
  if (p === "mistral") return "Mistral · gratis";
  if (p === "openrouter") return "OpenRouter · modelos gratuitos";
  if (p === "anthropic") return "Anthropic · de pago por uso";
  return "sin configurar";
}

/** ¿Este motor sabe buscar en la web por su cuenta? */
export function providerSearches(p: Provider | null): boolean {
  return p === "google" || p === "anthropic";
}

/**
 * El motor para ESTE mensaje, que no siempre es el de siempre.
 *
 * Si la persona manda una foto, lo único que importa es que el motor que
 * conteste sepa mirarla. Google la mira siempre; Groq y OpenRouter dependen de
 * qué modelos tenga la cuenta ese día, y eso cambia solo cada pocas semanas.
 *
 * Así que cuando hay una foto delante y hay clave de Google, contesta Google
 * aunque en Ajustes ponga otra cosa. La alternativa era lo que pasaba antes:
 * "descríbeme la imagen que me acabas de mandar", que es lo contrario de lo que
 * se venía a hacer. La elección de Ajustes se respeta para todo lo demás.
 */
export async function providerForTurn(
  base: Provider | null,
  hayImagenes: boolean,
  /** En ECLIPSE CODE se puede usar un motor distinto al del chat. */
  programando = false,
): Promise<Provider | null> {
  /*
    ECLIPSE CODE puede tener su propio motor.

    Escribir un archivo largo y conversar no piden lo mismo: el cupo por minuto
    se reparte entre lo que se manda y lo que se escribe, y ese reparto es el
    techo de lo largo que puede salir un archivo. Quien quiera archivos más
    largos pone aquí un motor con más sitio, y el chat se queda como estaba.
  */
  if (programando) {
    const paraCodigo = await preferredCodeEngine();
    if (paraCodigo && (await keyAvailable(paraCodigo))) return paraCodigo;

    // Sin elección explícita, programa Mistral si hay clave suya: es donde el
    // archivo largo cabe entero.
    if (base !== "mistral" && (await keyAvailable("mistral"))) return "mistral";
  }

  if (!hayImagenes || base === null) return base;

  // Estos ya miran imágenes por su cuenta: desviarlos a Google sería cambiar
  // de motor sin ganar nada, y encima gastar la cuota corta de Google.
  if (base === "google" || base === "anthropic" || base === "mistral") return base;

  // Solo se cambia si el propio hosting no ha fijado un motor a la fuerza.
  if ((process.env.AI_PROVIDER || "").toLowerCase()) return base;

  return (await keyAvailable("google")) ? "google" : base;
}

/**
 * El siguiente motor con clave, para cuando al de turno se le acaba el cupo.
 *
 * Hace falta desde que la clave puede estar puesta en el servidor y vale para
 * todo el que entre: ahí el cupo no lo gasta una persona, lo gasta todo el
 * mundo a la vez, y el día que se acabe no puede caerse la aplicación entera.
 * Con esto, se pasa al siguiente que tenga clave y la conversación sigue.
 */
export async function siguienteMotor(agotado: Provider | null): Promise<Provider | null> {
  for (const p of FREE_ORDER) {
    if (p === agotado) continue;
    if (await keyAvailable(p)) return p;
  }
  return agotado !== "anthropic" && process.env.ANTHROPIC_API_KEY ? "anthropic" : null;
}
