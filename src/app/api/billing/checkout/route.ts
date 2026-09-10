import { NextRequest } from "next/server";
import { currentPlan } from "@/lib/plan-server";
import { getStripe, humanStripeError, lineItem, stripeAvailable } from "@/lib/stripe";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Abre la pasarela de pago de Stripe y devuelve su dirección. */
export async function POST(req: NextRequest) {
  if (!stripeAvailable())
    return Response.json(
      {
        error:
          "Los pagos no están configurados en este servidor. Añade STRIPE_SECRET_KEY en las variables de entorno.",
      },
      { status: 503 },
    );

  if ((await currentPlan()) === "pro")
    return Response.json({ error: "Ya tienes el plan Pro activo." }, { status: 409 });

  try {
    const origin = req.nextUrl.origin;
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [lineItem()],
      locale: "es",
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${origin}/?pago=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?pago=cancelado`,
    });

    if (!session.url) throw new Error("Stripe no ha devuelto la dirección de pago.");
    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: humanStripeError(err) }, { status: 500 });
  }
}
