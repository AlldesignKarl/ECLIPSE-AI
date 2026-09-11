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
 * Cada proveedor bautiza sus variables a su manera, y Vercel además deja
 * ponerles un prefijo al conectarlas. Así que en vez de exigir un nombre
 * exacto, buscamos la pareja url/token por su forma: cualquier variable que
 * acabe en REST_URL con su correspondiente REST_TOKEN. Un nombre inesperado
 * deja de ser un fallo silencioso que nadie sabe diagnosticar.
 */
function conn(): Conn | null {
  const exact = (name: string) => process.env[name] || "";

  let url =
    exact("UPSTASH_REDIS_REST_URL") || exact("KV_REST_API_URL") || exact("REDIS_REST_URL");
  let token =
    exact("UPSTASH_REDIS_REST_TOKEN") || exact("KV_REST_API_TOKEN") || exact("REDIS_REST_TOKEN");

  if (!url || !token) {
    for (const [name, value] of Object.entries(process.env)) {
      if (!value) continue;
      if (!url && /REST_(API_)?URL$/.test(name) && /^https?:\/\//.test(value)) url = value;
      if (!token && /REST_(API_)?TOKEN$/.test(name)) token = value;
    }
  }

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
    if (/REST_(API_)?URL$/.test(name) && /^https?:\/\//.test(value)) url = true;
    if (/REST_(API_)?TOKEN$/.test(name)) token = true;
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
