import type Stripe from "stripe";

import { getStripe, stripeAvailable } from "../stripe";
import type { Agente } from "./tipos";

/**
 * Cobrar los agentes con la cuenta de Stripe que ya hay.
 *
 * Lo bueno de esto es lo que NO hace falta: ni un producto por agente creado a
 * mano en el panel, ni cinco variables de entorno con cinco identificadores de
 * precio. El cobro del plan Pro ya usa un precio definido en el propio código
 * —`price_data` con `recurring`— y eso es exactamente lo que necesita una
 * suscripción mensual. Con `STRIPE_SECRET_KEY` puesta, los cinco agentes cobran.
 *
 * Y si algún día se quieren gestionar desde el panel de Stripe —para cambiar
 * precios sin desplegar, o para ponerles prueba gratuita— basta con crear el
 * producto allí y poner su identificador en `STRIPE_PRICE_OMNI`,
 * `STRIPE_PRICE_SALES`, etc. Se usa ese y se deja de usar el de aquí, sin tocar
 * nada más.
 */

/** El precio de un agente: el de Stripe si lo han creado, o el del catálogo. */
export function lineaDe(agente: Agente): Stripe.Checkout.SessionCreateParams.LineItem {
  const puesto = process.env[`STRIPE_PRICE_${agente.id.toUpperCase()}`];
  if (puesto) return { price: puesto, quantity: 1 };

  return {
    quantity: 1,
    price_data: {
      currency: process.env.AGENTES_MONEDA || "eur",
      // Stripe cobra en céntimos. 500 € son 50.000, no 500.
      unit_amount: Math.round(agente.precio * 100),
      recurring: { interval: "month" },
      product_data: {
        name: agente.nombre,
        description: agente.resumen,
      },
    },
  };
}

/**
 * A quién se le regalan los agentes.
 *
 * Existe para poder probar la plataforma entera de punta a punta sin cobrarse a
 * uno mismo. Va en una variable de entorno y NO escrito aquí, y eso no es
 * manía: este repositorio es público, y el correo de una persona no se publica
 * por comodidad. Se ponen separados por comas en `AGENTES_GRATIS`.
 *
 * Sin hash, al revés que la lista de Pro: aquella está escrita dentro del
 * código —que se lee— y esta vive en la configuración del hosting, que no.
 */
export function gratisPara(email: string): boolean {
  const suyo = email.trim().toLowerCase();
  if (!suyo) return false;

  return (process.env.AGENTES_GRATIS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(suyo);
}

export interface Pasarela {
  url: string;
  sesion: string;
}

/**
 * Abrir la pasarela para contratar UN agente.
 *
 * En la sesión se guarda de quién es y de qué agente, y eso es lo que después
 * permite comprobar al volver que el pago que trae el navegador es de ESTE
 * cliente y de ESTE agente. Sin eso, un identificador de sesión copiado de otro
 * sitio activaría un agente que nadie ha pagado.
 */
export async function abrirPasarela(opts: {
  agente: Agente;
  email: string;
  instancia: string;
  origen: string;
}): Promise<Pasarela> {
  const sesion = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [lineaDe(opts.agente)],
    locale: "es",
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    // Lo que va en `metadata` es lo que se comprueba al volver.
    metadata: {
      eclipse_agente: opts.agente.id,
      eclipse_cliente: opts.email,
      eclipse_instancia: opts.instancia,
    },
    subscription_data: {
      metadata: {
        eclipse_agente: opts.agente.id,
        eclipse_cliente: opts.email,
        eclipse_instancia: opts.instancia,
      },
    },
    success_url: `${opts.origen}/?agente=${opts.agente.id}&sesion={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origen}/?agente=${opts.agente.id}&pago=cancelado`,
  });

  if (!sesion.url) throw new Error("Stripe no ha devuelto la dirección de pago.");
  return { url: sesion.url, sesion: sesion.id };
}

export type Comprobacion =
  | { ok: true; suscripcion: string }
  | { ok: false; error: string };

/**
 * Comprobar con Stripe que un pago existe de verdad.
 *
 * Tres cosas, y las tres tienen que cumplirse: que Stripe diga que está pagado,
 * que la suscripción exista, y que la sesión sea de ESTE cliente y de ESTE
 * agente. Lo tercero es lo que impide que valga un identificador de sesión
 * ajeno: el navegador puede mandar cualquier cadena, y aquí se pregunta a
 * Stripe en vez de creérselo.
 */
export async function comprobarPago(opts: {
  sesion: string;
  email: string;
  agenteId: string;
}): Promise<Comprobacion> {
  if (!stripeAvailable()) return { ok: false, error: "Los pagos no están configurados." };
  if (!opts.sesion.startsWith("cs_")) return { ok: false, error: "Sesión de pago no válida." };

  try {
    const sesion = await getStripe().checkout.sessions.retrieve(opts.sesion, {
      expand: ["subscription"],
    });

    const pagado =
      sesion.payment_status === "paid" || sesion.payment_status === "no_payment_required";
    const suscripcion =
      typeof sesion.subscription === "string" ? sesion.subscription : (sesion.subscription?.id ?? null);

    if (!pagado || sesion.status !== "complete" || !suscripcion)
      return {
        ok: false,
        error: "El pago todavía no consta como completado. Espera unos segundos y vuelve a intentarlo.",
      };

    const suyo = sesion.metadata?.eclipse_cliente?.toLowerCase();
    const cual = sesion.metadata?.eclipse_agente;
    if (suyo !== opts.email.trim().toLowerCase() || cual !== opts.agenteId)
      return { ok: false, error: "Ese pago no es de esta cuenta ni de este agente." };

    return { ok: true, suscripcion };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Stripe no ha contestado." };
  }
}

/**
 * ¿Sigue viva la suscripción de un agente?
 *
 * Se pregunta a Stripe, con una caché corta para no llamar en cada pantalla. Es
 * lo que hace que dar de baja en Stripe apague el agente sin que nadie tenga
 * que tocar nada aquí: si la suscripción deja de estar activa, el agente deja
 * de trabajar.
 */
const cache = new Map<string, { viva: boolean; hasta: number }>();
const CACHE_MS = 5 * 60 * 1000;

export async function suscripcionViva(id: string): Promise<boolean> {
  if (!stripeAvailable()) return false;

  const guardada = cache.get(id);
  if (guardada && guardada.hasta > Date.now()) return guardada.viva;

  try {
    const sub = await getStripe().subscriptions.retrieve(id);
    const viva = sub.status === "active" || sub.status === "trialing";
    cache.set(id, { viva, hasta: Date.now() + CACHE_MS });
    return viva;
  } catch {
    /*
      Si Stripe no contesta, se da por viva.

      Cortarle el agente a una empresa que paga porque hemos tenido un problema
      de red es mucho peor que dejar trabajar unos minutos a una que se acaba de
      dar de baja. Y no se guarda en la caché: se vuelve a preguntar enseguida.
    */
    return true;
  }
}
