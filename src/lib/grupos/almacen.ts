import { randomBytes, randomUUID } from "node:crypto";

import { currentUser, nombreActual } from "../auth";
import { del, get, set, storeAvailable } from "../store";
import {
  comoSeLeVe,
  estaDentro,
  MAX_GRUPOS,
  MAX_MENSAJES,
  MAX_PERSONAS,
  type Grupo,
  type MensajeGrupo,
} from "./tipos";

/**
 * Dónde viven los grupos.
 *
 * En la base de datos, obviamente: un grupo es de varias personas y no puede
 * estar en el móvil de una. Esto rompe la regla de "las conversaciones se
 * quedan en tu dispositivo" que ECLIPSE cumple en todo lo demás, y por eso se
 * dice en la pantalla al crear uno: lo que se escribe en un grupo lo ve todo el
 * grupo y se guarda en el servidor. Quien no quiera eso, tiene el chat normal
 * y el temporal.
 */

const clave = (id: string) => `eclipse:grupo:${id}`;
const claveMensajes = (id: string) => `eclipse:grupo:mensajes:${id}`;
const claveMios = (email: string) => `eclipse:grupos:${email}`;
/** De la invitación al grupo, para poder entrar solo con el enlace. */
const claveInvitacion = (codigo: string) => `eclipse:invitacion:${codigo}`;

async function leer<T>(k: string): Promise<T | null> {
  try {
    const raw = await get(k);
    if (!raw) return null;
    return JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as T;
  } catch {
    return null;
  }
}

async function leerLista<T>(k: string): Promise<T[]> {
  const v = await leer<T[]>(k);
  return Array.isArray(v) ? v : [];
}

export function gruposListos(): boolean {
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

export async function grupoDe(id: string): Promise<Grupo | null> {
  return leer<Grupo>(clave(id));
}

async function guardar(grupo: Grupo): Promise<void> {
  await set(clave(grupo.id), JSON.stringify(grupo));
}

/** Los grupos en los que está esta persona. */
export async function misGrupos(): Promise<Grupo[]> {
  const email = await quien();
  if (!email) return [];

  const ids = await leerLista<string>(claveMios(email));
  const todos = await Promise.all(ids.map((id) => grupoDe(id)));
  // Los que ya no existen, o de los que le han echado, se caen de la lista.
  return todos.filter((g): g is Grupo => g !== null && estaDentro(g, email));
}

async function apuntar(email: string, id: string): Promise<void> {
  const ids = await leerLista<string>(claveMios(email));
  if (!ids.includes(id)) await set(claveMios(email), JSON.stringify([...ids, id]));
}

async function desapuntar(email: string, id: string): Promise<void> {
  const ids = await leerLista<string>(claveMios(email));
  await set(claveMios(email), JSON.stringify(ids.filter((x) => x !== id)));
}

export async function crearGrupo(nombre: string): Promise<Grupo | null> {
  const email = await quien();
  if (!email) return null;
  if ((await misGrupos()).length >= MAX_GRUPOS) return null;

  const grupo: Grupo = {
    id: randomUUID(),
    nombre: nombre.slice(0, 50),
    creado: Date.now(),
    // 16 bytes al azar: adivinar una invitación tiene que ser imposible, no
    // difícil. Es la única llave que hay para entrar.
    invitacion: randomBytes(16).toString("base64url"),
    miembros: [
      {
        email,
        nombre: comoSeLeVe(email, await nombreActual()),
        dueno: true,
        entro: Date.now(),
      },
    ],
  };

  await guardar(grupo);
  await set(claveInvitacion(grupo.invitacion), grupo.id);
  await apuntar(email, grupo.id);
  return grupo;
}

/** A qué grupo lleva una invitación. */
export async function grupoDeInvitacion(codigo: string): Promise<Grupo | null> {
  const id = await get(claveInvitacion(codigo)).catch(() => null);
  return id ? grupoDe(String(id)) : null;
}

export type Entrada =
  | { ok: true; grupo: Grupo; yaEstaba: boolean }
  | { ok: false; error: string };

export async function entrarConInvitacion(codigo: string): Promise<Entrada> {
  const email = await quien();
  if (!email) return { ok: false, error: "Hay que entrar con tu cuenta para unirte a un grupo." };

  const grupo = await grupoDeInvitacion(codigo);
  if (!grupo) return { ok: false, error: "Esa invitación ya no vale." };

  if (estaDentro(grupo, email)) {
    await apuntar(email, grupo.id);
    return { ok: true, grupo, yaEstaba: true };
  }

  if (grupo.miembros.length >= MAX_PERSONAS)
    return { ok: false, error: `El grupo está lleno: caben ${MAX_PERSONAS} personas.` };

  grupo.miembros.push({
    email,
    nombre: comoSeLeVe(email, await nombreActual()),
    dueno: false,
    entro: Date.now(),
  });
  await guardar(grupo);
  await apuntar(email, grupo.id);
  return { ok: true, grupo, yaEstaba: false };
}

/** Salirse. Al último que apaga la luz se le borra el grupo entero. */
export async function salirse(id: string): Promise<boolean> {
  const email = await quien();
  if (!email) return false;

  const grupo = await grupoDe(id);
  if (!grupo) return false;

  grupo.miembros = grupo.miembros.filter((m) => m.email !== email);
  await desapuntar(email, id);

  if (grupo.miembros.length === 0) {
    await del(clave(id));
    await del(claveMensajes(id));
    await del(claveInvitacion(grupo.invitacion));
    return true;
  }

  // Si se va el dueño, manda el siguiente que lleve más tiempo: un grupo sin
  // nadie que pueda administrarlo se queda a medias para siempre.
  if (!grupo.miembros.some((m) => m.dueno)) grupo.miembros[0].dueno = true;
  await guardar(grupo);
  return true;
}

/** Echar a alguien. Solo el dueño, y nunca a sí mismo. */
export async function echar(id: string, aQuien: string): Promise<boolean> {
  const email = await quien();
  if (!email) return false;

  const grupo = await grupoDe(id);
  if (!grupo || !grupo.miembros.some((m) => m.email === email && m.dueno)) return false;
  if (aQuien === email) return false;

  grupo.miembros = grupo.miembros.filter((m) => m.email !== aQuien);
  await guardar(grupo);
  await desapuntar(aQuien, id);
  return true;
}

/** Cambiar la invitación: la anterior deja de valer al momento. */
export async function renovarInvitacion(id: string): Promise<string | null> {
  const email = await quien();
  if (!email) return null;

  const grupo = await grupoDe(id);
  if (!grupo || !grupo.miembros.some((m) => m.email === email && m.dueno)) return null;

  await del(claveInvitacion(grupo.invitacion));
  grupo.invitacion = randomBytes(16).toString("base64url");
  await set(claveInvitacion(grupo.invitacion), grupo.id);
  await guardar(grupo);
  return grupo.invitacion;
}

/* ------------------------------ Los mensajes ----------------------------- */

export async function mensajesDe(id: string): Promise<MensajeGrupo[]> {
  return leerLista<MensajeGrupo>(claveMensajes(id));
}

export async function apuntarMensaje(
  id: string,
  mensaje: Omit<MensajeGrupo, "id" | "cuando">,
): Promise<MensajeGrupo> {
  const lista = await mensajesDe(id);
  const nuevo: MensajeGrupo = { ...mensaje, id: randomUUID(), cuando: Date.now() };
  // Los últimos al final, y se tira lo más viejo: un grupo que lleva un año
  // abierto no puede crecer sin fin.
  await set(claveMensajes(id), JSON.stringify([...lista, nuevo].slice(-MAX_MENSAJES)));
  return nuevo;
}

export async function borrarGrupo(id: string): Promise<boolean> {
  const email = await quien();
  if (!email) return false;

  const grupo = await grupoDe(id);
  if (!grupo || !grupo.miembros.some((m) => m.email === email && m.dueno)) return false;

  for (const m of grupo.miembros) await desapuntar(m.email, id);
  await del(clave(id));
  await del(claveMensajes(id));
  await del(claveInvitacion(grupo.invitacion));
  return true;
}
