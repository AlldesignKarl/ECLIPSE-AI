import { cookies } from "next/headers";

/**
 * De dónde sale la clave de la IA.
 *
 * Lo normal es ponerla como variable de entorno en el hosting. Pero rellenar
 * ese formulario desde un móvil es un suplicio, así que la aplicación también
 * acepta que la pegues desde Ajustes: se guarda en una cookie `HttpOnly` de tu
 * navegador, nunca queda a la vista del JavaScript de la página, y viaja solo
 * a tu propio servidor.
 *
 * La variable de entorno siempre manda sobre la cookie.
 */

export const GOOGLE_KEY_COOKIE = "eclipse_gkey";
const MAX_AGE = 60 * 60 * 24 * 365;

export function googleKeyFromEnv(): string {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
}

/** La clave que toca usar en esta petición. */
export async function resolveGoogleKey(): Promise<string> {
  const fromEnv = googleKeyFromEnv();
  if (fromEnv) return fromEnv;

  const jar = await cookies();
  return jar.get(GOOGLE_KEY_COOKIE)?.value ?? "";
}

export async function googleKeyAvailable(): Promise<boolean> {
  return Boolean(await resolveGoogleKey());
}

/** De dónde viene la clave, para poder explicárselo al usuario en Ajustes. */
export async function googleKeySource(): Promise<"entorno" | "dispositivo" | "ninguna"> {
  if (googleKeyFromEnv()) return "entorno";
  const jar = await cookies();
  return jar.get(GOOGLE_KEY_COOKIE)?.value ? "dispositivo" : "ninguna";
}

export function keyCookieHeader(key: string): string {
  return `${GOOGLE_KEY_COOKIE}=${encodeURIComponent(key)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export const CLEAR_KEY_COOKIE = `${GOOGLE_KEY_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;

/** Comprueba contra Google que la clave sirve, antes de guardarla. */
export async function verifyGoogleKey(
  key: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": key },
      cache: "no-store",
    });

    if (res.ok) return { ok: true };

    if (res.status === 400 || res.status === 401 || res.status === 403)
      return {
        ok: false,
        error: "Google no acepta esa clave. Comprueba que la copiaste entera, sin espacios.",
      };

    return { ok: false, error: `Google respondió ${res.status}. Inténtalo de nuevo en un momento.` };
  } catch {
    return { ok: false, error: "No se ha podido contactar con Google para comprobar la clave." };
  }
}
