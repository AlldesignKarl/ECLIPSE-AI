import { geminiAvailable } from "./gemini";

export type Provider = "google" | "anthropic";

/**
 * Qué motor usa el chat. Se prefiere Google porque es el que tiene capa
 * gratuita: así la aplicación funciona sin tarjeta. Con AI_PROVIDER se puede
 * forzar uno concreto si están configurados los dos.
 */
export function activeProvider(): Provider | null {
  const forced = (process.env.AI_PROVIDER || "").toLowerCase();
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

  if (forced === "google" && geminiAvailable()) return "google";
  if (forced === "anthropic" && hasAnthropic) return "anthropic";

  if (geminiAvailable()) return "google";
  if (hasAnthropic) return "anthropic";
  return null;
}

export function providerLabel(p: Provider | null): string {
  if (p === "google") return "Google · capa gratuita";
  if (p === "anthropic") return "Anthropic · de pago por uso";
  return "sin configurar";
}
