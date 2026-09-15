import type Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getClient, humanError, MODEL, tuning } from "@/lib/anthropic";
import { GeminiError, streamChat } from "@/lib/gemini";
import { keySource, resolveKey } from "@/lib/keys";
import { gastar } from "@/lib/limites";
import { CompatError, tieneVista, type CompatProvider } from "@/lib/openai-compat";
import { crearFiltroDeNegativa } from "@/lib/negativa";
import { conversarConHerramientas } from "@/lib/tools/bucle";
import { memoriaApagada } from "@/lib/auth";
import { hechosDe, quien as quienEsMemoria } from "@/lib/memoria/almacen";
import { comoFicha } from "@/lib/memoria/tipos";
import { herramientasPara } from "@/lib/tools/registro";
import { nombreActual } from "@/lib/auth";
import { currentPlan } from "@/lib/plan-server";
import { aligerarHistorial } from "@/lib/project";
import { buildSystemPrompt, partes3D, SEGUIR } from "@/lib/prompts";
import {
  activeProvider,
  motoresConOjos,
  providerForTurn,
  providerSearches,
  siguienteMotor,
} from "@/lib/provider";
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
  /** Viene de una llamada: se contesta para el oído y no para la pantalla. */
  voz?: boolean;
  /**
   * Dónde está, si dio permiso en Ajustes.
   *
   * Llega ya redondeada a un kilómetro desde el navegador, se usa para
   * contestar y se va con la petición: no se guarda en la base de datos ni en
   * la conversación. `lugar` es el nombre del sitio ("Zaragoza, Aragón,
   * España"), que el navegador ya resolvió una vez para no tener que
   * traducir coordenadas en cada mensaje.
   */
  ubicacion?: { lat: number; lon: number; lugar?: string };
  /** Chat temporal: ni se guarda ni se aprende nada de él. */
  temporal?: boolean;
}

const PRO_MODES: Mode[] = ["code"];

/**
 * La ubicación que llega del navegador, comprobada antes de usarla.
 *
 * Se comprueba porque llega de fuera: cualquiera puede mandar lo que quiera a
 * esta ruta. Coordenadas que no son números, o que no caben en un mapa, se
 * tiran; y el nombre del sitio se recorta, porque de ahí sale texto que acaba
 * dentro de las instrucciones del modelo.
 *
 * También se vuelve a redondear aquí aunque el navegador ya lo haga: el
 * redondeo es la promesa de que no guardamos el portal de nadie, y una
 * promesa que solo se cumple en el lado del cliente no es una promesa.
 */
function ubicacionLimpia(u: Body["ubicacion"]): Body["ubicacion"] {
  if (!u || typeof u !== "object") return undefined;
  const { lat, lon } = u;
  if (typeof lat !== "number" || typeof lon !== "number") return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  return {
    lat: Math.round(lat * 1000) / 1000,
    lon: Math.round(lon * 1000) / 1000,
    lugar: typeof u.lugar === "string" ? u.lugar.slice(0, 120) : undefined,
  };
}

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
    memoria?: string;
    mode: Mode;
    speed: Speed;
    plan: "free" | "pro";
    /** Cómo quiere que le llamen quien pregunta. */
    nombre?: string;
    /** Es una llamada de voz: se contesta para el oído, no para la pantalla. */
    voz?: boolean;
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
                nombre: opts.nombre,
                voz: opts.voz,
                lugar: opts.body.ubicacion?.lugar,
                memoria: opts.memoria,
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
    memoria?: string;
    mode: Mode;
    speed: Speed;
    plan: "free" | "pro";
    /** Cómo quiere que le llamen quien pregunta. */
    nombre?: string;
    /** Es una llamada de voz: se contesta para el oído, no para la pantalla. */
    voz?: boolean;
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
        nombre: opts.nombre,
        voz: opts.voz,
        lugar: opts.body.ubicacion?.lugar,
        memoria: opts.memoria,
      });

  for await (const event of streamChat({
    system: sistema,
    turns: opts.body.messages,
    speed: opts.speed,
    // Sin esto, con Google el archivo de ECLIPSE CODE salía cortado siempre.
    modo: opts.mode,
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
    memoria?: string;
    mode: Mode;
    speed: Speed;
    plan: "free" | "pro";
    /** Cómo quiere que le llamen quien pregunta. */
    nombre?: string;
    /** Es una llamada de voz: se contesta para el oído, no para la pantalla. */
    voz?: boolean;
    signal: AbortSignal;
    /** Última pasada: aunque no pueda con las fotos, que conteste igual. */
    sinAbandonar?: boolean;
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
  const hayOtroConOjos =
    !opts.sinAbandonar && (await motoresConOjos(opts.provider)).length > 0;
  send({ t: "status", v: "pensando" });

  /*
    Y el otro modo de fallar con una foto: decir que no.

    Hay modelos que aceptan la imagen, no la miran, y contestan «lo siento, no
    puedo ver imágenes». Para el proveedor eso es una respuesta correcta —no
    hay error que capturar— y para quien pregunta es el mismo fallo de antes,
    con el agravante de que se lo cuenta. Es justo lo que le pasaba a Carlos:
    «me dice que no puedo y luego lo hace».

    Como la negativa va siempre en la primera frase, con una foto delante se
    retienen los primeros caracteres antes de enseñarlos. Si son esa negativa,
    se abandona en silencio y contesta un motor con ojos; si no lo son, se
    sueltan de golpe y sigue todo igual. Retener 220 caracteres se nota menos
    que leer una excusa.
  */
  const filtro = crearFiltroDeNegativa(ultimaConImagen(opts.body.messages) && hayOtroConOjos);
  let negativa = false;

  /** Enseñar texto, marcando de paso que ya se ha escrito algo. */
  const escribir = (texto: string) => {
    if (!texto) return;
    if (!wrote) {
      wrote = true;
      send({ t: "status", v: "escribiendo" });
    }
    send({ t: "text", v: texto });
  };

  const ultimoTurno = [...opts.body.messages].reverse().find((m) => m.role === "user");
  const herramientas = await herramientasPara(opts.mode, opts.plan, {
    texto: ultimoTurno?.content ?? "",
    conImagen: Boolean(ultimoTurno?.attachments?.some((a) => a.kind === "image" && a.data)),
  });
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
          nombre: opts.nombre,
          voz: opts.voz,
          lugar: opts.body.ubicacion?.lugar,
          memoria: opts.memoria,
        }),
    turns: opts.body.messages,
    speed: opts.speed,
    mode: opts.mode,
    plan: opts.plan,
    ubicacion: opts.body.ubicacion,
    signal: opts.signal,
  });

  let fuentes: Source[] = [];
  let modelo: string | undefined;

  for await (const event of stream) {
    if (opts.signal.aborted) break;

    if (event.texto) {
      const { mostrar, negativa: excusa } = filtro.recibir(event.texto);
      if (excusa) {
        negativa = true;
        break;
      }
      escribir(mostrar);
    }

    if (event.herramienta) {
      // Si se pone a usar herramientas ya no está excusándose: fuera la retención.
      escribir(filtro.resto());
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

  // Lo que quede retenido al acabar es una respuesta corta y buena: se suelta.
  if (!negativa) escribir(filtro.resto());

  // Las fuentes ya se han ido mandando clasificadas durante el bucle, así que
  // aquí se devuelve la lista vacía para que la ruta no las vuelva a ordenar.
  void fuentes;
  return {
    sources: [] as { url: string; title?: string }[],
    stopReason: null as string | null,
    sinVista: (sinVista || negativa) && !wrote && hayOtroConOjos,
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

  /*
    Adelgazar aquí también, no solo en el navegador.

    El navegador ya lo hace —y ahí es donde se ahorra la subida, que en el móvil
    es lo que más se nota—, pero el navegador es de quien entra: basta con que
    alguien tenga la versión anterior guardada para que siga mandando todas las
    fotos de la conversación en cada mensaje. El cupo por minuto lo paga el
    servidor, así que la cuenta se hace también aquí. Pasarlo dos veces no hace
    nada: lo ya adelgazado se queda igual.
  */
  body.messages = aligerarHistorial(body.messages ?? []);
  body.ubicacion = ubicacionLimpia(body.ubicacion);

  /*
    Lo que ya se sabe de quien escribe.

    Se lee una vez por petición y no una vez por vuelta de herramienta: son
    cuatro líneas, pero una lectura de base de datos por vuelta serían tres o
    cuatro por respuesta para leer siempre lo mismo. Un chat temporal no la
    manda: ahí no se guarda nada y tampoco se recuerda nada.
  */
  let memoria = "";
  if (!body.temporal) {
    try {
      const quien = await quienEsMemoria();
      // Apagada de verdad: ni se usa ni se aprende. Un interruptor que solo
      // esconde lo que ya sabe no es un interruptor.
      if (quien && !(await memoriaApagada(quien)))
        memoria = comoFicha((await hechosDe(quien)).slice(0, 20));
    } catch {
      /* sin memoria se responde igual; simplemente no se acuerda */
    }
  }

  const plan = await currentPlan();
  // Cómo quiere que le llamen. Se lee aquí, del servidor, y no de lo que mande
  // el navegador: el nombre acaba dentro de las instrucciones del modelo, y eso
  // no es sitio para texto que pueda escribir cualquiera desde fuera.
  const nombre = await nombreActual();
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
  const hayImagenes = body.messages.some((m) =>
    m.attachments?.some((a) => a.kind === "image" && a.data),
  );

  let provider = await providerForTurn(deVuelta, hayImagenes, body.mode === "code");

  /*
    Con una foto delante, se COMPRUEBA quién puede verla antes de mandar nada.

    Intentarlo y que te rechacen la imagen sale caro: un viaje perdido, y si
    después falla el recambio el usuario acaba leyendo "no puedo ver imágenes",
    que es lo único que no puede pasar. Y no se puede saber de antemano sin
    mirar: una cuenta de Mistral puede tener Pixtral y otra no, y eso cambia
    cuando al proveedor le da por mover su catálogo.

    Así que se le pregunta al catálogo, que está cacheado y no cuesta nada a
    partir de la primera vez, y responde quien de verdad puede.
  */
  if (hayImagenes && provider && provider !== "google" && provider !== "anthropic") {
    const puede = await tieneVista(provider as CompatProvider, await resolveKey(provider));

    if (puede !== "si") {
      for (const otro of await motoresConOjos(provider)) {
        // Google y Anthropic miran imágenes siempre: no hay nada que preguntar.
        if (otro === "google" || otro === "anthropic") {
          provider = otro;
          break;
        }
        if ((await tieneVista(otro as CompatProvider, await resolveKey(otro))) === "si") {
          provider = otro;
          break;
        }
      }
      // Y si nadie ha dicho "sí" pero el de turno tampoco dijo "no" —su
      // catálogo no se pudo consultar—, se queda él y que lo intente: mejor
      // probar que descartarlo por una consulta que falló.
    }
  }
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
      /*
        Nadie se queda mirando una burbuja vacía.

        Por muchas vueltas que dé la respuesta —cambios de motor, reintentos,
        fotos que un modelo no traga—, si al final no se ha escrito ni una
        palabra hay que decir algo. Una burbuja en blanco parece que la
        aplicación se ha colgado, y encima no da ninguna pista de qué hacer.
      */
      let escritoAlgo = false;

      const send = (e: StreamEvent) => {
        if (e.t === "text" && String(e.v).trim()) escritoAlgo = true;
        if (e.t === "error") escritoAlgo = true;
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
        const shared = { body, mode, speed, plan, wantsWeb, nombre, memoria, voz: body.voz === true, signal: req.signal };

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
        /*
          Al motor de turno se le ha acabado el cupo: se pasa al siguiente.

          Esto importa mucho más desde que la clave puede estar puesta en el
          servidor: ahí el cupo no lo gasta una persona, lo gastan todas a la
          vez, y el día que se agote no puede quedarse la aplicación muerta
          para todo el mundo. Se prueba el que tocaba antes de desviar por la
          foto, y si ese tampoco, el siguiente que tenga clave.
        */
        /*
          ¿Esto es problema de ESTE motor, o de la petición?

          Si es del motor —se quedó sin cupo, o no tiene ahora mismo ningún
          modelo servible— lo que toca es probar el siguiente, no enseñar un
          error. Carlos se encontró un «Groq no tiene ningún modelo que esta
          aplicación pueda usar» en rojo, con Mistral configurado y disponible
          al lado sin que nadie lo intentara. Antes esto solo miraba el cupo;
          quedarse sin modelos es exactamente el mismo caso y acababa distinto.
        */
        const esDeEsteMotor = (err: unknown) =>
          (err instanceof GeminiError || err instanceof CompatError) &&
          (err.status === 429 ||
            err.status === 413 ||
            err.status === 404 ||
            /cuota|quota|l[íi]mite|rate|ning[úu]n modelo/i.test(err.message));

        let result;
        try {
          result = await correr(provider);
        } catch (err) {
          if (!provider || !esDeEsteMotor(err)) throw err;

          const recambios = [deVuelta, await siguienteMotor(provider)].filter(
            (p, i, todos): p is NonNullable<typeof p> =>
              Boolean(p) && p !== provider && todos.indexOf(p) === i,
          );
          if (recambios.length === 0) throw err;

          let ultimo = err;
          let hecho = null as Awaited<ReturnType<typeof correr>> | null;
          for (const recambio of recambios) {
            try {
              send({ t: "status", v: "pensando" });
              hecho = await correr(recambio);
              break;
            } catch (otro) {
              ultimo = otro;
            }
          }
          if (!hecho) throw ultimo;
          result = hecho;
        }

        /*
          Se ha quedado sin las fotos y todavía no ha escrito nada: se cambia a
          Google, que sí las ve, y el usuario ni se entera. Esto es la red de
          seguridad de lo de arriba —donde ya se elige Google si hay foto—, y
          está aquí porque quien decide de verdad si un modelo puede con una
          imagen es el proveedor, no nosotros.
        */
        /*
          Se ha quedado sin las fotos: se prueban los demás motores hasta que
          uno pueda verlas.

          Antes solo se probaba Google, y si no había clave suya el usuario
          recibía un "cambia el motor a Google en Ajustes". Eso no es una
          respuesta: es pedirle que configure algo para que la aplicación haga
          lo que ya sabe hacer. Con tres motores puestos, alguno ve.
        */
        if ("sinVista" in result && result.sinVista) {
          let resuelto = false;

          for (const conOjos of await motoresConOjos(provider)) {
            send({ t: "status", v: "pensando" });
            const intento = await correr(conOjos).catch(() => null);
            if (intento && !("sinVista" in intento && intento.sinVista)) {
              result = intento;
              resuelto = true;
              break;
            }
          }

          /*
            Ninguno ha podido con la foto. Entonces se vuelve al de siempre y se
            le deja contestar SIN ella.

            Sin esto, el usuario se quedaba mirando una burbuja vacía: el primer
            motor se abandonaba antes de escribir nada —para no gastar palabras
            en una respuesta que iba a repetirse—, los recambios tampoco daban
            resultado, y nadie escribía. Silencio. Peor que cualquier respuesta.
          */
          if (!resuelto && provider !== "google" && provider !== "anthropic") {
            send({ t: "status", v: "pensando" });
            result = await runCompat(send, {
              ...shared,
              provider: provider as CompatProvider,
              sinAbandonar: true,
            });
          }
        }

        if (!escritoAlgo && !req.signal.aborted)
          send({
            t: "error",
            v: "No he podido responder a esto. Vuelve a intentarlo con Reintentar; si se repite, prueba a decírmelo de otra forma.",
          });

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
