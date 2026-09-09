import { NextRequest } from "next/server";
import { fetchVideoBytes, MediaError } from "@/lib/media";
import { currentPlan } from "@/lib/plan-server";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Sirve el vídeo generado sin exponer la clave de Google al navegador. */
export async function GET(req: NextRequest) {
  if ((await currentPlan()) !== "pro")
    return Response.json({ error: "Plan Pro requerido." }, { status: 402 });

  const uri = req.nextUrl.searchParams.get("uri");
  if (!uri) return Response.json({ error: "Falta el parámetro uri." }, { status: 400 });

  try {
    const upstream = await fetchVideoBytes(uri);
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "video/mp4",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    const status = err instanceof MediaError ? err.status : 500;
    return Response.json(
      { error: err instanceof Error ? err.message : "Error descargando el vídeo." },
      { status },
    );
  }
}
