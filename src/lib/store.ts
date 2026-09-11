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

function conn(): Conn | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

/** ¿Se pueden crear cuentas en este servidor? */
export function storeAvailable(): boolean {
  return conn() !== null;
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

export async function get(key: string): Promise<string | null> {
  return (await command<string | null>("GET", key)) ?? null;
}

/** Escribe solo si la clave no existía. Devuelve si la ha creado. */
export async function setIfAbsent(key: string, value: string): Promise<boolean> {
  return (await command<string | null>("SET", key, value, "NX")) !== null;
}

export async function set(key: string, value: string): Promise<void> {
  await command("SET", key, value);
}
