import Stripe from "stripe";

/**
 * Cobro de la suscripción Pro. El dinero, las tarjetas y las facturas los
 * gestiona Stripe entero: aquí nunca pasa un número de tarjeta.
 *
 * No hace falta base de datos. Al pagar, el servidor comprueba la sesión con
 * Stripe y emite una cookie firmada que lleva dentro el id de la suscripción;
 * a partir de ahí el plan se verifica contra Stripe, así que cancelar surte
 * efecto sin que tengamos que guardar nada.
 */

let client: Stripe | null = null;

export function stripeAvailable(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new Error(
      "Falta STRIPE_SECRET_KEY. Consíguela en el panel de Stripe (Developers → API keys).",
    );
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

/** Precio en céntimos. 1000 = 10,00 €. */
export function priceCents(): number {
  const raw = Number(process.env.PRO_PRICE_CENTS);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 1000;
}

export function priceLabel(): string {
  return format(priceCents(), process.env.PRO_CURRENCY || "eur");
}

function format(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
  }
}

/**
 * El precio que se le enseña al usuario.
 *
 * Cuando el cobro usa una tarifa creada en el panel de Stripe, el importe vive
 * allí: escribirlo también aquí es pedir que algún día la web anuncie un precio
 * y Stripe cobre otro. Así que se pregunta, y se guarda un rato.
 */
let livePrice: { label: string; until: number } | null = null;

export async function priceLabelLive(): Promise<string> {
  const id = process.env.STRIPE_PRICE_ID;
  if (!id || !stripeAvailable()) return priceLabel();

  if (livePrice && livePrice.until > Date.now()) return livePrice.label;

  try {
    const price = await getStripe().prices.retrieve(id);
    if (price.unit_amount == null) return priceLabel();

    const label = format(price.unit_amount, price.currency);
    livePrice = { label, until: Date.now() + 60 * 60 * 1000 };
    return label;
  } catch {
    // Si Stripe no contesta, el precio de siempre antes que ninguno.
    return priceLabel();
  }
}

/** Lo que se cobra: un precio ya creado en Stripe, o uno definido aquí mismo. */
export function lineItem(): Stripe.Checkout.SessionCreateParams.LineItem {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (priceId) return { price: priceId, quantity: 1 };

  return {
    quantity: 1,
    price_data: {
      currency: process.env.PRO_CURRENCY || "eur",
      unit_amount: priceCents(),
      recurring: { interval: "month" },
      product_data: {
        name: "ECLIPSE Pro",
        description:
          "Vídeo, proyectos de código con GitHub, modo Profundo y respuestas aceleradas.",
      },
    },
  };
}

/**
 * ¿Sigue viva esta suscripción? Se consulta a Stripe, con una caché corta
 * para no llamar en cada petición.
 */
const cache = new Map<string, { active: boolean; until: number }>();
const CACHE_MS = 5 * 60 * 1000;

export async function subscriptionActive(subscriptionId: string): Promise<boolean> {
  const hit = cache.get(subscriptionId);
  if (hit && hit.until > Date.now()) return hit.active;

  try {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    const active = sub.status === "active" || sub.status === "trialing";
    cache.set(subscriptionId, { active, until: Date.now() + CACHE_MS });
    return active;
  } catch {
    // Si Stripe no contesta, no echamos al usuario que ya ha pagado: damos por
    // buena la cookie hasta la siguiente comprobación.
    cache.set(subscriptionId, { active: true, until: Date.now() + 60_000 });
    return true;
  }
}

export function humanStripeError(err: unknown): string {
  if (err instanceof Stripe.errors.StripeAuthenticationError)
    return "La clave de Stripe no es válida. Revisa STRIPE_SECRET_KEY.";
  if (err instanceof Stripe.errors.StripeInvalidRequestError)
    return `Stripe ha rechazado la petición: ${err.message}`;
  if (
    err instanceof Stripe.errors.StripeConnectionError ||
    err instanceof Stripe.errors.StripeAPIError
  )
    return "No se ha podido contactar con Stripe. Comprueba la conexión del servidor y que la clave sea correcta.";
  if (err instanceof Stripe.errors.StripeError) return `Stripe: ${err.message}`;
  if (err instanceof Error) return err.message;
  return "No se ha podido contactar con Stripe.";
}
