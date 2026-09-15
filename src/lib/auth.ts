import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { del, get, set, setIfAbsent, storeAvailable, StoreError } from "./store";

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
  /** Cómo quiere que le llamen. Lo elige al crear la cuenta. */
  nombre?: string;
  /**
   * Su foto, ya recortada y pequeña, como `data:image/jpeg;base64,…`.
   *
   * Guardada en la cuenta y no en el móvil porque una foto de perfil que solo
   * se ve en el móvil donde la pusiste no es una foto de perfil: es un adorno.
   * Se recorta y se encoge en el navegador antes de mandarla, así que lo que
   * llega aquí son unos kilobytes y no la foto de doce megapíxeles.
   */
  foto?: string;
  /**
   * Ha apagado la memoria a propósito.
   *
   * Va en la cuenta y no en una cookie porque la memoria la lee el servidor
   * cuando contesta, y porque apagarla en un móvil y que siga encendida en el
   * siguiente no es apagarla.
   */
  sinMemoria?: boolean;
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

/**
 * El nombre, dejado en condiciones de escribirlo en una frase.
 *
 * Se recorta a algo corto y se le quitan los saltos de línea y lo que no sea
 * un nombre: esto acaba dentro de las instrucciones del modelo, y un "nombre"
 * de tres párrafos ahí dentro no es un nombre, es otra cosa.
 */
export function limpiarNombre(raw: string): string {
  return raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[<>{}[\]`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

export type AuthResult =
  | { ok: true; email: string; nombre?: string }
  | { ok: false; error: string };

export async function signUp(
  rawEmail: string,
  password: string,
  rawNombre = "",
): Promise<AuthResult> {
  const email = normalizeEmail(rawEmail);
  if (!emailLooksValid(email)) return { ok: false, error: "Ese correo no parece válido." };

  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };

  const nombre = limpiarNombre(rawNombre);
  const salt = randomBytes(16).toString("hex");
  const user: User = {
    email,
    salt,
    hash: hash(password, salt),
    createdAt: Date.now(),
    ...(nombre ? { nombre } : {}),
  };

  try {
    const created = await setIfAbsent(key(email), JSON.stringify(user));
    if (!created)
      return { ok: false, error: "Ya hay una cuenta con ese correo. Entra en vez de crearla." };
  } catch (err) {
    return { ok: false, error: err instanceof StoreError ? err.message : "No se ha podido crear la cuenta." };
  }

  return { ok: true, email, ...(nombre ? { nombre } : {}) };
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

  return samePassword(password, user.salt, user.hash)
    ? { ok: true, email, ...(user.nombre ? { nombre: user.nombre } : {}) }
    : wrong;
}

/* -------------------------------- Nombre -------------------------------- */

async function leerUsuario(email: string): Promise<User | null> {
  let raw: string | null;
  try {
    raw = await get(key(email));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return typeof raw === "string" ? (JSON.parse(raw) as User) : (raw as User);
  } catch {
    return null;
  }
}

/** Cómo quiere que le llamen quien está usando la app ahora mismo. */
export async function nombreActual(): Promise<string> {
  const email = await currentUser();
  if (!email) return "";
  return (await leerUsuario(email))?.nombre ?? "";
}

/**
 * Cambiarlo después.
 *
 * Hace falta porque al añadir esto ya había cuentas creadas, y a esas nadie
 * les preguntó nada: sin esta puerta, quien se registró antes se quedaba para
 * siempre sin nombre. Y porque uno cambia de idea sobre cómo quiere que le
 * llamen, que es justo la clase de cosa que tiene que poder cambiarse.
 */
export async function guardarNombre(rawNombre: string): Promise<string | null> {
  const email = await currentUser();
  if (!email) return null;
  const user = await leerUsuario(email);
  if (!user) return null;

  const nombre = limpiarNombre(rawNombre);
  try {
    await set(key(email), JSON.stringify({ ...user, nombre: nombre || undefined }));
  } catch {
    return null;
  }
  return nombre;
}

/* -------------------------------- Perfil -------------------------------- */

export interface Perfil {
  nombre: string;
  foto: string;
  memoria: boolean;
  desde: number;
}

/** Lo que hay que enseñar en Ajustes de quien está dentro. */
export async function perfilActual(): Promise<Perfil | null> {
  const email = await currentUser();
  if (!email) return null;
  const user = await leerUsuario(email);
  if (!user) return null;

  return {
    nombre: user.nombre ?? "",
    foto: user.foto ?? "",
    memoria: user.sinMemoria !== true,
    desde: user.createdAt,
  };
}

/** ¿Tiene la memoria apagada esta persona? */
export async function memoriaApagada(email: string): Promise<boolean> {
  return (await leerUsuario(email))?.sinMemoria === true;
}

/** Tope de la foto ya encogida. Más que esto no es una foto, es un descuido. */
export const MAX_FOTO = 300_000;

export async function guardarPerfil(cambios: {
  nombre?: string;
  foto?: string | null;
  memoria?: boolean;
}): Promise<Perfil | null> {
  const email = await currentUser();
  if (!email) return null;
  const user = await leerUsuario(email);
  if (!user) return null;

  const actualizado: User = { ...user };

  if (typeof cambios.nombre === "string") {
    const nombre = limpiarNombre(cambios.nombre);
    actualizado.nombre = nombre || undefined;
  }

  if (cambios.foto === null) actualizado.foto = undefined;
  else if (typeof cambios.foto === "string" && cambios.foto) {
    // Solo imágenes, y pequeñas. Lo que entra aquí se le sirve después a otras
    // personas en un grupo, así que no puede ser cualquier cosa con un `data:`
    // delante.
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(cambios.foto)) return null;
    if (cambios.foto.length > MAX_FOTO) return null;
    actualizado.foto = cambios.foto;
  }

  if (typeof cambios.memoria === "boolean") actualizado.sinMemoria = cambios.memoria ? undefined : true;

  try {
    await set(key(email), JSON.stringify(actualizado));
  } catch {
    return null;
  }

  return {
    nombre: actualizado.nombre ?? "",
    foto: actualizado.foto ?? "",
    memoria: actualizado.sinMemoria !== true,
    desde: actualizado.createdAt,
  };
}

/**
 * Cambiar la contraseña, pidiendo la de antes.
 *
 * Pedir la actual no es burocracia: sin eso, cualquiera que pille un móvil
 * desbloqueado se queda con la cuenta cambiándola en dos toques.
 */
export async function cambiarContrasena(
  actual: string,
  nueva: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = await currentUser();
  if (!email) return { ok: false, error: "Hay que haber entrado con tu cuenta." };

  const user = await leerUsuario(email);
  if (!user) return { ok: false, error: "No se ha encontrado la cuenta." };

  if (!samePassword(actual, user.salt, user.hash))
    return { ok: false, error: "La contraseña de ahora no es esa." };

  const problema = passwordProblem(nueva);
  if (problema) return { ok: false, error: problema };

  // Sal nueva también: la vieja ya no tiene por qué seguir ahí.
  const salt = randomBytes(16).toString("hex");
  try {
    await set(key(email), JSON.stringify({ ...user, salt, hash: hash(nueva, salt) }));
  } catch {
    return { ok: false, error: "No se ha podido guardar. Inténtalo otra vez." };
  }
  return { ok: true };
}

/** ¿Es esta su contraseña? Para lo que no tiene vuelta atrás. */
export async function contrasenaCorrecta(password: string): Promise<boolean> {
  const email = await currentUser();
  if (!email) return false;
  const user = await leerUsuario(email);
  return Boolean(user && samePassword(password, user.salt, user.hash));
}

/** Borrar la cuenta en sí. Lo demás que es suyo se borra en `cuenta.ts`. */
export async function borrarUsuario(email: string): Promise<void> {
  await del(key(email));
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
