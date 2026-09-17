/**
 * La base de datos, y es opcional.
 * ---------------------------------------------------------------------------
 * La web funciona entera sin ninguna: es una web de catálogo, no una tienda.
 * Esto solo existe para dos cosas del formulario, y las dos se apagan solas si
 * no hay nada configurado:
 *
 *   - Guardar una copia de cada solicitud, como red de seguridad por si el
 *     correo o el webhook fallan justo ese día.
 *   - El freno anti-spam. Un contador en memoria no sirve: cada petición puede
 *     caer en una máquina distinta y no comparten nada.
 *
 * Se habla por la API REST de Redis, que funciona desde funciones sin servidor
 * sin abrir conexiones. Vale Upstash directamente o el Redis que Vercel añade
 * desde su Marketplace: cambian los nombres de las variables, no el protocolo.
 * Los dos tienen capa gratuita y no piden tarjeta.
 */

interface Conexion {
  url: string;
  token: string;
}

/**
 * La pareja url/token se busca por su FORMA, no por un nombre exacto, porque
 * cada proveedor las bautiza a su manera y Vercel además les pone prefijo.
 *
 * Y se busca emparejada: las dos mitades del mismo prefijo. Si no, basta una
 * variable vieja suelta —la dirección de otra base de datos, por ejemplo— para
 * juntar la url de una con el token de otra, y el fallo que sale entonces no se
 * parece en nada a su causa.
 */
function conexion(): Conexion | null {
  const urls = new Map<string, string>();
  const tokens = new Map<string, string>();

  for (const [nombre, valor] of Object.entries(process.env)) {
    if (!valor) continue;
    const comoUrl = nombre.match(/^(.*)REST_(?:API_)?URL$/);
    if (comoUrl && /^https?:\/\//.test(valor)) urls.set(comoUrl[1], valor);
    // `..._READ_ONLY_TOKEN` no encaja aquí a propósito: con esa clave se podría
    // leer lo guardado pero no escribir.
    const comoToken = nombre.match(/^(.*)REST_(?:API_)?TOKEN$/);
    if (comoToken) tokens.set(comoToken[1], valor);
  }

  const preferidos = ["UPSTASH_REDIS_", "KV_", "REDIS_"];
  const completos = [...urls.keys()].filter((p) => tokens.has(p));
  const elegido = preferidos.find((p) => completos.includes(p)) ?? completos[0];
  if (elegido === undefined) return null;

  const url = urls.get(elegido);
  const token = tokens.get(elegido);
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

export function hayBaseDeDatos(): boolean {
  return conexion() !== null;
}

async function mandar<T>(...orden: (string | number)[]): Promise<T> {
  const c = conexion();
  if (!c) throw new Error("No hay base de datos configurada.");

  const res = await fetch(c.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(orden.map(String)),
    cache: "no-store",
    // Sin este tope, una base de datos que no contesta deja la petición colgada
    // hasta que Vercel la corta, y quien envió el formulario no ve nada.
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`La base de datos ha respondido ${res.status}.`);
  const json = (await res.json()) as { result?: T; error?: string };
  if (json?.error) throw new Error(json.error);
  return json?.result as T;
}

export async function get(clave: string): Promise<string | null> {
  return (await mandar<string | null>("GET", clave)) ?? null;
}

export async function set(clave: string, valor: string): Promise<void> {
  await mandar("SET", clave, valor);
}

/**
 * "Me pongo yo, que nadie más lo haga durante N segundos."
 *
 * Con caducidad siempre: sin ella, un servidor que se cae a mitad dejaría el
 * turno cogido para siempre y ese visitante no podría volver a escribir nunca.
 */
export async function tomarTurno(clave: string, segundos: number): Promise<boolean> {
  return (await mandar<string | null>("SET", clave, "1", "NX", "EX", String(segundos))) !== null;
}
