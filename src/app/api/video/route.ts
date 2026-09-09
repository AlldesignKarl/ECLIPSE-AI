import { NextRequest } from "next/server";
import { MediaError, startVideo } from "@/lib/media";
import { currentPlan } from "@/lib/plan-server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if ((await currentPlan()) !== "pro")
    return Response.json(
      { error: "La generación de vídeo es del plan Pro.", code: "pro_required" },
      { status: 402 },
    );

  const { prompt, aspectRatio } = (await req.json().catch(() => ({}))) as {
    prompt?: string;
    aspectRatio?: string;
  };
  if (!prompt?.trim())
    return Response.json({ error: "Describe el vídeo que quieres." }, { status: 400 });

  try {
    return Response.json(await startVideo(prompt.trim(), aspectRatio || "16:9"));
  } catch (err) {
    const status = err instanceof MediaError ? err.status : 500;
    return Response.json(
      { error: err instanceof Error ? err.message : "Error generando el vídeo." },
      { status },
    );
  }
}
