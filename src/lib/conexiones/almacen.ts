import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { currentUser } from "../auth";
import { del, get, set, storeAvailable } from "../store";
import type { Credenciales, Permiso } from "./tipos";

/**
 * Dónde viven las claves de las conexiones.
 *
 * En la base de datos, cifradas, y colgando de la cuenta de cada uno. No en una
 * cookie como la clave del motor: aquella es de un dispositivo y se puede
 * volver a pegar en un minuto; esta es la llave de la tienda de la que alguien
 * vive, y tiene que seguirle del móvil al ordenador sin que la vuelva a tocar.
 *
 * Cifrado de verdad —AES-256-GCM— y no una codificación que lo parezca. La
 * diferencia importa el día que alguien mire la base de datos: con base64 se
 * lee todo, con esto no se lee nada sin la clave del servidor. Y GCM además
 * detecta si alguien ha manipulado el texto guardado, que con AES a secas
 * pasaría inadvertido.
 *
 * La clave de cifrado sale de AUTH_SECRET, que es el mismo secreto con el que
 * se firman las sesiones. Si ese secreto cambia, las conexiones guardadas dejan
 * de poder abrirse: se tratan como ausentes y se vuelven a conectar. Es lo
 * correcto —es exactamente lo que pasa cuando una llave ya no abre— y por eso
 * descifrar nunca lanza, solo devuelve nada.
 */

interface Guardada {
  servicio: string;
  cuenta: string;
  permiso: Permiso;
  conectadoEl: number;
  /** El sobre cifrado: iv, etiqueta de autenticidad y contenido, en base64url. */
  sobre: string;
}

function secreto(): Buffer {
  const base =
    process.env.AUTH_SECRET ||
    process.env.PRO_SECRET ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    "eclipse-dev-secret";
  // El secreto es un texto de longitud cualquiera; AES-256 pide 32 bytes justos.
  return createHash("sha256").update(`conexiones:${base}`).digest();
}

function cerrar(cred: Credenciales): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", secreto(), iv);
  const cuerpo = Buffer.concat([
    cifrador.update(JSON.stringify(cred), "utf8"),
    cifrador.final(),
  ]);
  return [iv, cifrador.getAuthTag(), cuerpo].map((b) => b.toString("base64url")).join(".");
}

function abrir(sobre: string): Credenciales | null {
  const partes = sobre.split(".");
  if (partes.length !== 3) return null;
  try {
    const [iv, etiqueta, cuerpo] = partes.map((p) => Buffer.from(p, "base64url"));
    const descifrador = createDecipheriv("aes-256-gcm", secreto(), iv);
    descifrador.setAuthTag(etiqueta);
    const claro = Buffer.concat([descifrador.update(cuerpo), descifrador.final()]).toString("utf8");
    const v = JSON.parse(claro) as unknown;
    return v && typeof v === "object" ? (v as Credenciales) : null;
  } catch {
    // Secreto cambiado, texto tocado o basura: la llave no abre, y punto.
    return null;
  }
}

function clave(email: string, servicio: string): string {
  return `eclipse:conexion:${email}:${servicio}`;
}

/** El índice de qué servicios tiene conectados esta persona. */
function claveIndice(email: string): string {
  return `eclipse:conexiones:${email}`;
}

/** ¿Se pueden guardar conexiones en este servidor? */
export function almacenListo(): boolean {
  return storeAvailable();
}

/**
 * Quién pregunta, sin poder tumbar nada.
 *
 * `currentUser` lee cookies, y fuera del ciclo de una petición pedir cookies no
 * devuelve vacío: lanza. Esto se llama ahora al montar las herramientas de cada
 * mensaje, así que una excepción aquí no sería "no hay conexiones": sería la
 * conversación entera caída. Y no saber quién eres es, a todos los efectos, no
 * tener ninguna conexión.
 */
async function quien(): Promise<string | null> {
  if (!storeAvailable()) return null;
  try {
    return await currentUser();
  } catch {
    return null;
  }
}

async function leerIndice(email: string): Promise<string[]> {
  try {
    const raw = await get(claveIndice(email));
    if (!raw) return [];
    const v = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function escribirIndice(email: string, servicios: string[]): Promise<void> {
  await set(claveIndice(email), JSON.stringify([...new Set(servicios)]));
}

async function leerGuardada(email: string, servicio: string): Promise<Guardada | null> {
  try {
    const raw = await get(clave(email, servicio));
    if (!raw) return null;
    const v = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as Guardada;
    return v && typeof v === "object" && typeof v.sobre === "string" ? v : null;
  } catch {
    return null;
  }
}

/** Lo que se puede contar de una conexión sin enseñar ni un carácter de la clave. */
export interface Resumen {
  servicio: string;
  cuenta: string;
  permiso: Permiso;
  conectadoEl: number;
}

/**
 * Las conexiones de quien está usando la aplicación ahora mismo.
 *
 * O las de un correo concreto, que es lo que hace falta cuando NO hay nadie
 * delante. Un encargo programado lo dispara el reloj a las cuatro de la mañana:
 * ahí no hay cookie que leer, así que `quien()` devolvía null y esto devolvía
 * una lista vacía. Y una lista vacía significa "no tienes nada conectado", con
 * lo cual el encargo de "mírame las ventas de la tienda" se ejecutaba SIN la
 * tienda y el parte salía inventado. Ese era el fallo, y de ahí sale el dueño
 * explícito de aquí.
 */
export async function misConexiones(deQuien?: string): Promise<Resumen[]> {
  const email = deQuien ?? (await quien());
  if (!email) return [];

  const ids = await leerIndice(email);
  const todas = await Promise.all(ids.map((id) => leerGuardada(email, id)));
  return todas
    .filter((g): g is Guardada => g !== null)
    .map(({ servicio, cuenta, permiso, conectadoEl }) => ({
      servicio,
      cuenta,
      permiso,
      conectadoEl,
    }));
}

/**
 * Borrar TODAS las conexiones de alguien, con sus claves.
 *
 * Solo lo usa el borrado de cuenta. Si alguien se va, sus credenciales de
 * Shopify o de Stripe no pueden quedarse aquí: son las llaves de su negocio.
 */
export async function olvidarTodasLasDe(email: string): Promise<void> {
  for (const servicio of await leerIndice(email)) await del(clave(email, servicio));
  await del(claveIndice(email));
}

/** Las credenciales de un servicio, para usarlas y no para enseñarlas. */
export async function credencialesDe(
  servicio: string,
  /** El dueño, cuando no hay nadie delante (un encargo programado). */
  deQuien?: string,
): Promise<{ cred: Credenciales; permiso: Permiso } | null> {
  const email = deQuien ?? (await quien());
  if (!email) return null;

  const guardada = await leerGuardada(email, servicio);
  if (!guardada) return null;

  const cred = abrir(guardada.sobre);
  return cred ? { cred, permiso: guardada.permiso } : null;
}

/** Guardar una conexión ya comprobada. */
export async function guardarConexion(
  servicio: string,
  cred: Credenciales,
  cuenta: string,
  permiso: Permiso,
  /** El dueño, si no es quien está usando la aplicación ahora mismo. */
  deQuien?: string,
): Promise<boolean> {
  const email = deQuien ?? (await quien());
  if (!email) return false;

  const guardada: Guardada = {
    servicio,
    cuenta,
    permiso,
    conectadoEl: Date.now(),
    sobre: cerrar(cred),
  };
  await set(clave(email, servicio), JSON.stringify(guardada));
  await escribirIndice(email, [...(await leerIndice(email)), servicio]);
  return true;
}

/** Cambiar solo el permiso, sin volver a pedir la clave. */
export async function cambiarPermiso(servicio: string, permiso: Permiso): Promise<boolean> {
  const email = await quien();
  if (!email) return false;

  const guardada = await leerGuardada(email, servicio);
  if (!guardada) return false;

  await set(clave(email, servicio), JSON.stringify({ ...guardada, permiso }));
  return true;
}

/**
 * Desconectar.
 *
 * Se borra el sobre entero, no se marca como inactivo: una clave que ya no se
 * usa y sigue guardada es una clave esperando a filtrarse. Quien desconecta
 * quiere que no quede nada, y no queda nada.
 */
export async function olvidarConexion(servicio: string): Promise<boolean> {
  const email = await quien();
  if (!email) return false;

  await del(clave(email, servicio));
  await escribirIndice(
    email,
    (await leerIndice(email)).filter((s) => s !== servicio),
  );
  return true;
}
