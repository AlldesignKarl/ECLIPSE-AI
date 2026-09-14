/**
 * Hablar con la API de otro, sin que un mal día suyo sea un mal día nuestro.
 *
 * Todas las conexiones pasan por aquí, y por tres motivos:
 *
 * - Un servicio caído no puede dejar colgada la conversación. Con tiempo
 *   límite, ECLIPSE dice "Shopify no contesta" y sigue hablando.
 * - Los errores tienen que llegar en cristiano. Un 401 sin traducir le dice al
 *   modelo exactamente nada; "la clave ya no vale, vuelve a conectar" le dice
 *   qué contarle al usuario.
 * - La dirección tiene que poder cambiarse para las pruebas. Comprobar que el
 *   conector de IONOS funciona contra el IONOS de verdad exigiría un dominio
 *   de verdad; contra uno de mentira que habla igual, se comprueba entero y
 *   sin tocar la cuenta de nadie.
 */

const TIEMPO_LIMITE = 20_000;

/**
 * La dirección base de un servicio, con una puerta para las pruebas.
 *
 * En producción nunca hay variable puesta y se usa la de siempre. En las
 * pruebas se apunta a un servidor local que habla como Shopify.
 */
export function baseDe(id: string, pordefecto: string): string {
  return process.env[`CONEXION_BASE_${id.toUpperCase()}`] || pordefecto;
}

export class ErrorConexion extends Error {}

interface Opciones {
  metodo?: string;
  cabeceras?: Record<string, string>;
  cuerpo?: unknown;
  signal?: AbortSignal;
  /** Para APIs que no devuelven JSON (una comprobación de que el sitio existe). */
  texto?: boolean;
}

/** Un error del otro lado, contado para que se entienda. */
function explicar(estado: number, servicio: string, detalle: string): string {
  if (estado === 401 || estado === 403)
    return `${servicio} ha rechazado la clave. Puede que haya caducado, que le falten permisos o que se copiara incompleta: vuelve a conectarlo desde Conexiones.`;
  if (estado === 404)
    return `${servicio} dice que eso no existe. Comprueba el identificador antes de volver a intentarlo.`;
  if (estado === 422)
    return `${servicio} no ha aceptado los datos${detalle ? `: ${detalle}` : ""}.`;
  if (estado === 429)
    return `${servicio} está limitando las peticiones. Espera unos segundos y vuelve a intentarlo.`;
  if (estado >= 500) return `${servicio} está fallando ahora mismo (error ${estado}). No es cosa tuya.`;
  return `${servicio} ha respondido con un error ${estado}${detalle ? `: ${detalle}` : ""}.`;
}

/** Lo poco que se puede sacar en claro del cuerpo de un error. */
function detalleDe(crudo: string): string {
  if (!crudo) return "";
  try {
    const v = JSON.parse(crudo) as Record<string, unknown>;
    const posibles = [v.message, v.error, v.description, v.detail, v.errors];
    for (const p of posibles) {
      if (typeof p === "string" && p) return p.slice(0, 200);
      if (Array.isArray(p) && typeof p[0] === "string") return String(p[0]).slice(0, 200);
      if (p && typeof p === "object") return JSON.stringify(p).slice(0, 200);
    }
  } catch {
    /* no era JSON */
  }
  return crudo.slice(0, 200);
}

export async function pedir<T = unknown>(
  servicio: string,
  url: string,
  opciones: Opciones = {},
): Promise<T> {
  const reloj = AbortSignal.timeout(TIEMPO_LIMITE);
  const signal = opciones.signal
    ? AbortSignal.any([opciones.signal, reloj])
    : reloj;

  let res: Response;
  try {
    res = await fetch(url, {
      method: opciones.metodo ?? "GET",
      headers: {
        Accept: "application/json",
        ...(opciones.cuerpo !== undefined ? { "Content-Type": "application/json" } : {}),
        ...opciones.cabeceras,
      },
      ...(opciones.cuerpo !== undefined ? { body: JSON.stringify(opciones.cuerpo) } : {}),
      signal,
    });
  } catch (err) {
    // Si quien cortó fue el usuario, que se note: eso no es un fallo del servicio.
    if (opciones.signal?.aborted) throw err;
    if ((err as Error)?.name === "TimeoutError" || (err as Error)?.name === "AbortError")
      throw new ErrorConexion(`${servicio} ha tardado demasiado en contestar.`);
    throw new ErrorConexion(`No se ha podido conectar con ${servicio}.`);
  }

  const crudo = await res.text();
  if (!res.ok) throw new ErrorConexion(explicar(res.status, servicio, detalleDe(crudo)));

  if (opciones.texto) return crudo as unknown as T;
  if (!crudo) return {} as T;

  try {
    return JSON.parse(crudo) as T;
  } catch {
    throw new ErrorConexion(`${servicio} ha contestado algo que no es JSON.`);
  }
}

/** Un número que venga del modelo, con tope y con valor por defecto. */
export function tope(v: unknown, pordefecto: number, maximo: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return pordefecto;
  return Math.min(Math.floor(n), maximo);
}

/** Un texto que venga del modelo, recortado. */
export function texto(v: unknown, maximo = 500): string {
  return typeof v === "string" ? v.trim().slice(0, maximo) : "";
}
