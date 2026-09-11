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

export type KeyProvider = "google" | "groq" | "openrouter";
export type KeySource = "entorno" | "dispositivo" | "ninguna";

interface Slot {
  cookie: string;
  env: string[];
}

const SLOTS: Record<KeyProvider, Slot> = {
  google: { cookie: "eclipse_gkey", env: ["GOOGLE_API_KEY", "GEMINI_API_KEY"] },
  groq: { cookie: "eclipse_groqkey", env: ["GROQ_API_KEY"] },
  openrouter: { cookie: "eclipse_orkey", env: ["OPENROUTER_API_KEY"] },
};

export const KEY_PROVIDERS = Object.keys(SLOTS) as KeyProvider[];

/** Cookie con el motor que ha elegido el usuario en Ajustes. */
export const ENGINE_COOKIE = "eclipse_engine";

const MAX_AGE = 60 * 60 * 24 * 365;

export function isKeyProvider(v: unknown): v is KeyProvider {
  return typeof v === "string" && v in SLOTS;
}

function fromEnv(provider: KeyProvider): string {
  for (const name of SLOTS[provider].env) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

/** La clave que toca usar en esta petición. */
export async function resolveKey(provider: KeyProvider): Promise<string> {
  const env = fromEnv(provider);
  if (env) return env;

  const jar = await cookies();
  return jar.get(SLOTS[provider].cookie)?.value ?? "";
}

export async function keyAvailable(provider: KeyProvider): Promise<boolean> {
  return Boolean(await resolveKey(provider));
}

/** De dónde viene la clave, para poder explicárselo al usuario en Ajustes. */
export async function keySource(provider: KeyProvider): Promise<KeySource> {
  if (fromEnv(provider)) return "entorno";
  const jar = await cookies();
  return jar.get(SLOTS[provider].cookie)?.value ? "dispositivo" : "ninguna";
}

/** El estado de todas las claves de golpe, para pintar Ajustes de una vez. */
export async function keySources(): Promise<Record<KeyProvider, KeySource>> {
  const jar = await cookies();
  const out = {} as Record<KeyProvider, KeySource>;

  for (const provider of KEY_PROVIDERS) {
    out[provider] = fromEnv(provider)
      ? "entorno"
      : jar.get(SLOTS[provider].cookie)?.value
        ? "dispositivo"
        : "ninguna";
  }
  return out;
}

/** El motor que el usuario prefiere, si guardó alguno. */
export async function preferredEngine(): Promise<KeyProvider | null> {
  const jar = await cookies();
  const value = jar.get(ENGINE_COOKIE)?.value;
  return isKeyProvider(value) ? value : null;
}

function cookieLine(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export function keyCookieHeader(provider: KeyProvider, key: string): string {
  return cookieLine(SLOTS[provider].cookie, key, MAX_AGE);
}

export function clearKeyCookie(provider: KeyProvider): string {
  return `${SLOTS[provider].cookie}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export function engineCookieHeader(provider: KeyProvider): string {
  return cookieLine(ENGINE_COOKIE, provider, MAX_AGE);
}

export const CLEAR_ENGINE_COOKIE = `${ENGINE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;

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

/* Compatibilidad con el código que solo conocía Google. */
export const GOOGLE_KEY_COOKIE = SLOTS.google.cookie;
export const resolveGoogleKey = () => resolveKey("google");
export const googleKeyAvailable = () => keyAvailable("google");
export const googleKeySource = () => keySource("google");
export const googleKeyFromEnv = () => fromEnv("google");
