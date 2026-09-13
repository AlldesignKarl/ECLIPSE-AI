import { NextRequest } from "next/server";
import { gastar } from "@/lib/limites";
import { generateImage, MediaError } from "@/lib/media";
import { currentPlan } from "@/lib/plan-server";

export const runtime = "nodejs";
// El plan gratuito de Vercel corta las funciones a los 60 s. Si despliegas en
// un plan de pago o en tu propio servidor, puedes subir este número.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { prompt, anterior } = (await req.json().catch(() => ({}))) as {
    prompt?: string;
    /** La descripción de la imagen anterior, cuando esto es un retoque. */
    anterior?: string;
  };
  if (!prompt?.trim())
    return Response.json({ error: "Describe la imagen que quieres." }, { status: 400 });

  // Se cuenta antes de dibujar: contarlo después significa pagar la petición
  // que revienta el límite.
  const cupo = await gastar("imagen", await currentPlan());
  if (!cupo.permitido)
    return Response.json({ error: cupo.mensaje, code: "sin_cupo" }, { status: 429 });

  try {
    const result = await generateImage(prompt.trim(), anterior?.trim() || undefined);
    return Response.json(result);
  } catch (err) {
    const status = err instanceof MediaError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Error generando la imagen.";
    return Response.json({ error: message }, { status });
  }
}
