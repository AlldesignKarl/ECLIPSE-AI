import { randomUUID } from "node:crypto";

import { currentUser } from "../auth";
import { del, get, set, storeAvailable } from "../store";
import { MAX_RESULTADOS, MAX_TAREAS, type Resultado, type Tarea } from "./tipos";

/**
 * Dónde viven las tareas y lo que producen.
 *
 * En la base de datos y no en el móvil, y esta vez no es por comodidad: una
 * tarea que corre sola mientras nadie mira TIENE que vivir donde corre. Las
 * conversaciones se guardan en tu dispositivo a propósito —son tuyas y no
 * queremos copia— pero un encargo que se ejecuta de madrugada no puede estar
 * en un móvil apagado.
 *
 * Y hay una lista de quién tiene tareas, porque el reloj de las noches no sabe
 * a quién mirar: no hay nadie conectado a quien preguntarle.
 */

const TODOS = "eclipse:tareas:personas";

function clave(email: string): string {
  return `eclipse:tareas:${email}`;
}
function claveResultados(email: string): string {
  return `eclipse:tareas:resultados:${email}`;
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

export function tareasListas(): boolean {
  return storeAvailable();
}

async function quien(): Promise<string | null> {
  if (!storeAvailable()) return null;
  try {
    return await currentUser();
  } catch {
    return null;
  }
}

/* ------------------------------- Las tareas ------------------------------ */

export async function tareasDe(email: string): Promise<Tarea[]> {
  return leerLista<Tarea>(clave(email));
}

export async function misTareas(): Promise<Tarea[]> {
  const email = await quien();
  return email ? tareasDe(email) : [];
}

async function guardarTareas(email: string, tareas: Tarea[]): Promise<void> {
  if (tareas.length) {
    await set(clave(email), JSON.stringify(tareas.slice(0, MAX_TAREAS)));
    // Apuntar a esta persona en la lista del reloj. Idempotente: si ya estaba,
    // no pasa nada.
    const personas = await leerLista<string>(TODOS);
    if (!personas.includes(email)) await set(TODOS, JSON.stringify([...personas, email]));
  } else {
    await del(clave(email));
    await set(
      TODOS,
      JSON.stringify((await leerLista<string>(TODOS)).filter((p) => p !== email)),
    );
  }
}

/** Quién tiene tareas. Solo lo usa el reloj, que no tiene a nadie delante. */
export async function personasConTareas(): Promise<string[]> {
  return leerLista<string>(TODOS);
}

export async function crearTarea(
  datos: Pick<Tarea, "titulo" | "instruccion" | "cuando">,
): Promise<Tarea | null> {
  const email = await quien();
  if (!email) return null;

  const tareas = await tareasDe(email);
  if (tareas.length >= MAX_TAREAS) return null;

  const tarea: Tarea = {
    id: randomUUID(),
    titulo: datos.titulo,
    instruccion: datos.instruccion,
    cuando: datos.cuando,
    activa: true,
    creada: Date.now(),
  };
  await guardarTareas(email, [...tareas, tarea]);
  return tarea;
}

export async function cambiarTarea(
  id: string,
  cambios: Partial<Pick<Tarea, "titulo" | "instruccion" | "cuando" | "activa">>,
): Promise<Tarea | null> {
  const email = await quien();
  if (!email) return null;

  const tareas = await tareasDe(email);
  const tarea = tareas.find((t) => t.id === id);
  if (!tarea) return null;

  Object.assign(tarea, cambios);
  await guardarTareas(email, tareas);
  return tarea;
}

export async function borrarTarea(id: string): Promise<boolean> {
  const email = await quien();
  if (!email) return false;

  const tareas = await tareasDe(email);
  const quedan = tareas.filter((t) => t.id !== id);
  await guardarTareas(email, quedan);
  // Y sus resultados con ella: dejarlos sueltos es guardar lo que nadie pidió.
  const resultados = await resultadosDe(email);
  await guardarResultados(email, resultados.filter((r) => r.tareaId !== id));
  return quedan.length !== tareas.length;
}

/** Marcar que se acaba de hacer (o que falló). Lo llama el reloj. */
export async function anotarEjecucion(
  email: string,
  id: string,
  fallo?: string,
): Promise<void> {
  const tareas = await tareasDe(email);
  const tarea = tareas.find((t) => t.id === id);
  if (!tarea) return;

  tarea.ultima = Date.now();
  tarea.ultimoFallo = fallo;
  await guardarTareas(email, tareas);
}

/* ----------------------------- Los resultados ---------------------------- */

export async function resultadosDe(email: string): Promise<Resultado[]> {
  return leerLista<Resultado>(claveResultados(email));
}

export async function misResultados(): Promise<Resultado[]> {
  const email = await quien();
  return email ? resultadosDe(email) : [];
}

async function guardarResultados(email: string, lista: Resultado[]): Promise<void> {
  if (lista.length) await set(claveResultados(email), JSON.stringify(lista.slice(0, MAX_RESULTADOS)));
  else await del(claveResultados(email));
}

export async function apuntarResultado(
  email: string,
  resultado: Omit<Resultado, "id" | "nueva">,
): Promise<void> {
  const lista = await resultadosDe(email);
  // Lo último arriba: es lo que se quiere ver al abrir.
  await guardarResultados(email, [
    { ...resultado, id: randomUUID(), nueva: true },
    ...lista,
  ]);
}

/** Dar por leídos. Apaga el punto del menú. */
export async function marcarLeidos(): Promise<boolean> {
  const email = await quien();
  if (!email) return false;

  const lista = await resultadosDe(email);
  await guardarResultados(email, lista.map((r) => ({ ...r, nueva: false })));
  return true;
}

export async function borrarResultado(id: string): Promise<boolean> {
  const email = await quien();
  if (!email) return false;

  const lista = await resultadosDe(email);
  await guardarResultados(email, lista.filter((r) => r.id !== id));
  return true;
}
