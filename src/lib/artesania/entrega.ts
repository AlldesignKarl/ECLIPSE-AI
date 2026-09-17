/**
 * Dónde acaba una solicitud del formulario.
 * ---------------------------------------------------------------------------
 * El formulario tenía que ser funcional HOY y conectable a un servicio de
 * correo MAÑANA sin reescribir nada. Por eso hay tres caminos y se prueban en
 * orden, cada uno con sus variables de entorno y ninguno obligatorio:
 *
 *   1. `ARTESANIA_WEBHOOK_URL` — un POST con el JSON entero. Es lo que piden
 *      Zapier, Make, n8n, Formspree o un CRM: se pega la dirección y ya está.
 *   2. `RESEND_API_KEY` + `ARTESANIA_EMAIL_DESTINO` — un correo de verdad.
 *      (`ARTESANIA_EMAIL_REMITENTE` si el dominio verificado no es el de destino.)
 *   3. La base de datos que ya usa ECLIPSE (Redis por REST). Si está puesta,
 *      la solicitud queda guardada aunque no haya correo configurado.
 *
 * Y si no hay NINGUNO, no se miente: se devuelve que no se ha podido entregar y
 * el formulario enseña el correo directo. Un "gracias, te contestamos pronto"
 * sobre algo que se ha perdido es el peor fallo posible en una web de ventas,
 * porque nadie se entera nunca.
 *
 * Aquí no se escribe ninguna clave en el código: todo son variables de entorno.
 */
import { randomUUID } from "node:crypto";

import { get, set, storeAvailable, tomarTurno } from "../store";
import { comoTexto, type Solicitud } from "./solicitud";

/** Por dónde ha salido. Se devuelve para poder contarlo en los registros. */
export type Camino = "webhook" | "correo" | "base-de-datos" | "ninguno";

export interface Entregada {
  entregada: boolean;
  caminos: Camino[];
  id: string;
}

const CLAVE = "eclipse:artesania:solicitudes";

/** Se guardan las últimas; no es un CRM, es una red de seguridad. */
const MAX_GUARDADAS = 200;

/* ------------------------------ Los caminos ------------------------------- */

async function porWebhook(s: Solicitud, id: string): Promise<boolean> {
  const url = process.env.ARTESANIA_WEBHOOK_URL;
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, recibido: new Date().toISOString(), ...s }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function porCorreo(s: Solicitud, id: string): Promise<boolean> {
  const clave = process.env.RESEND_API_KEY;
  const destino = process.env.ARTESANIA_EMAIL_DESTINO;
  if (!clave || !destino) return false;

  // Resend exige un remitente de un dominio verificado. El suyo de pruebas
  // funciona desde el primer minuto, así que sirve de arranque mientras el
  // dominio propio se verifica.
  const remitente = process.env.ARTESANIA_EMAIL_REMITENTE || "onboarding@resend.dev";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remitente,
        to: [destino],
        // Para que contestar desde el correo le llegue a quien escribió.
        reply_to: s.email,
        subject: `${s.empresa} · ${s.nombre} — solicitud desde la web`,
        text: `${comoTexto(s)}\n\nReferencia: ${id}`,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function porBaseDeDatos(s: Solicitud, id: string): Promise<boolean> {
  if (!storeAvailable()) return false;

  try {
    const crudo = await get(CLAVE);
    const previas = crudo ? (JSON.parse(crudo) as unknown) : [];
    const lista = Array.isArray(previas) ? previas : [];
    lista.unshift({ id, recibido: new Date().toISOString(), ...s });
    await set(CLAVE, JSON.stringify(lista.slice(0, MAX_GUARDADAS)));
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------- Entregar -------------------------------- */

/**
 * Se prueban TODOS los caminos configurados, no solo el primero que funcione.
 * Quien pone webhook y correo a la vez los quiere a la vez; y con dos copias de
 * cada solicitud, un servicio caído no pierde un cliente.
 */
export async function entregar(s: Solicitud): Promise<Entregada> {
  const id = randomUUID();

  const resultados = await Promise.all([
    porWebhook(s, id),
    porCorreo(s, id),
    porBaseDeDatos(s, id),
  ]);

  const caminos: Camino[] = [];
  if (resultados[0]) caminos.push("webhook");
  if (resultados[1]) caminos.push("correo");
  if (resultados[2]) caminos.push("base-de-datos");

  return { entregada: caminos.length > 0, caminos: caminos.length ? caminos : ["ninguno"], id };
}

/** ¿Hay al menos una forma de entregar? Lo usa la web para avisar en desarrollo. */
export function hayDondeEntregar(): boolean {
  return Boolean(
    process.env.ARTESANIA_WEBHOOK_URL ||
      (process.env.RESEND_API_KEY && process.env.ARTESANIA_EMAIL_DESTINO) ||
      storeAvailable(),
  );
}

/**
 * Un envío cada medio minuto por visitante.
 *
 * Un formulario público sin freno es un buzón de spam en cuanto lo encuentra un
 * robot. Se apoya en la base de datos porque las funciones sin servidor no
 * comparten memoria: cada petición puede caer en una máquina distinta y un
 * contador en memoria no cuenta nada. Sin base de datos no hay freno, y se deja
 * pasar: es preferible a rechazar a un cliente de verdad.
 */
export async function puedeEnviar(huella: string): Promise<boolean> {
  if (!storeAvailable()) return true;
  try {
    return await tomarTurno(`eclipse:artesania:turno:${huella}`, 30);
  } catch {
    return true;
  }
}
