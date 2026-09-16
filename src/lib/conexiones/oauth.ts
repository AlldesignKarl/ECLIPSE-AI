import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { baseDe } from "./http";
import type { Credenciales } from "./tipos";

/**
 * OAuth: conectar una cuenta sin pedirle a nadie su contraseña.
 *
 * Es la pieza que faltaba para Gmail, y con ella para Calendar y Drive el día
 * que toque. Las 21 conexiones que ya había se hacen pegando una clave que el
 * usuario saca del panel de su servicio; Google no da ninguna clave así, y con
 * razón: lo que da es un permiso concreto, revocable, para una cuenta concreta.
 *
 * El baile tiene cuatro pasos y aquí están los cuatro:
 *
 * 1. Se manda a la persona a Google con lo que le pedimos y un `state`.
 * 2. Google la devuelve con un código de un solo uso.
 * 3. El código se cambia por dos testigos: uno de acceso, que caduca en una
 *    hora, y uno de refresco, que no caduca.
 * 4. Cuando el de acceso caduca, se saca otro con el de refresco, sin molestar
 *    a nadie.
 *
 * El `state` es lo que impide que valga una vuelta que no hemos pedido
 * nosotros: va FIRMADO con el secreto del servidor y lleva dentro de quién es y
 * cuándo se emitió. Sin eso, cualquiera podría mandarle a alguien un enlace de
 * vuelta y conectarle una cuenta ajena.
 */

export interface Proveedor {
  /** `google`. Con él se buscan sus variables de entorno. */
  id: string;
  /** A dónde se manda a la persona. */
  autorizar: string;
  /** Dónde se cambia el código por los testigos. */
  testigos: string;
  /** Qué permisos se piden. Los mínimos que hagan falta, no más. */
  permisos: string[];
}

export const GOOGLE: Proveedor = {
  id: "google",
  autorizar: "https://accounts.google.com/o/oauth2/v2/auth",
  testigos: "https://oauth2.googleapis.com/token",
  permisos: [
    // Leer el correo y buscar en él.
    "https://www.googleapis.com/auth/gmail.readonly",
    // Mandar correo. Se pide aquí porque el permiso de Google se concede una
    // vez; que ECLIPSE lo USE o no lo decide después el permiso de la conexión,
    // que nace en solo lectura como todas.
    "https://www.googleapis.com/auth/gmail.send",
    // Para saber a qué cuenta se ha conectado y poder enseñarlo.
    "https://www.googleapis.com/auth/userinfo.email",
  ],
};

/**
 * Los proveedores por su identificador.
 *
 * Existe para que la ruta de vuelta NO lleve Google escrito. El día que haya un
 * segundo (Outlook, que es otro OAuth distinto), una conexión mal registrada
 * tiene que fallar diciéndolo, no conectarse silenciosamente contra Google.
 */
const PROVEEDORES: Record<string, Proveedor> = { google: GOOGLE };

export function proveedorDe(id: string | undefined): Proveedor | undefined {
  return id ? PROVEEDORES[id] : undefined;
}

/** ¿Está este proveedor configurado en el servidor? */
export function oauthListo(p: Proveedor): boolean {
  return Boolean(idDe(p) && secretoDe(p));
}

function idDe(p: Proveedor): string {
  return process.env[`${p.id.toUpperCase()}_OAUTH_ID`] || "";
}

function secretoDe(p: Proveedor): string {
  return process.env[`${p.id.toUpperCase()}_OAUTH_SECRET`] || "";
}

/** Dónde vuelve Google. Tiene que coincidir letra por letra con lo de su panel. */
export function vuelta(origen: string, servicio: string): string {
  return `${origen}/api/conexiones/oauth/${servicio}`;
}

/* -------------------------------------------------------------------------- */
/*                         El `state`, firmado                                */
/* -------------------------------------------------------------------------- */

function secretoDelServidor(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    "eclipse-dev-secret"
  );
}

/** Cuánto vale un `state`. Cinco minutos: lo que tarda alguien en decir que sí. */
const VIGENCIA_MS = 5 * 60 * 1000;

/**
 * Firmar de quién es esta vuelta.
 *
 * Va firmado y no guardado en la base de datos a propósito: así funciona igual
 * aunque la vuelta caiga en otra instancia del servidor, que en un hosting sin
 * estado pasa constantemente. Lo que no se puede es falsificarlo sin el secreto.
 */
export function firmarEstado(email: string): string {
  const cuerpo = Buffer.from(
    JSON.stringify({ e: email, t: Date.now(), n: randomBytes(6).toString("hex") }),
  ).toString("base64url");
  const firma = createHmac("sha256", secretoDelServidor()).update(cuerpo).digest("base64url");
  return `${cuerpo}.${firma}`;
}

/** De quién era, o null si la firma no cuadra o ya ha caducado. */
export function leerEstado(state: string): string | null {
  const [cuerpo, firma] = (state ?? "").split(".");
  if (!cuerpo || !firma) return null;

  const esperada = createHmac("sha256", secretoDelServidor()).update(cuerpo).digest("base64url");
  // Comparación en tiempo constante: comparar firmas con === deja medir cuánto
  // se tarda en fallar, y con eso se puede adivinar una firma byte a byte.
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const { e, t } = JSON.parse(Buffer.from(cuerpo, "base64url").toString()) as {
      e?: string;
      t?: number;
    };
    if (!e || !t || Date.now() - t > VIGENCIA_MS) return null;
    return e;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                              El baile                                      */
/* -------------------------------------------------------------------------- */

/** A dónde se manda a la persona para que dé permiso. */
export function dondeAutorizar(p: Proveedor, opts: { origen: string; servicio: string; estado: string }): string {
  const url = new URL(baseDe(`oauth_${p.id}`, p.autorizar));
  url.searchParams.set("client_id", idDe(p));
  url.searchParams.set("redirect_uri", vuelta(opts.origen, opts.servicio));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", p.permisos.join(" "));
  // `offline` es lo que hace que Google dé testigo de REFRESCO. Sin él, la
  // conexión dura una hora y luego hay que volver a pedir permiso, que es
  // exactamente lo que nadie quiere de una cuenta conectada.
  url.searchParams.set("access_type", "offline");
  // Y `consent` fuerza que lo dé también cuando la persona ya había autorizado
  // antes: si no, Google no lo repite y nos quedamos sin él.
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", opts.estado);
  return url.toString();
}

export interface Testigos {
  acceso: string;
  refresco: string;
  /** Cuándo caduca el de acceso, en milisegundos desde época. */
  caduca: number;
}

async function pedirTestigos(p: Proveedor, cuerpo: Record<string, string>): Promise<Testigos> {
  const res = await fetch(baseDe(`oauth_${p.id}_token`, p.testigos), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: idDe(p),
      client_secret: secretoDe(p),
      ...cuerpo,
    }).toString(),
  });

  const datos = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !datos.access_token)
    throw new Error(
      datos.error_description ||
        datos.error ||
        `${p.id} no ha querido dar el permiso. Prueba a conectarlo otra vez.`,
    );

  return {
    acceso: datos.access_token,
    refresco: datos.refresh_token ?? "",
    // Un minuto de margen: pedir con un testigo que caduca en dos segundos
    // falla a mitad de la llamada y no hay forma de saber por qué.
    caduca: Date.now() + (datos.expires_in ?? 3600) * 1000 - 60_000,
  };
}

/** Cambiar el código de un solo uso por los testigos. */
export async function canjearCodigo(
  p: Proveedor,
  opts: { codigo: string; origen: string; servicio: string },
): Promise<Testigos> {
  return pedirTestigos(p, {
    code: opts.codigo,
    redirect_uri: vuelta(opts.origen, opts.servicio),
    grant_type: "authorization_code",
  });
}

/**
 * El testigo de acceso de una conexión, renovándolo si hace falta.
 *
 * Devuelve también las credenciales actualizadas cuando ha habido que
 * renovarlas, para que quien llama las guarde. Renovar y no guardar significa
 * renovar en cada llamada, que funciona pero gasta un viaje de más siempre.
 */
export async function accesoVigente(
  p: Proveedor,
  cred: Credenciales,
): Promise<{ acceso: string; nuevas?: Credenciales }> {
  const caduca = Number(cred.caduca ?? 0);
  if (cred.acceso && caduca > Date.now()) return { acceso: cred.acceso };

  if (!cred.refresco)
    throw new Error(
      "Esta conexión no tiene permiso de refresco. Vuelve a conectarla para renovarla.",
    );

  const nuevos = await pedirTestigos(p, {
    refresh_token: cred.refresco,
    grant_type: "refresh_token",
  });

  return {
    acceso: nuevos.acceso,
    nuevas: {
      ...cred,
      acceso: nuevos.acceso,
      // Google NO devuelve un refresco nuevo al refrescar: se conserva el que
      // ya había. Machacarlo con la cadena vacía deja la conexión muerta a la
      // hora siguiente.
      refresco: nuevos.refresco || cred.refresco,
      caduca: String(nuevos.caduca),
    },
  };
}
