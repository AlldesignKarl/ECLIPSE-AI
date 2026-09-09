import { NextRequest } from "next/server";
import { MediaError, pollVideo } from "@/lib/media";
import { currentPlan } from "@/lib/plan-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if ((await currentPlan()) !== "pro")
    return Response.json({ error: "Plan Pro requerido." }, { status: 402 });

  const operation = req.nextUrl.searchParams.get("operation");
  if (!operation || !operation.startsWith("operations/"))
    return Response.json({ error: "Operación no válida." }, { status: 400 });

  try {
    return Response.json(await pollVideo(operation));
  } catch (err) {
    const status = err instanceof MediaError ? err.status : 500;
    return Response.json(
      { error: err instanceof Error ? err.message : "Error consultando el vídeo." },
      { status },
    );
  }
}
