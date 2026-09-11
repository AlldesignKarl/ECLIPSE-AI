import { keyAvailable, preferredEngine, type KeyProvider } from "./keys";

export type Provider = KeyProvider | "anthropic";

/** Motores con capa gratuita de verdad, en el orden en que se prueban. */
const FREE_ORDER: KeyProvider[] = ["groq", "google", "openrouter"];

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
  if (p === "openrouter") return "OpenRouter · modelos gratuitos";
  if (p === "anthropic") return "Anthropic · de pago por uso";
  return "sin configurar";
}

/** ¿Este motor sabe buscar en la web por su cuenta? */
export function providerSearches(p: Provider | null): boolean {
  return p === "google" || p === "anthropic";
}
