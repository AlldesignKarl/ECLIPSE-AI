import { NextRequest } from "next/server";
import { generateImage, MediaError } from "@/lib/media";

export const runtime = "nodejs";
// El plan gratuito de Vercel corta las funciones a los 60 s. Si despliegas en
// un plan de pago o en tu propio servidor, puedes subir este número.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { prompt } = (await req.json().catch(() => ({}))) as { prompt?: string };
  if (!prompt?.trim())
    return Response.json({ error: "Describe la imagen que quieres." }, { status: 400 });

  try {
    const result = await generateImage(prompt.trim());
    return Response.json(result);
  } catch (err) {
    const status = err instanceof MediaError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Error generando la imagen.";
    return Response.json({ error: message }, { status });
  }
}
