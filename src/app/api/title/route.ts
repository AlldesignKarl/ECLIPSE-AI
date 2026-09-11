import { NextRequest } from "next/server";
import { getClient, MODEL } from "@/lib/anthropic";
import { oneShot } from "@/lib/gemini";
import { resolveGoogleKey } from "@/lib/keys";
import { TITLE_PROMPT } from "@/lib/prompts";
import { activeProvider } from "@/lib/provider";

export const runtime = "nodejs";

function clean(raw: string): string {
  return raw.replace(/["'.]/g, "").trim().slice(0, 60) || "Nueva conversación";
}

/** Título corto para la conversación. Barato y rápido: no pensamos nada. */
export async function POST(req: NextRequest) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text?.trim()) return Response.json({ title: "Nueva conversación" });

  const provider = await activeProvider();
  const snippet = text.slice(0, 1500);

  try {
    if (provider === "google") {
      const key = await resolveGoogleKey();
      return Response.json({ title: clean(await oneShot(`${TITLE_PROMPT}\n\n${snippet}`, key)) });
    }

    if (provider === "anthropic") {
      const res = await getClient().messages.create({
        model: MODEL,
        max_tokens: 32,
        output_config: { effort: "low" },
        system: TITLE_PROMPT,
        messages: [{ role: "user", content: snippet }],
      });
      const title = res.content
        .filter((b): b is { type: "text"; text: string; citations: null } => b.type === "text")
        .map((b) => b.text)
        .join(" ");
      return Response.json({ title: clean(title) });
    }
  } catch {
    // El título es cosmético: si falla, seguimos con el de por defecto.
  }

  return Response.json({ title: "Nueva conversación" });
}
