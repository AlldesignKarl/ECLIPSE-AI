import { randomUUID } from "node:crypto";

import { currentUser } from "../auth";
import { del, get, set, storeAvailable } from "../store";
import {
  MAX_EXAMENES,
  MAX_INTENTOS,
  MAX_MATERIALES,
  type Examen,
  type Intento,
  type Material,
} from "./tipos";

/**
 * Dónde viven los exámenes.
 *
 * En el servidor y colgando de la cuenta, no en el móvil. Esto no es una
 * conversación: son los apuntes de alguien y su progreso, y se estudia desde el
 * móvil en el autobús y desde el ordenador en casa. Guardarlo en el navegador
 * sería perderlo al cambiar de aparato, o al limpiar la caché la semana de
 * exámenes.
 *
 * Cada examen va en su propia clave y aparte de su índice. El extracto de los
 * materiales puede ocupar bastante, y la lista de "mis exámenes" se pide cada
 * vez que se abre la pantalla: si todo estuviera junto, abrir la lista se
 * traería los apuntes enteros de veinte exámenes para enseñar veinte títulos.
 */

function claveIndice(email: string): string {
  return `eclipse:examenes:${email}`;
}
function clave(email: string, id: string): string {
  return `eclipse:examen:${email}:${id}`;
}

export function examenesListos(): boolean {
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

export async function examenDe(email: string, id: string): Promise<Examen | null> {
  try {
    const raw = await get(clave(email, id));
    if (!raw) return null;
    const v = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as Examen;
    return v && typeof v === "object" && v.id ? v : null;
  } catch {
    return null;
  }
}

export async function guardar(email: string, examen: Examen): Promise<void> {
  await set(clave(email, examen.id), JSON.stringify(examen));
  const indice = await leerIndice(email);
  if (!indice.includes(examen.id))
    await set(claveIndice(email), JSON.stringify([examen.id, ...indice].slice(0, MAX_EXAMENES)));
}

/** Mis exámenes, del más nuevo al más viejo. */
export async function misExamenes(email: string): Promise<Examen[]> {
  const ids = await leerIndice(email);
  const todos = await Promise.all(ids.map((id) => examenDe(email, id)));
  return todos.filter((e): e is Examen => e !== null).sort((a, b) => b.creado - a.creado);
}

export async function crearExamen(
  email: string,
  datos: { asignatura: string; titulo: string; fecha?: string; temas: string[]; extra?: string },
): Promise<Examen> {
  const examen: Examen = {
    id: randomUUID().slice(0, 8),
    asignatura: datos.asignatura,
    titulo: datos.titulo,
    fecha: datos.fecha,
    temas: datos.temas,
    extra: datos.extra,
    materiales: [],
    mapa: [],
    extracto: [],
    intentos: [],
    creado: Date.now(),
  };
  await guardar(email, examen);
  return examen;
}

export async function borrarExamen(email: string, id: string): Promise<void> {
  await del(clave(email, id));
  const indice = await leerIndice(email);
  await set(claveIndice(email), JSON.stringify(indice.filter((x) => x !== id)));
}

/**
 * Apuntar un material.
 *
 * El archivo en sí NO se guarda, y es a propósito: una foto de apuntes son
 * cientos de kilobytes, veinte fotos son varios megas, y lo que hace falta
 * después no es la foto, es lo que ponía. Se lee al subirla, se guarda el
 * extracto —que es lo que se usa para todo— y la foto no vuelve a hacer falta.
 * Así el examen entero pesa lo que pesa un texto.
 */
export async function apuntarMaterial(
  email: string,
  id: string,
  material: Material,
): Promise<Examen | null> {
  const examen = await examenDe(email, id);
  if (!examen) return null;
  if (examen.materiales.length >= MAX_MATERIALES) return examen;

  examen.materiales.push(material);
  await guardar(email, examen);
  return examen;
}

export async function apuntarIntento(
  email: string,
  id: string,
  intento: Intento,
): Promise<Examen | null> {
  const examen = await examenDe(email, id);
  if (!examen) return null;

  examen.intentos = [intento, ...examen.intentos].slice(0, MAX_INTENTOS);
  await guardar(email, examen);
  return examen;
}

/** Borrar todos los exámenes de alguien. Lo usa el borrado de cuenta. */
export async function olvidarExamenesDe(email: string): Promise<void> {
  for (const id of await leerIndice(email)) await del(clave(email, id)).catch(() => {});
  await del(claveIndice(email)).catch(() => {});
}
