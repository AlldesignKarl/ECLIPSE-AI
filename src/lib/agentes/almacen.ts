import { randomUUID } from "node:crypto";

import { currentUser } from "../auth";
import { del, get, set, storeAvailable } from "../store";
import { agenteDe } from "./catalogo";
import {
  configPorDefecto,
  MAX_APUNTES,
  MAX_PENDIENTES,
  type Apunte,
  type ConfigAgente,
  type Contratado,
  type Pendiente,
} from "./tipos";

/**
 * Dónde viven los agentes de cada empresa.
 *
 * Todo cuelga del correo de la cuenta, y eso no es una convención: es la
 * separación. No hay ninguna clave compartida entre clientes, ninguna lista
 * global y ninguna función que devuelva "todos los contratos". Para leer algo
 * hay que saber de quién es, y de quién es lo dice la sesión, no el navegador.
 *
 * Tres cosas aparte y no una, a propósito:
 *
 * - Los CONTRATOS son cuatro campos y se leen en cada pantalla.
 * - El REGISTRO crece sin parar y solo se mira cuando se abre el panel.
 * - Lo PENDIENTE de aprobar hay que poder leerlo sin arrastrar el registro.
 *
 * Juntos, abrir la lista de agentes se traería doscientas líneas de registro
 * para pintar cinco tarjetas.
 */

const clave = {
  contratos: (email: string) => `eclipse:agentes:${email}`,
  registro: (email: string, agenteId: string) => `eclipse:agente:log:${email}:${agenteId}`,
  pendientes: (email: string) => `eclipse:agente:pendientes:${email}`,
};

export function agentesListos(): boolean {
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

async function leer<T>(k: string, porDefecto: T): Promise<T> {
  try {
    const raw = await get(k);
    if (!raw) return porDefecto;
    const v = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as T;
    return v ?? porDefecto;
  } catch {
    return porDefecto;
  }
}

/* ------------------------------- Contratos ------------------------------- */

export async function contratosDe(email: string): Promise<Contratado[]> {
  const lista = await leer<Contratado[]>(clave.contratos(email), []);
  return Array.isArray(lista) ? lista.filter((c) => c && agenteDe(c.agenteId)) : [];
}

export async function contratoDe(email: string, agenteId: string): Promise<Contratado | null> {
  return (await contratosDe(email)).find((c) => c.agenteId === agenteId) ?? null;
}

async function guardarContratos(email: string, lista: Contratado[]): Promise<void> {
  if (lista.length) await set(clave.contratos(email), JSON.stringify(lista));
  else await del(clave.contratos(email));
}

/**
 * Contratar un agente.
 *
 * Nace en `pendiente_de_pago` cuando no hay cobro configurado, y eso NO es una
 * cortesía: es lo único honesto. Marcarlo como activo sin que nadie haya pagado
 * sería exactamente el pago falso que no puede existir aquí. Con Stripe puesto,
 * quien lo active será la confirmación del pago, no este método.
 */
export async function contratar(
  email: string,
  agenteId: string,
  estado: Contratado["estado"],
): Promise<Contratado | null> {
  const agente = agenteDe(agenteId);
  if (!agente) return null;

  const lista = await contratosDe(email);
  const yaEsta = lista.find((c) => c.agenteId === agenteId);
  if (yaEsta) return yaEsta;

  const nuevo: Contratado = {
    agenteId,
    estado,
    desde: Date.now(),
    config: configPorDefecto(agente),
  };
  await guardarContratos(email, [...lista, nuevo]);
  await apuntar(email, agenteId, {
    tipo: "estado",
    texto: estado === "activo" ? "Agente contratado y activo." : "Agente contratado, pendiente de pago.",
    ok: true,
  });
  return nuevo;
}

export async function cambiarEstado(
  email: string,
  agenteId: string,
  estado: Contratado["estado"],
): Promise<Contratado | null> {
  const lista = await contratosDe(email);
  const uno = lista.find((c) => c.agenteId === agenteId);
  if (!uno) return null;

  uno.estado = estado;
  await guardarContratos(email, lista);
  await apuntar(email, agenteId, {
    tipo: "estado",
    texto: estado === "pausado" ? "Puesto en pausa." : estado === "activo" ? "Reactivado." : "Pendiente de pago.",
    ok: true,
  });
  return uno;
}

export async function cambiarConfig(
  email: string,
  agenteId: string,
  cambios: Partial<ConfigAgente>,
): Promise<Contratado | null> {
  const lista = await contratosDe(email);
  const uno = lista.find((c) => c.agenteId === agenteId);
  if (!uno) return null;

  uno.config = { ...uno.config, ...cambios };
  await guardarContratos(email, lista);
  return uno;
}

/** Rescindir: se va el contrato, su registro y lo que tuviera pendiente. */
export async function rescindir(email: string, agenteId: string): Promise<void> {
  const lista = await contratosDe(email);
  await guardarContratos(email, lista.filter((c) => c.agenteId !== agenteId));
  await del(clave.registro(email, agenteId)).catch(() => {});

  const pendientes = await pendientesDe(email);
  await guardarPendientes(email, pendientes.filter((p) => p.agenteId !== agenteId));
}

/* -------------------------------- Registro ------------------------------- */

export async function registroDe(email: string, agenteId: string): Promise<Apunte[]> {
  return leer<Apunte[]>(clave.registro(email, agenteId), []);
}

/**
 * Apuntar lo que ha pasado.
 *
 * Todo: lo que salió bien, lo que falló y lo que se quedó esperando. Un
 * registro que solo cuenta los aciertos no sirve para nada, porque el día que
 * algo va mal es justo el día que se abre.
 */
export async function apuntar(
  email: string,
  agenteId: string,
  apunte: Omit<Apunte, "id" | "agenteId" | "cuando">,
): Promise<void> {
  const lista = await registroDe(email, agenteId);
  const nuevo: Apunte = { ...apunte, id: randomUUID().slice(0, 8), agenteId, cuando: Date.now() };
  await set(clave.registro(email, agenteId), JSON.stringify([nuevo, ...lista].slice(0, MAX_APUNTES)));
}

/* ------------------------------- Pendientes ------------------------------ */

export async function pendientesDe(email: string): Promise<Pendiente[]> {
  return leer<Pendiente[]>(clave.pendientes(email), []);
}

async function guardarPendientes(email: string, lista: Pendiente[]): Promise<void> {
  if (lista.length) await set(clave.pendientes(email), JSON.stringify(lista.slice(0, MAX_PENDIENTES)));
  else await del(clave.pendientes(email));
}

export async function dejarPendiente(
  email: string,
  p: Omit<Pendiente, "id" | "cuando">,
): Promise<Pendiente> {
  const nuevo: Pendiente = { ...p, id: randomUUID().slice(0, 8), cuando: Date.now() };
  await guardarPendientes(email, [nuevo, ...(await pendientesDe(email))]);
  await apuntar(email, p.agenteId, {
    tipo: "aprobacion",
    texto: `Esperando tu aprobación: ${p.accion.replace(/_/g, " ")} en ${p.servicio}.`,
    detalle: p.porque,
    // No es un acierto ni un fallo: está parado. Marcarlo como hecho sería la
    // mentira que todo esto existe para evitar.
    ok: false,
  });
  return nuevo;
}

export async function quitarPendiente(email: string, id: string): Promise<Pendiente | null> {
  const lista = await pendientesDe(email);
  const uno = lista.find((p) => p.id === id) ?? null;
  if (uno) await guardarPendientes(email, lista.filter((p) => p.id !== id));
  return uno;
}

/** Borrar TODO lo de agentes de alguien. Lo usa el borrado de cuenta. */
export async function olvidarAgentesDe(email: string): Promise<void> {
  for (const c of await contratosDe(email))
    await del(clave.registro(email, c.agenteId)).catch(() => {});
  await del(clave.contratos(email)).catch(() => {});
  await del(clave.pendientes(email)).catch(() => {});
}
