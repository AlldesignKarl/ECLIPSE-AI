import { NextRequest } from "next/server";
import { PLAN_COOKIE, readProToken } from "@/lib/plan-server";
import { getStripe, humanStripeError, stripeAvailable } from "@/lib/stripe";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Lleva al portal de Stripe, donde se cambia la tarjeta o se cancela. */
export async function POST(req: NextRequest) {
  if (!stripeAvailable())
    return Response.json({ error: "Los pagos no están configurados." }, { status: 503 });

  const info = readProToken(req.cookies.get(PLAN_COOKIE)?.value);
  if (!info.valid || !info.subscriptionId)
    return Response.json(
      { error: "No hay ninguna suscripción asociada a este dispositivo." },
      { status: 404 },
    );

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(info.subscriptionId);
    const customer =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

    const portal = await stripe.billingPortal.sessions.create({
      customer,
      locale: "es",
      return_url: req.nextUrl.origin,
    });

    return Response.json({ url: portal.url });
  } catch (err) {
    return Response.json({ error: humanStripeError(err) }, { status: 500 });
  }
}
