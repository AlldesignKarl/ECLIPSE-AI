import Anthropic from "@anthropic-ai/sdk";
import type { Plan, Speed } from "./types";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

let cached: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new MissingKeyError(
      "Falta ANTHROPIC_API_KEY. Añádela en las variables de entorno para que ECLIPSE pueda responder.",
    );
  }
  if (!cached) {
    cached = new Anthropic({
      // 10 min por defecto; las respuestas largas van en streaming.
      maxRetries: 2,
    });
  }
  return cached;
}

export class MissingKeyError extends Error {
  readonly code = "missing_key";
}

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Traduce la preferencia de velocidad del usuario a parámetros reales.
 * `low` piensa poco y responde ya; `xhigh` razona a fondo.
 */
export function tuning(speed: Speed, plan: Plan): {
  effort: Effort;
  maxTokens: number;
  fast: boolean;
} {
  switch (speed) {
    case "rapido":
      return { effort: "low", maxTokens: 16000, fast: plan === "pro" };
    case "profundo":
      return {
        effort: plan === "pro" ? "xhigh" : "high",
        maxTokens: 48000,
        fast: false,
      };
    case "equilibrado":
    default:
      return { effort: "medium", maxTokens: 32000, fast: false };
  }
}

/** Mensaje de error legible a partir de cualquier fallo del SDK. */
export function humanError(err: unknown): string {
  if (err instanceof MissingKeyError) return err.message;
  if (err instanceof Anthropic.AuthenticationError)
    return "La clave de la API no es válida. Revisa ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.RateLimitError)
    return "Demasiadas peticiones seguidas. Espera unos segundos y vuelve a intentarlo.";
  if (err instanceof Anthropic.BadRequestError)
    return `La petición no es válida: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError)
    return "No se ha podido conectar con el modelo. Comprueba tu conexión.";
  if (err instanceof Anthropic.APIError)
    return `Error de la API (${err.status}): ${err.message}`;
  if (err instanceof Error) return err.message;
  return "Ha ocurrido un error inesperado.";
}
