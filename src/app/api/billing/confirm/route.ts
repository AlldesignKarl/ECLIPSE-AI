import { NextRequest } from "next/server";
import { planCookieHeader } from "@/lib/plan-server";
import { getStripe, humanStripeError, stripeAvailable } from "@/lib/stripe";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Se llama al volver de Stripe. Comprueba con Stripe que el pago existe de
 * verdad antes de conceder el plan: el identificador de sesión que trae el
 * navegador no basta por sí solo.
 */
export async function POST(req: NextRequest) {
  if (!stripeAvailable())
    return Response.json({ error: "Los pagos no están configurados." }, { status: 503 });

  const { sessionId } = (await req.json().catch(() => ({}))) as { sessionId?: string };
  if (!sessionId?.startsWith("cs_"))
    return Response.json({ error: "Sesión de pago no válida." }, { status: 400 });

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    const subscription = session.subscription;
    const subscriptionId =
      typeof subscription === "string" ? subscription : (subscription?.id ?? null);

    if (!paid || session.status !== "complete" || !subscriptionId)
      return Response.json(
        { error: "El pago todavía no consta como completado. Espera unos segundos y recarga." },
        { status: 402 },
      );

    const res = Response.json({ plan: "pro" });
    res.headers.append("Set-Cookie", planCookieHeader(subscriptionId));
    return res;
  } catch (err) {
    return Response.json({ error: humanStripeError(err) }, { status: 500 });
  }
}
