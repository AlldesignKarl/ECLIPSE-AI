import { NextRequest } from "next/server";
import { gastar } from "@/lib/limites";
import { editImage, MediaError } from "@/lib/media";
import { currentPlan } from "@/lib/plan-server";
import { estamparDataUrl } from "@/lib/watermark";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Retoca una imagen que el usuario ha adjuntado.
 *
 * Quien decide que hay algo que mejorar es el modelo de texto, mirando la foto
 * durante la conversación; aquí solo llega ya el encargo concreto.
 */
export async function POST(req: NextRequest) {
  const { imagen, prompt, fuerza } = (await req.json().catch(() => ({}))) as {
    imagen?: string;
    prompt?: string;
    fuerza?: number;
  };

  if (!imagen) return Response.json({ error: "Falta la imagen." }, { status: 400 });
  if (!prompt?.trim())
    return Response.json({ error: "Falta qué hay que cambiar." }, { status: 400 });

  const cupo = await gastar("imagen", await currentPlan());
  if (!cupo.permitido)
    return Response.json({ error: cupo.mensaje, code: "sin_cupo" }, { status: 429 });

  // Se acepta tanto el base64 pelado como un data URL entero.
  const coma = imagen.indexOf(",");
  const b64 = imagen.startsWith("data:") && coma > 0 ? imagen.slice(coma + 1) : imagen;

  try {
    const hecha = await editImage({ b64, prompt: prompt.trim(), fuerza });
    return Response.json({ ...hecha, dataUrl: await estamparDataUrl(hecha.dataUrl) });
  } catch (err) {
    const status = err instanceof MediaError ? err.status : 500;
    const message = err instanceof Error ? err.message : "No se ha podido retocar la imagen.";
    return Response.json({ error: message }, { status });
  }
}
