import { NextRequest } from "next/server";
import { getClient, MODEL } from "@/lib/anthropic";
import { TITLE_PROMPT } from "@/lib/prompts";

export const runtime = "nodejs";

/** Título corto para la conversación. Barato y rápido: no pensamos nada. */
export async function POST(req: NextRequest) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text?.trim()) return Response.json({ title: "Nueva conversación" });

  try {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: 32,
      output_config: { effort: "low" },
      system: TITLE_PROMPT,
      messages: [{ role: "user", content: text.slice(0, 1500) }],
    });

    const title = res.content
      .filter((b): b is { type: "text"; text: string; citations: null } => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .replace(/["'.]/g, "")
      .trim();

    return Response.json({ title: title.slice(0, 60) || "Nueva conversación" });
  } catch {
    // El título es cosmético: si falla, seguimos con el de por defecto.
    return Response.json({ title: "Nueva conversación" });
  }
}
