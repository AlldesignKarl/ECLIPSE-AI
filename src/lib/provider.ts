import { googleKeyAvailable } from "./keys";

export type Provider = "google" | "anthropic";

/**
 * Qué motor usa el chat. Se prefiere Google porque es el que tiene capa
 * gratuita: así la aplicación funciona sin tarjeta. Con AI_PROVIDER se puede
 * forzar uno concreto si están configurados los dos.
 */
export async function activeProvider(): Promise<Provider | null> {
  const forced = (process.env.AI_PROVIDER || "").toLowerCase();
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasGoogle = await googleKeyAvailable();

  if (forced === "google" && hasGoogle) return "google";
  if (forced === "anthropic" && hasAnthropic) return "anthropic";

  if (hasGoogle) return "google";
  if (hasAnthropic) return "anthropic";
  return null;
}

export function providerLabel(p: Provider | null): string {
  if (p === "google") return "Google · capa gratuita";
  if (p === "anthropic") return "Anthropic · de pago por uso";
  return "sin configurar";
}
