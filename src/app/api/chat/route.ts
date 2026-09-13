import type Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getClient, humanError, MODEL, tuning } from "@/lib/anthropic";
import { GeminiError, streamChat } from "@/lib/gemini";
import { keyAvailable, keySource, resolveKey } from "@/lib/keys";
import { gastar } from "@/lib/limites";
import { CompatError, type CompatProvider } from "@/lib/openai-compat";
import { conversarConHerramientas } from "@/lib/tools/bucle";
import { herramientasPara } from "@/lib/tools/registro";
import { currentPlan } from "@/lib/plan-server";
import { buildSystemPrompt, partes3D, SEGUIR } from "@/lib/prompts";
import { activeProvider, providerForTurn, providerSearches } from "@/lib/provider";
import { rankSources } from "@/lib/sources";
import { priceLabelLive, stripeAvailable } from "@/lib/stripe";
import { SSE_HEADERS, sseChunk, type StreamEvent } from "@/lib/sse";
import type { Attachment, Mode, Source, Speed } from "@/lib/types";

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
  /** Esto no es una respuesta nueva: es terminar una que se cortó. */
  continuar?: boolean;
}

const PRO_MODES: Mode[] = ["code"];

/**
 * ¿Hay una foto reciente en la conversación? De eso depende que se le explique
 * al modelo que puede devolverla retocada. Se miran los últimos mensajes y no
 * toda la conversación: ofrecer retocar una imagen de hace veinte mensajes
 * confunde más que ayuda.
 */
function ultimaConImagen(messages: Turn[]): boolean {
  // Los tres últimos, no solo el último. Lo normal es mandar la foto, hablar de
  // ella y luego decir "¿le cambiarías algo?" sin volver a adjuntarla. Mirando
  // solo el último mensaje, justo ahí es donde se perdía la posibilidad de
  // retocarla, que es cuando de verdad se pide.
  return messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .some((m) => m.attachments?.some((a) => a.kind === "image"));
}

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
          // Con la búsqueda forzada se le dan más usos: es cuando de verdad
          // se le está pidiendo que contraste, no que mire una cosa.
          max_uses: opts.body.deepSearch ? 8 : 4,
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
          text: opts.body.continuar
            ? SEGUIR
            : buildSystemPrompt({
                ...(await product("anthropic")),
                mode: opts.mode,
                plan: opts.plan,
                web: opts.wantsWeb,
                engine: "anthropic",
                conImagen: ultimaConImagen(opts.body.messages),
                tres3D: partes3D(opts.body.messages),
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

  const key = await resolveKey("google");
  const sistema = opts.body.continuar
    ? SEGUIR
    : buildSystemPrompt({
        ...(await product("google")),
        mode: opts.mode,
        plan: opts.plan,
        web: opts.wantsWeb,
        engine: "google",
        conImagen: ultimaConImagen(opts.body.messages),
        tres3D: partes3D(opts.body.messages),
      });

  for await (const event of streamChat({
    system: sistema,
    turns: opts.body.messages,
    speed: opts.speed,
    webSearch: opts.wantsWeb,
    key,
    signal: opts.signal,
  })) {
    if (opts.signal.aborted) break;
    if (event.waiting) send({ t: "status", v: "esperando" });
    if (event.searching) send({ t: "status", v: "buscando" });
    if (event.sources) sources.push(...event.sources);
    if (event.pensando) send({ t: "thinking", v: event.pensando });
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
  /*
    Este motor no ha podido con las fotos.

    Se sabe antes de que escriba una sola palabra, así que todavía se está a
    tiempo de irse a otro que sí pueda. Lo que había antes era entregarle al
    usuario un "este motor no puede ver imágenes": a quien ya conoce la
    aplicación le sonará a excusa, y a quien entra por primera vez le parecerá
    que no funciona. Ninguna de las dos cosas hace falta si hay un motor con
    ojos a mano.
  */
  let sinVista = false;
  /*
    Solo tiene sentido abandonar si hay a dónde ir.

    Sin clave de Google, cortar aquí dejaría al usuario con la respuesta en
    blanco, que es peor que la explicación de por qué no se ve la foto. Así que
    en ese caso se deja seguir: al menos contesta y le dice qué hacer.
  */
  const hayOtroConOjos = await keyAvailable("google");
  send({ t: "status", v: "pensando" });

  const herramientas = await herramientasPara(opts.mode, opts.plan);
  // Estos motores no navegan por su cuenta. Con un buscador configurado sí
  // pueden, pero a través de nuestra herramienta, así que lo que hay que
  // decirles cambia: sin ella, que no finjan haber buscado; con ella, cómo
  // usarla. El prompt lo decide `web`.
  const puedeBuscar = herramientas.some((h) => h.nombre === "buscar_web");

  const stream = conversarConHerramientas({
    provider: opts.provider,
    key: await resolveKey(opts.provider),
    system: opts.body.continuar
      ? SEGUIR
      : buildSystemPrompt({
          ...(await product(opts.provider)),
          mode: opts.mode,
          plan: opts.plan,
          web: puedeBuscar,
          engine: opts.provider,
          conImagen: ultimaConImagen(opts.body.messages),
          tres3D: partes3D(opts.body.messages),
          conHerramientas: herramientas.map((h) => h.nombre),
        }),
    turns: opts.body.messages,
    speed: opts.speed,
    mode: opts.mode,
    plan: opts.plan,
    signal: opts.signal,
  });

  let fuentes: Source[] = [];
  let modelo: string | undefined;

  for await (const event of stream) {
    if (opts.signal.aborted) break;

    if (event.texto) {
      if (!wrote) {
        wrote = true;
        send({ t: "status", v: "escribiendo" });
      }
      send({ t: "text", v: event.texto });
    }

    if (event.herramienta) {
      send({ t: "tool", v: event.herramienta });
      send({
        t: "status",
        v:
          event.herramienta.nombre === "buscar_web"
            ? "buscando"
            : event.herramienta.nombre === "crear_imagen"
              ? "generando_imagen"
              : "procesando",
      });
    }
    if (event.hecha) send({ t: "tool_done", v: event.hecha });
    if (event.fuentes) {
      fuentes = event.fuentes;
      send({ t: "sources", v: fuentes });
    }
    if (event.archivo) send({ t: "file", v: event.archivo });
    if (event.imagen) send({ t: "artifact", v: event.imagen });
    if (event.pensando) send({ t: "thinking", v: event.pensando });
    if (event.cortado) send({ t: "meta", v: { cortado: true } });
    if (event.sinVista) {
      sinVista = true;
      if (!wrote && hayOtroConOjos) break;
    }
    if (event.modelo) {
      modelo = event.modelo;
      send({ t: "meta", v: { modelo } });
    }
  }

  // Las fuentes ya se han ido mandando clasificadas durante el bucle, así que
  // aquí se devuelve la lista vacía para que la ruta no las vuelva a ordenar.
  void fuentes;
  return {
    sources: [] as { url: string; title?: string }[],
    stopReason: null as string | null,
    sinVista: sinVista && !wrote && hayOtroConOjos,
  };
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

  /*
    La velocidad se comprueba aquí, no solo en la pantalla.

    Rápido y Profundo se venden como parte del plan Pro, y hasta ahora eso era
    verdad solo en la lista de planes: el servidor aceptaba lo que le mandaran.
    Quien supiera mandar una petición a mano tenía el plan Pro gratis, y una
    función que se cobra pero no se comprueba es una función regalada.

    No se devuelve un error: se responde igual, en Equilibrado. Cortarle la
    respuesta a alguien por haber tocado un botón que la pantalla le dejaba
    tocar sería castigarle por un fallo nuestro.
  */
  const pedida: Speed = body.speed ?? "equilibrado";
  const speed: Speed = plan === "pro" ? pedida : "equilibrado";

  if (PRO_MODES.includes(mode) && plan !== "pro") {
    return Response.json(
      { error: "Este modo forma parte del plan Pro.", code: "pro_required" },
      { status: 402 },
    );
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "No hay mensajes que responder." }, { status: 400 });
  }

  // Con una foto delante manda quien sepa verla, no quien esté puesto. Se
  // guarda también el de siempre, por si a Google se le ha acabado la cuota.
  const deVuelta = await activeProvider();
  const provider = await providerForTurn(
    deVuelta,
    body.messages.some((m) => m.attachments?.some((a) => a.kind === "image" && a.data)),
    body.mode === "code",
  );
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

  // El cupo se gasta después de saber que hay motor, y no antes: comprobar el
  // motor no cuesta nada —es mirar variables de entorno— y cobrarle a alguien
  // un mensaje por una petición que el servidor no podía atender es injusto.
  const cupo = await gastar("chat", plan);
  if (!cupo.permitido) {
    return Response.json({ error: cupo.mensaje, code: "sin_cupo" }, { status: 429 });
  }

  const wantsWeb =
    providerSearches(provider) && (mode === "chat" || body.deepSearch === true);
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

        const correr = async (quien: typeof provider) =>
          quien === "google"
            ? runGoogle(send, shared)
            : quien === "anthropic"
              ? runAnthropic(send, shared)
              : runCompat(send, { ...shared, provider: quien });

        /*
          Si a Google se le acabó la cuota, que no se quede aquí la cosa.

          A un mensaje con foto se le manda a Google porque es quien seguro
          sabe verla. Pero su capa gratuita es corta y se agota a diario, y
          entonces lo que recibía el usuario era un error en vez de una
          respuesta. Así que se vuelve al motor de siempre, que con la foto
          hará lo que pueda: intentarlo, y si el modelo la rechaza, decirlo.
          Una respuesta imperfecta es mejor que ninguna.
        */
        let result;
        try {
          result = await correr(provider);
        } catch (err) {
          const sinCuota =
            err instanceof GeminiError && (err.status === 429 || /cuota|quota|rate/i.test(err.message));
          if (!provider || provider === deVuelta || !sinCuota || !deVuelta) throw err;
          send({ t: "status", v: "pensando" });
          result = await correr(deVuelta);
        }

        /*
          Se ha quedado sin las fotos y todavía no ha escrito nada: se cambia a
          Google, que sí las ve, y el usuario ni se entera. Esto es la red de
          seguridad de lo de arriba —donde ya se elige Google si hay foto—, y
          está aquí porque quien decide de verdad si un modelo puede con una
          imagen es el proveedor, no nosotros.
        */
        if ("sinVista" in result && result.sinVista && (await keyAvailable("google"))) {
          send({ t: "status", v: "pensando" });
          result = await correr("google");
        }

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

  // Cuántas le quedan hoy, para poder avisar antes de que se acaben en vez de
  // cortarle en seco. Viaja en una cabecera porque el cuerpo es un flujo que
  // empieza a salir mucho antes de que nadie lo termine de leer.
  return new Response(stream, {
    headers: { ...SSE_HEADERS, "X-Eclipse-Restantes": String(cupo.restantes) },
  });
}
