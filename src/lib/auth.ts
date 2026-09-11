import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { get, setIfAbsent, storeAvailable, StoreError } from "./store";

/**
 * Correo y contraseña.
 *
 * La contraseña nunca se guarda: se guarda su huella con scrypt, que es lenta a
 * propósito para que no sirva de nada robarse la base de datos. La sesión va en
 * una cookie firmada, así que comprobar quién eres no cuesta ni una consulta.
 */

export const SESSION_COOKIE = "eclipse_session";
const SESSION_DAYS = 30;
const MAX_AGE = 60 * 60 * 24 * SESSION_DAYS;

export { storeAvailable as authAvailable };

function secret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.PRO_SECRET ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    "eclipse-dev-secret"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/* ------------------------------ Contraseñas ----------------------------- */

function hash(password: string, salt: string): string {
  return scryptSync(password.normalize("NFKC"), salt, 64).toString("hex");
}

function samePassword(password: string, salt: string, expected: string): boolean {
  const actual = hash(password, salt);
  if (actual.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}

/* -------------------------------- Usuarios ------------------------------ */

interface User {
  email: string;
  salt: string;
  hash: string;
  createdAt: number;
}

function key(email: string): string {
  return `eclipse:user:${email}`;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) && email.length <= 254;
}

/** Qué le falta a la contraseña para valer. `null` si está bien. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "La contraseña necesita al menos 8 caracteres.";
  if (password.length > 200) return "Esa contraseña es demasiado larga.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))
    return "Mezcla letras y números: así es mucho más difícil de adivinar.";
  return null;
}

export type AuthResult = { ok: true; email: string } | { ok: false; error: string };

export async function signUp(rawEmail: string, password: string): Promise<AuthResult> {
  const email = normalizeEmail(rawEmail);
  if (!emailLooksValid(email)) return { ok: false, error: "Ese correo no parece válido." };

  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };

  const salt = randomBytes(16).toString("hex");
  const user: User = { email, salt, hash: hash(password, salt), createdAt: Date.now() };

  try {
    const created = await setIfAbsent(key(email), JSON.stringify(user));
    if (!created)
      return { ok: false, error: "Ya hay una cuenta con ese correo. Entra en vez de crearla." };
  } catch (err) {
    return { ok: false, error: err instanceof StoreError ? err.message : "No se ha podido crear la cuenta." };
  }

  return { ok: true, email };
}

export async function signIn(rawEmail: string, password: string): Promise<AuthResult> {
  const email = normalizeEmail(rawEmail);
  const wrong = { ok: false as const, error: "El correo o la contraseña no son correctos." };
  if (!emailLooksValid(email) || !password) return wrong;

  let raw: string | null;
  try {
    raw = await get(key(email));
  } catch (err) {
    return { ok: false, error: err instanceof StoreError ? err.message : "No se ha podido entrar." };
  }
  if (!raw) return wrong;

  let user: User;
  try {
    user = typeof raw === "string" ? (JSON.parse(raw) as User) : (raw as User);
  } catch {
    return wrong;
  }

  return samePassword(password, user.salt, user.hash) ? { ok: true, email } : wrong;
}

/* -------------------------------- Sesión -------------------------------- */

function issue(email: string): string {
  const exp = String(Date.now() + MAX_AGE * 1000);
  const payload = `${Buffer.from(email).toString("base64url")}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function read(token: string | undefined): string | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encoded, exp, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return null;

  const expected = sign(`${encoded}.${exp}`);
  if (expected.length !== sig.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  } catch {
    return null;
  }

  const email = Buffer.from(encoded, "base64url").toString();
  return emailLooksValid(email) ? email : null;
}

/** Quién está usando la app ahora mismo, o `null` si no ha entrado nadie. */
export async function currentUser(): Promise<string | null> {
  if (!storeAvailable()) return null;
  const jar = await cookies();
  return read(jar.get(SESSION_COOKIE)?.value);
}

export function sessionCookieHeader(email: string): string {
  return `${SESSION_COOKIE}=${issue(email)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export const CLEAR_SESSION_COOKIE = `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
