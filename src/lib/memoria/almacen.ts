import { randomUUID } from "node:crypto";

import { currentUser } from "../auth";
import { del, get, set, storeAvailable } from "../store";
import {
  fundir,
  MAX_RESUMENES,
  type Hecho,
  type Resumen,
} from "./tipos";

/**
 * Dónde vive la memoria.
 *
 * En el servidor, y aquí sí hace falta explicarlo: las conversaciones de
 * ECLIPSE se guardan en el móvil de cada uno a propósito, y esto rompe esa
 * regla. La rompe por poco y con condiciones: NO se guarda una sola
 * conversación, se guardan frases sueltas de lo que se sabe de alguien y el
 * tema de cada charla en dos líneas. Sin eso no hay forma de que la aplicación
 * sepa hoy lo que le contaste el martes desde otro móvil.
 *
 * Y con tres frenos: se puede apagar, se puede ver entero, y se puede borrar
 * de un botón. Una memoria que no se puede mirar ni borrar no es memoria, es
 * vigilancia.
 */

function claveHechos(email: string): string {
  return `eclipse:memoria:${email}`;
}
function claveResumenes(email: string): string {
  return `eclipse:memoria:temas:${email}`;
}
/** Cuándo se aprendió de cada conversación, para no repetir el trabajo. */
function claveVisto(email: string): string {
  return `eclipse:memoria:visto:${email}`;
}

async function leerLista<T>(clave: string): Promise<T[]> {
  try {
    const raw = await get(clave);
    if (!raw) return [];
    const v = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as unknown;
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export function memoriaLista(): boolean {
  return storeAvailable();
}

export async function quien(): Promise<string | null> {
  if (!storeAvailable()) return null;
  try {
    return await currentUser();
  } catch {
    return null;
  }
}

/* --------------------------------- Hechos -------------------------------- */

export async function hechosDe(email: string): Promise<Hecho[]> {
  return leerLista<Hecho>(claveHechos(email));
}

export async function guardarHechos(email: string, hechos: Hecho[]): Promise<void> {
  if (hechos.length) await set(claveHechos(email), JSON.stringify(hechos));
  else await del(claveHechos(email));
}

/** Aprender frases nuevas, fundiendo las que ya decían lo mismo. */
export async function aprenderHechos(email: string, frases: string[]): Promise<Hecho[]> {
  let hechos = await hechosDe(email);
  for (const texto of frases) {
    const limpio = texto.trim();
    if (!limpio) continue;
    hechos = fundir(hechos, { id: randomUUID(), texto: limpio, cuando: Date.now() });
  }
  await guardarHechos(email, hechos);
  return hechos;
}

export async function olvidarHecho(email: string, id: string): Promise<void> {
  await guardarHechos(email, (await hechosDe(email)).filter((h) => h.id !== id));
}

/* ------------------------------- Resúmenes ------------------------------- */

export async function resumenesDe(email: string): Promise<Resumen[]> {
  return leerLista<Resumen>(claveResumenes(email));
}

/**
 * Apunta de qué fue una conversación.
 *
 * Si ya había uno de la misma conversación, se sustituye: lo que interesa es
 * en qué quedó, no en qué iba por la mitad.
 */
export async function apuntarResumen(
  email: string,
  resumen: { id: string; titulo: string; texto: string },
): Promise<void> {
  const lista = await resumenesDe(email);
  const sinEse = lista.filter((r) => r.id !== resumen.id);
  const nueva = [{ ...resumen, cuando: Date.now() }, ...sinEse].slice(0, MAX_RESUMENES);
  await set(claveResumenes(email), JSON.stringify(nueva));
}

/* ------------------------- No repetir el trabajo ------------------------- */

/**
 * ¿Hace falta volver a aprender de esta conversación?
 *
 * Aprender cuesta una llamada al modelo. Si alguien escribe diez mensajes
 * seguidos, aprender diez veces de lo mismo es tirar diez veces su cuota. Se
 * apunta cuántos mensajes tenía la última vez y cuándo fue.
 */
export async function tocaAprender(
  email: string,
  conversacion: string,
  mensajes: number,
  /** Cada cuántos mensajes nuevos merece la pena volver a mirar. */
  cada = 6,
): Promise<boolean> {
  const visto = (await leerLista<{ id: string; mensajes: number }>(claveVisto(email))) ?? [];
  const antes = visto.find((v) => v.id === conversacion);
  if (!antes) return mensajes >= 2;
  return mensajes - antes.mensajes >= cada;
}

export async function anotarVisto(
  email: string,
  conversacion: string,
  mensajes: number,
): Promise<void> {
  const visto = await leerLista<{ id: string; mensajes: number }>(claveVisto(email));
  const sinEsa = visto.filter((v) => v.id !== conversacion);
  await set(claveVisto(email), JSON.stringify([{ id: conversacion, mensajes }, ...sinEsa].slice(0, 200)));
}

/* --------------------------------- Borrar -------------------------------- */

/** Todo. Y de verdad: no queda nada que se pueda leer después. */
export async function olvidarTodo(email: string): Promise<void> {
  await del(claveHechos(email));
  await del(claveResumenes(email));
  await del(claveVisto(email));
}
