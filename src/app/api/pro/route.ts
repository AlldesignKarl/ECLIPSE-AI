import { NextRequest } from "next/server";
import {
  COOKIE_OPTIONS,
  currentPlan,
  issueProToken,
  PLAN_COOKIE,
  proCodeMatches,
} from "@/lib/plan-server";
import { imageProviderAvailable, videoProviderAvailable } from "@/lib/media";
import { activeProvider, providerLabel } from "@/lib/provider";

export const runtime = "nodejs";

/** Estado actual: plan y qué capacidades están realmente configuradas. */
export async function GET() {
  const provider = activeProvider();
  return Response.json({
    plan: await currentPlan(),
    provider,
    providerLabel: providerLabel(provider),
    capabilities: {
      chat: provider !== null,
      image: imageProviderAvailable(),
      video: videoProviderAvailable(),
      github: true,
      proCodeConfigured: Boolean(process.env.PRO_ACCESS_CODE),
    },
  });
}

/** Activa el plan Pro con el código de acceso. */
export async function POST(req: NextRequest) {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };

  if (!process.env.PRO_ACCESS_CODE)
    return Response.json(
      {
        error:
          "El plan Pro no está configurado en este servidor. Define PRO_ACCESS_CODE en las variables de entorno.",
      },
      { status: 503 },
    );

  if (!code || !proCodeMatches(code))
    return Response.json({ error: "El código no es válido." }, { status: 401 });

  const res = Response.json({ plan: "pro" });
  res.headers.append(
    "Set-Cookie",
    `${PLAN_COOKIE}=${issueProToken()}; Path=${COOKIE_OPTIONS.path}; Max-Age=${COOKIE_OPTIONS.maxAge}; HttpOnly; SameSite=Lax${
      COOKIE_OPTIONS.secure ? "; Secure" : ""
    }`,
  );
  return res;
}

/** Vuelve al plan gratuito. */
export async function DELETE() {
  const res = Response.json({ plan: "free" });
  res.headers.append("Set-Cookie", `${PLAN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return res;
}
