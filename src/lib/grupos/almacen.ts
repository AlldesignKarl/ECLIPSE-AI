import { randomBytes, randomUUID } from "node:crypto";

import { currentUser, nombreActual } from "../auth";
import { del, get, set, storeAvailable } from "../store";
import {
  comoSeLeVe,
  estaDentro,
  MAX_GRUPOS,
  MAX_IMAGEN,
  MAX_IMAGENES,
  MAX_MENSAJES,
  MAX_PERSONAS,
  MODO_POR_DEFECTO,
  type Grupo,
  type MensajeGrupo,
  type ModoEclipse,
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
/** Cada foto en su propia clave: ver el comentario de `MensajeGrupo.imagen`. */
const claveImagen = (id: string) => `eclipse:grupo:foto:${id}`;

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

export async function crearGrupo(
  nombre: string,
  /** Si lleva día, es una quedada. Lo demás funciona exactamente igual. */
  quedada?: { fecha?: string; nota?: string },
): Promise<Grupo | null> {
  const email = await quien();
  if (!email) return null;
  if ((await misGrupos()).length >= MAX_GRUPOS) return null;

  const grupo: Grupo = {
    id: randomUUID(),
    nombre: nombre.slice(0, 50),
    creado: Date.now(),
    ...(quedada?.fecha ? { fecha: quedada.fecha } : {}),
    ...(quedada?.nota ? { nota: quedada.nota.slice(0, 300) } : {}),
    // 16 bytes al azar: adivinar una invitación tiene que ser imposible, no
    // difícil. Es la única llave que hay para entrar.
    invitacion: randomBytes(16).toString("base64url"),
    eclipse: MODO_POR_DEFECTO,
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
    await borrarSusFotos(id);
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

/**
 * Sacar a alguien de todos sus grupos. Para cuando borra la cuenta.
 *
 * Los grupos que se queden vacíos se borran enteros, igual que al salirse de
 * uno: un grupo sin nadie dentro es una conversación guardada que ya no puede
 * leer nadie.
 */
export async function salirDeTodos(email: string): Promise<void> {
  const ids = await leerLista<string>(claveMios(email));

  for (const id of ids) {
    const grupo = await grupoDe(id);
    if (!grupo) continue;

    grupo.miembros = grupo.miembros.filter((m) => m.email !== email);
    if (grupo.miembros.length === 0) {
      await borrarSusFotos(id);
      await del(clave(id));
      await del(claveMensajes(id));
      await del(claveInvitacion(grupo.invitacion));
      continue;
    }
    if (!grupo.miembros.some((m) => m.dueno)) grupo.miembros[0].dueno = true;
    await guardar(grupo);
  }

  await del(claveMios(email));
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

/**
 * Cómo está ECLIPSE en el grupo. Lo decide quien lo creó.
 *
 * Solo el dueño, y por lo mismo por lo que solo él invita o echa: ponerlo a
 * contestar a todo cambia la conversación para los veinte, no para quien toca
 * el botón.
 */
export async function cambiarEclipse(id: string, modo: ModoEclipse): Promise<boolean> {
  const email = await quien();
  if (!email) return false;

  const grupo = await grupoDe(id);
  if (!grupo || !grupo.miembros.some((m) => m.email === email && m.dueno)) return false;

  grupo.eclipse = modo;
  await guardar(grupo);
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
  const quedan = [...lista, nuevo].slice(-MAX_MENSAJES);

  /*
    Y las fotos de más, fuera de verdad.

    Un mensaje que se cae de la lista con una foto dentro dejaría su foto
    guardada para siempre, invisible y ocupando sitio. Se borran las que se han
    caído y las que pasan del tope, de la más vieja a la más nueva.
  */
  const vivas = new Set(quedan.map((m) => m.imagen).filter(Boolean));
  for (const m of lista) {
    if (m.imagen && !vivas.has(m.imagen)) await del(claveImagen(m.imagen)).catch(() => {});
  }

  const fotos = quedan.map((m) => m.imagen).filter((x): x is string => Boolean(x));
  const sobran = fotos.slice(0, Math.max(0, fotos.length - MAX_IMAGENES));
  for (const foto of sobran) await del(claveImagen(foto)).catch(() => {});

  await set(
    claveMensajes(id),
    JSON.stringify(
      quedan.map((m) => (m.imagen && sobran.includes(m.imagen) ? { ...m, imagen: undefined } : m)),
    ),
  );
  return nuevo;
}

export async function borrarGrupo(id: string): Promise<boolean> {
  const email = await quien();
  if (!email) return false;

  const grupo = await grupoDe(id);
  if (!grupo || !grupo.miembros.some((m) => m.email === email && m.dueno)) return false;

  // Las fotos primero: están en claves aparte y, si no se borran aquí, se
  // quedan en la base de datos para siempre sin que nadie pueda verlas ya.
  await borrarSusFotos(id);
  for (const m of grupo.miembros) await desapuntar(m.email, id);
  await del(clave(id));
  await del(claveMensajes(id));
  await del(claveInvitacion(grupo.invitacion));
  return true;
}

/* -------------------------------- Las fotos ------------------------------- */

/** Guarda la foto aparte y devuelve su nombre, que es lo que va al mensaje. */
export async function guardarImagen(grupoId: string, dataUrl: string): Promise<string | null> {
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) return null;
  if (dataUrl.length > MAX_IMAGEN) return null;

  const id = `${grupoId}:${randomUUID()}`;
  await set(claveImagen(id), dataUrl);
  return id;
}

export async function imagenDe(id: string): Promise<string | null> {
  const v = await get(claveImagen(id)).catch(() => null);
  return v ? String(v) : null;
}

/** Las fotos de un grupo, de la más vieja a la más nueva. */
async function fotosDelGrupo(id: string): Promise<string[]> {
  return (await mensajesDe(id)).map((m) => m.imagen).filter((x): x is string => Boolean(x));
}

async function borrarSusFotos(id: string): Promise<void> {
  for (const foto of await fotosDelGrupo(id)) await del(claveImagen(foto)).catch(() => {});
}

/**
 * Borrar un mensaje.
 *
 * Lo tuyo siempre; y quien creó el grupo puede quitar cualquiera, que es lo que
 * hace falta cuando alguien sube algo que no debía. Lo de ECLIPSE lo puede
 * quitar el dueño: es el único que no tiene a nadie que le defienda.
 */
export async function borrarMensaje(id: string, mensajeId: string): Promise<boolean> {
  const email = await quien();
  if (!email) return false;

  const grupo = await grupoDe(id);
  if (!grupo || !estaDentro(grupo, email)) return false;

  const lista = await mensajesDe(id);
  const mensaje = lista.find((m) => m.id === mensajeId);
  if (!mensaje) return false;

  const esDueno = grupo.miembros.some((m) => m.email === email && m.dueno);
  if (mensaje.de !== email && !esDueno) return false;

  // La foto se va con él: dejarla guardada es guardar lo que alguien acaba de
  // pedir que se borre.
  if (mensaje.imagen) await del(claveImagen(mensaje.imagen)).catch(() => {});
  await set(claveMensajes(id), JSON.stringify(lista.filter((m) => m.id !== mensajeId)));
  return true;
}
