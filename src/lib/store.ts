/**
 * El almacén de las cuentas.
 *
 * Hasta ahora ECLIPSE no guardaba nada en ningún servidor: conversaciones en el
 * móvil y plan en una cookie firmada. Para que haya correo y contraseña hace
 * falta un sitio donde vivan los usuarios, y ese sitio tiene que ser gratis.
 *
 * Usamos Redis por su API REST, que funciona desde funciones sin servidor sin
 * abrir conexiones. Vale tanto Upstash directamente como el Redis que Vercel
 * añade desde su Marketplace: cambian los nombres de las variables, no el
 * protocolo. Ambos tienen capa gratuita y no piden tarjeta.
 */

interface Conn {
  url: string;
  token: string;
}

/**
 * Cada proveedor bautiza sus variables a su manera, y Vercel deja además
 * ponerles un prefijo. Así que la pareja url/token se busca por su forma, no
 * por un nombre exacto.
 *
 * Y se busca *emparejada*: las dos mitades tienen que venir del mismo prefijo.
 * Si no, basta una variable vieja suelta —la dirección de una base de datos
 * anterior, por ejemplo— para juntar la url de una con el token de otra, y el
 * fallo que sale entonces no se parece en nada a su causa.
 */
function conn(): Conn | null {
  const urls = new Map<string, string>();
  const tokens = new Map<string, string>();

  for (const [name, value] of Object.entries(process.env)) {
    if (!value) continue;

    const asUrl = name.match(/^(.*)REST_(?:API_)?URL$/);
    if (asUrl && /^https?:\/\//.test(value)) urls.set(asUrl[1], value);

    // `..._READ_ONLY_TOKEN` no encaja aquí, y es justo lo que queremos: con esa
    // clave se podría leer la cuenta de alguien pero no crearla.
    const asToken = name.match(/^(.*)REST_(?:API_)?TOKEN$/);
    if (asToken) tokens.set(asToken[1], value);
  }

  // Los nombres de siempre primero; si no, cualquier pareja completa.
  const preferred = ["UPSTASH_REDIS_", "KV_", "REDIS_"];
  const complete = [...urls.keys()].filter((prefix) => tokens.has(prefix));
  const chosen =
    preferred.find((prefix) => complete.includes(prefix)) ?? complete[0];

  if (!chosen && chosen !== "") return null;

  const url = urls.get(chosen);
  const token = tokens.get(chosen);
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

/** ¿Se pueden crear cuentas en este servidor? */
export function storeAvailable(): boolean {
  return conn() !== null;
}

/**
 * Qué mitad de la configuración falta. Sin esto, "las cuentas no están
 * activadas" es un callejón sin salida: no se distingue una base de datos sin
 * conectar de una conectada a medias. No se devuelve ningún valor ni nombre de
 * variable, solo si está o no está.
 */
export function storeStatus(): { url: boolean; token: boolean } {
  let url = false;
  let token = false;

  for (const [name, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (/^(.*)REST_(?:API_)?URL$/.test(name) && /^https?:\/\//.test(value)) url = true;
    if (/^(.*)REST_(?:API_)?TOKEN$/.test(name)) token = true;
  }
  return { url, token };
}

export class StoreError extends Error {}

async function command<T>(...args: (string | number)[]): Promise<T> {
  const c = conn();
  if (!c) throw new StoreError("No hay base de datos configurada.");

  let res: Response;
  try {
    res = await fetch(c.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args.map(String)),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new StoreError("La base de datos no responde. Inténtalo de nuevo en un momento.");
  }

  if (!res.ok) throw new StoreError(`La base de datos ha respondido ${res.status}.`);

  const json = (await res.json()) as { result?: T; error?: string };
  if (json.error) throw new StoreError(json.error);
  return json.result as T;
}

/**
 * Varios comandos en una sola ida y vuelta.
 *
 * Upstash acepta un array de arrays en `/pipeline` y responde en el mismo
 * orden. Importa de verdad en las funciones sin servidor: cada comando suelto
 * es una petición HTTP entera, y el contador de límites necesita dos por cada
 * mensaje que alguien manda.
 */
export async function pipeline<T extends unknown[]>(
  comandos: (string | number)[][],
): Promise<T> {
  const c = conn();
  if (!c) throw new StoreError("No hay base de datos configurada.");

  let res: Response;
  try {
    res = await fetch(`${c.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(comandos.map((cmd) => cmd.map(String))),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new StoreError("La base de datos no responde. Inténtalo de nuevo en un momento.");
  }

  if (!res.ok) throw new StoreError(`La base de datos ha respondido ${res.status}.`);

  const json = (await res.json()) as ({ result?: unknown; error?: string } | unknown)[];
  if (!Array.isArray(json)) throw new StoreError("Respuesta inesperada de la base de datos.");

  return json.map((fila) => {
    const r = fila as { result?: unknown; error?: string };
    if (r?.error) throw new StoreError(r.error);
    return r?.result;
  }) as T;
}

export async function get(key: string): Promise<string | null> {
  return (await command<string | null>("GET", key)) ?? null;
}

/** Escribe solo si la clave no existía. Devuelve si la ha creado. */
export async function setIfAbsent(key: string, value: string): Promise<boolean> {
  return (await command<string | null>("SET", key, value, "NX")) !== null;
}

/**
 * Lo mismo, pero caducando solo a los N segundos.
 *
 * Para turnos: "me pongo yo a hacer esto, que nadie más lo haga". Sin la
 * caducidad, un servidor que se cae a mitad dejaría el turno cogido para
 * siempre y nadie volvería a hacerlo nunca.
 */
export async function tomarTurno(key: string, segundos: number): Promise<boolean> {
  return (await command<string | null>("SET", key, "1", "NX", "EX", String(segundos))) !== null;
}

export async function set(key: string, value: string): Promise<void> {
  await command("SET", key, value);
}

/**
 * Borrar de verdad.
 *
 * Hace falta para las conexiones: una clave que ya no se usa y sigue guardada
 * es una clave esperando a filtrarse. Escribir encima una cadena vacía deja el
 * hueco ocupado y la intención a medias; DEL no deja nada.
 */
export async function del(key: string): Promise<void> {
  await command("DEL", key);
}
