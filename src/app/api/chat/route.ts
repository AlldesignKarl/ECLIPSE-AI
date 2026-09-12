import type Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getClient, humanError, MODEL, tuning } from "@/lib/anthropic";
import { GeminiError, streamChat } from "@/lib/gemini";
import { keySource, resolveKey } from "@/lib/keys";
import { CompatError, streamCompat, type CompatProvider } from "@/lib/openai-compat";
import { currentPlan } from "@/lib/plan-server";
import { buildSystemPrompt } from "@/lib/prompts";
import { activeProvider, providerSearches } from "@/lib/provider";
import { rankSources } from "@/lib/sources";
import { priceLabelLive, stripeAvailable } from "@/lib/stripe";
import { SSE_HEADERS, sseChunk, type StreamEvent } from "@/lib/sse";
import type { Attachment, Mode, Speed } from "@/lib/types";

export const runtime = "nodejs";
// El plan gratuito de Vercel corta las funciones a los 60 s. Si despliegas en
// un plan de pago o en tu propio servidor, puedes subir este número.
export const maxDuration = 60;

interface Turn {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
}

interface Body {
  messages: Turn[];
  mode: Mode;
  speed: Speed;
  /** Fuerza la búsqueda web aunque el modo sea conversación. */
  deepSearch?: boolean;
}

const PRO_MODES: Mode[] = ["bot"];

/** Lo que ECLIPSE tiene que saber de su propia app: precio, pago y clave. */
async function product(provider: Awaited<ReturnType<typeof activeProvider>>) {
  return {
    price: await priceLabelLive(),
    billingEnabled: stripeAvailable(),
    // Con la clave puesta en el servidor nadie tiene que configurar nada, y
    // decirle al usuario que la ponga sería mandarle a una tarea inexistente.
    claveEnServidor:
      provider === "anthropic" ||
      (provider !== null && (await keySource(provider)) === "entorno"),
  };
}
const MAX_CONTINUATIONS = 4;

/* ------------------------------ Anthropic ------------------------------ */

function toContentBlocks(turn: Turn): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];

  for (const file of turn.attachments ?? []) {
    if (file.kind === "image") {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: file.mime as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: file.data,
        },
      });
    } else if (file.kind === "video") {
      blocks.push({
        type: "text",
        text: `(El usuario ha adjuntado el vídeo "${file.name}". Este motor no puede verlo: dilo con naturalidad y pídele una captura del momento que le interese.)`,
      });
    } else if (file.kind === "pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: file.data },
        title: file.name,
        citations: { enabled: true },
      });
    } else {
      blocks.push({
        type: "text",
        text: `<archivo nombre="${file.name}">\n${file.data}\n</archivo>`,
      });
    }
  }

  if (turn.content.trim()) blocks.push({ type: "text", text: turn.content });
  if (blocks.length === 0) blocks.push({ type: "text", text: "(sin texto)" });
  return blocks;
}

function collectSources(content: Anthropic.Beta.BetaContentBlock[]) {
  const found: { url: string; title?: string }[] = [];

  for (const block of content) {
    if (block.type === "web_search_tool_result") {
      const results = block.content;
      if (Array.isArray(results)) {
        for (const r of results) {
          if ("url" in r && r.url) found.push({ url: r.url, title: r.title ?? undefined });
        }
      }
    }
    if (block.type === "text" && Array.isArray(block.citations)) {
      for (const c of block.citations) {
        if ("url" in c && typeof c.url === "string" && c.url) {
          const title = "title" in c && typeof c.title === "string" ? c.title : undefined;
          found.push({ url: c.url, title });
        }
      }
    }
  }
  return found;
}

async function runAnthropic(
  send: (e: StreamEvent) => void,
  opts: {
    body: Body;
    mode: Mode;
    speed: Speed;
    plan: "free" | "pro";
    wantsWeb: boolean;
    signal: AbortSignal;
  },
) {
  const { effort, maxTokens, fast } = tuning(opts.speed, opts.plan);
  const client = getClient();

  const tools: Anthropic.Beta.BetaToolUnion[] = opts.wantsWeb
    ? [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: opts.mode === "search" ? 8 : 4,
        },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 4, citations: { enabled: true } },
      ]
    : [];

  const messages: Anthropic.Beta.BetaMessageParam[] = opts.body.messages.map((turn) => ({
    role: turn.role,
    content:
      turn.role === "user"
        ? toContentBlocks(turn)
        : [{ type: "text" as const, text: turn.content || "(vacío)" }],
  }));

  const sources: { url: string; title?: string }[] = [];
  let continuations = 0;
  let stopReason: string | null = null;

  do {
    const run = client.beta.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      system: [
        {
          type: "text",
          text: buildSystemPrompt({
            ...(await product("anthropic")),
            mode: opts.mode,
            plan: opts.plan,
            web: opts.wantsWeb,
            engine: "anthropic",
          }),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort },
      ...(tools.length ? { tools } : {}),
      ...(fast ? { speed: "fast" as const, betas: ["fast-mode-2026-02-01"] } : {}),
      stream: true,
    });

    for await (const event of run) {
      if (opts.signal.aborted) {
        run.abort();
        break;
      }
      switch (event.type) {
        case "content_block_start": {
          const block = event.content_block;
          if (block.type === "thinking") send({ t: "status", v: "pensando" });
          else if (block.type === "text") send({ t: "status", v: "escribiendo" });
          else if (block.type === "server_tool_use")
            send({ t: "status", v: block.name === "web_fetch" ? "leyendo" : "buscando" });
          else if (block.type === "web_search_tool_result") send({ t: "status", v: "procesando" });
          break;
        }
        case "content_block_delta": {
          const d = event.delta;
          if (d.type === "text_delta") send({ t: "text", v: d.text });
          else if (d.type === "thinking_delta") send({ t: "thinking", v: d.thinking });
          break;
        }
        case "message_delta":
          stopReason = event.delta.stop_reason ?? null;
          break;
      }
    }

    if (opts.signal.aborted) break;

    const final = await run.finalMessage();
    stopReason = final.stop_reason;
    sources.push(...collectSources(final.content));

    if (final.stop_reason === "refusal") {
      send({
        t: "error",
        v: "El modelo ha declinado responder por motivos de seguridad. Prueba a reformular la petición.",
      });
      break;
    }

    if (final.stop_reason === "pause_turn" && continuations < MAX_CONTINUATIONS) {
      messages.push({ role: "assistant", content: final.content });
      continuations++;
      send({ t: "status", v: "procesando" });
      continue;
    }
    break;
  } while (continuations <= MAX_CONTINUATIONS);

  return { sources, stopReason };
}

/* -------------------------------- Google -------------------------------- */

async function runGoogle(
  send: (e: StreamEvent) => void,
  opts: {
    body: Body;
    mode: Mode;
    speed: Speed;
    plan: "free" | "pro";
    wantsWeb: boolean;
    signal: AbortSignal;
  },
) {
  const sources: { url: string; title?: string; domainHint?: string }[] = [];
  let wrote = false;

  send({ t: "status", v: opts.wantsWeb ? "buscando" : "pensando" });

  const stream = streamChat({
    system: buildSystemPrompt({
      ...(await product("google")),
      mode: opts.mode,
      plan: opts.plan,
      web: opts.wantsWeb,
      engine: "google",
    }),
    turns: opts.body.messages,
    speed: opts.speed,
    webSearch: opts.wantsWeb,
    key: await resolveKey("google"),
    signal: opts.signal,
  });

  for await (const event of stream) {
    if (opts.signal.aborted) break;
    if (event.waiting) send({ t: "status", v: "esperando" });
    if (event.searching) send({ t: "status", v: "buscando" });
    if (event.sources) sources.push(...event.sources);
    if (event.text) {
      if (!wrote) {
        wrote = true;
        send({ t: "status", v: "escribiendo" });
      }
      send({ t: "text", v: event.text });
    }
  }

  return { sources, stopReason: null as string | null };
}

/* ------------------------- Groq / OpenRouter ---------------------------- */

async function runCompat(
  send: (e: StreamEvent) => void,
  opts: {
    provider: CompatProvider;
    body: Body;
    mode: Mode;
    speed: Speed;
    plan: "free" | "pro";
    signal: AbortSignal;
  },
) {
  let wrote = false;
  send({ t: "status", v: "pensando" });

  const stream = streamCompat({
    provider: opts.provider,
    key: await resolveKey(opts.provider),
    // Estos motores no navegan: se lo decimos para que no finja que ha buscado.
    system: buildSystemPrompt({
      ...(await product(opts.provider)),
      mode: opts.mode,
      plan: opts.plan,
      web: false,
      engine: opts.provider,
    }),
    turns: opts.body.messages,
    speed: opts.speed,
    signal: opts.signal,
  });

  for await (const event of stream) {
    if (opts.signal.aborted) break;
    if (event.text) {
      if (!wrote) {
        wrote = true;
        send({ t: "status", v: "escribiendo" });
      }
      send({ t: "text", v: event.text });
    }
  }

  return { sources: [] as { url: string; title?: string }[], stopReason: null as string | null };
}

/* -------------------------------- Ruta ---------------------------------- */

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Petición mal formada." }, { status: 400 });
  }

  const plan = await currentPlan();
  const mode: Mode = body.mode ?? "chat";
  const speed: Speed = body.speed ?? "equilibrado";

  if (PRO_MODES.includes(mode) && plan !== "pro") {
    return Response.json(
      { error: "Este modo forma parte del plan Pro.", code: "pro_required" },
      { status: 402 },
    );
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "No hay mensajes que responder." }, { status: 400 });
  }

  const provider = await activeProvider();
  if (!provider) {
    return Response.json(
      {
        error:
          "Todavía no has puesto la clave de la IA. Ábrela en Ajustes (las tres rayitas) y pega ahí una clave gratuita: la de Groq se saca en console.groq.com/keys en un minuto y no pide tarjeta.",
        code: "no_key",
      },
      { status: 503 },
    );
  }

  const wantsWeb =
    providerSearches(provider) && (mode === "search" || body.deepSearch === true || mode === "chat");
  const started = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => {
        try {
          controller.enqueue(sseChunk(e));
        } catch {
          /* cliente desconectado */
        }
      };

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          /* ignorar */
        }
      }, 15000);

      try {
        send({ t: "status", v: "conectando" });
        const shared = { body, mode, speed, plan, wantsWeb, signal: req.signal };

        const result =
          provider === "google"
            ? await runGoogle(send, shared)
            : provider === "anthropic"
              ? await runAnthropic(send, shared)
              : await runCompat(send, { ...shared, provider });

        if (result.sources.length) send({ t: "sources", v: rankSources(result.sources) });
        send({
          t: "done",
          v: {
            elapsedMs: Date.now() - started,
            provider,
            stopReason: result.stopReason,
          },
        });
      } catch (err) {
        send({
          t: "error",
          v:
            err instanceof GeminiError || err instanceof CompatError
              ? err.message
              : humanError(err),
        });
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
