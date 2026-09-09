import { NextRequest } from "next/server";
import { generateImage, MediaError } from "@/lib/media";

export const runtime = "nodejs";
export const maxDuration = 180;

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
