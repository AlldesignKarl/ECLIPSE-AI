import type { Attachment, Mode, Speed } from "./types";

/**
 * Motores que hablan el dialecto de OpenAI (`/chat/completions`). Con una sola
 * implementación cubrimos varios proveedores con capa gratuita de verdad:
 *
 * - Groq: rápido y con el límite diario más generoso. Sin tarjeta.
 * - OpenRouter: muchos modelos, varios gratuitos. Sin tarjeta.
 *
 * Todos usan modelos abiertos (Llama, Qwen, Mistral…). No llegan al nivel de
 * Gemini o Claude, pero conversan, escriben y programan con soltura.
 */

export type CompatProvider = "groq" | "openrouter";

interface Preset {
  label: string;
  base: string;
  /** Modelo preferido; si no existe, se busca uno en la cuenta. */
  model: string;
  /** Cómo reconocer un modelo bueno para chat en la lista del proveedor. */
  prefer: RegExp;
  /** Qué modelos saben mirar imágenes. */
  vision: RegExp;
  keyUrl: string;
}

export const PRESETS: Record<CompatProvider, Preset> = {
  groq: {
    label: "Groq · gratis, sin tarjeta",
    base: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    prefer: /llama.*70b|llama.*versatile|gpt-oss/i,
    vision: /llama-4|scout|maverick|vision/i,
    keyUrl: "https://console.groq.com/keys",
  },
  openrouter: {
    label: "OpenRouter · modelos gratuitos",
    base: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    prefer: /:free$/i,
    vision: /llama-4|vision|-vl|gemini|gpt-4|gpt-5|claude/i,
    keyUrl: "https://openrouter.ai/keys",
  },
};

export class CompatError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
  }
}

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content:
    | string
    | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
  /** Las llamadas que pidió el modelo, cuando el turno es suyo. */
  tool_calls?: LlamadaCruda[];
  /** A qué llamada responde este turno, cuando el papel es `tool`. */
  tool_call_id?: string;
}

/** Una llamada a herramienta tal y como la escriben estos modelos. */
export interface LlamadaCruda {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** Un turno más de los que van y vienen dentro del bucle de herramientas. */
export type TurnoExtra =
  | { role: "assistant"; content: string; tool_calls: LlamadaCruda[] }
  | { role: "tool"; tool_call_id: string; content: string };

function toMessages(
  system: string,
  turns: { role: "user" | "assistant"; content: string; attachments?: Attachment[] }[],
  vision: boolean,
  /** Lo que ya se ha hablado con las herramientas en esta misma respuesta. */
  extra: TurnoExtra[] = [],
): Message[] {
  const out: Message[] = [{ role: "system", content: system }];

  for (const turn of turns) {
    const images = (turn.attachments ?? []).filter((a) => a.kind === "image" && a.data);
    const videos = (turn.attachments ?? []).filter((a) => a.kind === "video");
    const texts = (turn.attachments ?? [])
      .filter((a) => a.kind === "text" && a.data)
      .map((a) => `<archivo nombre="${a.name}">\n${a.data}\n</archivo>`);

    const written =
      [
        ...texts,
        ...videos.map(
          (a) =>
            `(El usuario ha adjuntado el vídeo "${a.name}". Este motor no puede verlo: dilo con naturalidad y pídele una captura.)`,
        ),
        turn.content,
      ]
        .filter(Boolean)
        .join("\n\n") || "(sin texto)";

    if (turn.role === "user" && images.length && !vision) {
      out.push({
        role: "user",
        content: `${written}\n\n(El usuario ha adjuntado ${images.length} imagen(es). Este motor no puede verlas: dilo con naturalidad y pídele que te las describa.)`,
      });
    } else if (turn.role === "user" && images.length) {
      out.push({
        role: "user",
        content: [
          ...images.map((a) => ({
            type: "image_url" as const,
            image_url: { url: `data:${a.mime};base64,${a.data}` },
          })),
          { type: "text" as const, text: written },
        ],
      });
    } else {
      out.push({ role: turn.role, content: written });
    }
  }

  // El ida y vuelta con las herramientas va al final, en el orden en que
  // ocurrió: el modelo necesita ver su propia llamada justo antes de la
  // respuesta que le dieron, o no sabe a qué corresponde cada resultado.
  for (const t of extra) {
    if (t.role === "assistant")
      out.push({ role: "assistant", content: t.content, tool_calls: t.tool_calls });
    else out.push({ role: "tool", tool_call_id: t.tool_call_id, content: t.content });
  }

  return out;
}

/**
 * Cuánto se le deja escribir.
 *
 * Una conversación se responde de sobra con unos miles de tokens. Un proyecto
 * de código, no: una página con diseño de verdad —tipografía, paleta, sus
 * secciones con contenido escrito— pasa de las seiscientas líneas, y eso no
 * cabe en 4.096 tokens. Con el presupuesto de charla, el modelo no es que
 * escriba una página fea: escribe la página que le cabe.
 */
function maxTokens(speed: Speed, modo: Mode = "chat"): number {
  if (modo === "code") return speed === "rapido" ? 8192 : 16384;
  if (speed === "rapido") return 2048;
  if (speed === "profundo") return 8192;
  return 4096;
}

async function readError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  try {
    const json = JSON.parse(raw) as { error?: { message?: string } | string };
    const err = json.error;
    return (typeof err === "string" ? err : err?.message) || raw.slice(0, 300);
  } catch {
    return raw.slice(0, 300) || `HTTP ${res.status}`;
  }
}

/** Modelos del proveedor, con los recomendables primero. */
async function listModels(preset: Preset, key: string): Promise<string[]> {
  try {
    const res = await fetch(`${preset.base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return [];

    const json = (await res.json()) as { data?: { id?: string }[] };
    const ids = (json.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));

    const good = ids.filter((id) => preset.prefer.test(id));
    const rest = ids.filter(
      (id) => !preset.prefer.test(id) && !/whisper|tts|embed|guard|vision-only/i.test(id),
    );
    return [...good, ...rest];
  } catch {
    return [];
  }
}

/**
 * Para código, el modelo más capaz que tenga la cuenta.
 *
 * El de charla responde rápido y corto, que es lo que quieres conversando y lo
 * que menos sirve escribiendo un proyecto: entrega ciento y pico líneas y se
 * queda tan ancho. Aquí se busca uno mayor.
 *
 * Se elige de la lista REAL de la cuenta, nunca de una lista escrita a mano:
 * los proveedores gratuitos retiran modelos cada pocas semanas, y un
 * identificador inventado o caducado es un error 404 delante del usuario. Se
 * ordena por patrones de nombre —familias conocidas por programar bien, y el
 * tamaño en miles de millones de parámetros— y se coge el primero que exista.
 */
const PREFERENCIA_CODIGO: RegExp[] = [
  /kimi|k2/i,
  /deepseek/i,
  /qwen.*(coder|3)/i,
  /qwen/i,
  /llama.*(405|90)b/i,
  /70b|72b/i,
];

const resueltoCodigo: Partial<Record<CompatProvider, string>> = {};

async function modeloParaCodigo(
  provider: CompatProvider,
  preset: Preset,
  key: string,
): Promise<string | null> {
  if (resueltoCodigo[provider]) return resueltoCodigo[provider]!;

  // Si el hosting fija uno, manda ese y no se busca nada.
  const fijado = process.env.CODE_MODEL;
  if (fijado) {
    resueltoCodigo[provider] = fijado;
    return fijado;
  }

  const disponibles = await listModels(preset, key);
  for (const patron of PREFERENCIA_CODIGO) {
    const encontrado = disponibles.find((id) => patron.test(id));
    if (encontrado) {
      resueltoCodigo[provider] = encontrado;
      return encontrado;
    }
  }
  return null;
}

const resolved: Partial<Record<CompatProvider, string>> = {};

/** Permite fijar el modelo desde el hosting, sin tocar el código. */
function envModel(provider: CompatProvider): string {
  return (
    (provider === "groq" ? process.env.GROQ_MODEL : process.env.OPENROUTER_MODEL) || ""
  );
}

export interface CompatEvent {
  text?: string;
  /** Qué modelo acabó respondiendo. Se manda una vez, al abrir. */
  modelo?: string;
  /** El modelo ha pedido usar herramientas y ha dejado de escribir. */
  llamadas?: LlamadaCruda[];
}

/** Conversa con el proveedor y va entregando lo que escribe. */
export async function* streamCompat(opts: {
  provider: CompatProvider;
  key: string;
  system: string;
  turns: { role: "user" | "assistant"; content: string; attachments?: Attachment[] }[];
  speed: Speed;
  signal?: AbortSignal;
  /** Catálogo de herramientas, en el formato de OpenAI. Vacío = sin herramientas. */
  tools?: unknown[];
  /** El ida y vuelta con las herramientas que ya ha ocurrido en esta respuesta. */
  extra?: TurnoExtra[];
  /** De él depende cuánto se le deja escribir. */
  modo?: Mode;
}): AsyncGenerator<CompatEvent> {
  const preset = PRESETS[opts.provider];
  if (!opts.key)
    throw new CompatError(
      `Falta la clave de ${preset.label.split(" ")[0]}. Consíguela gratis en ${preset.keyUrl}`,
      503,
    );

  const body = (model: string) =>
    JSON.stringify({
      model,
      messages: toMessages(opts.system, opts.turns, preset.vision.test(model), opts.extra ?? []),
      max_tokens: maxTokens(opts.speed, opts.modo),
      temperature: 0.7,
      stream: true,
      ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
    });

  const open = (model: string) =>
    fetch(`${preset.base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.key}`,
        // OpenRouter los usa para identificar la aplicación en su panel.
        "HTTP-Referer": "https://eclipse-ai.vercel.app",
        "X-Title": "ECLIPSE",
      },
      signal: opts.signal,
      body: body(model),
    });

  const wanted =
    envModel(opts.provider) ||
    (opts.modo === "code"
      ? await modeloParaCodigo(opts.provider, preset, opts.key)
      : null) ||
    resolved[opts.provider] ||
    preset.model;
  let res = await open(wanted);

  // Modelo desconocido o retirado: buscamos uno disponible en la cuenta.
  if (res.status === 404 || res.status === 400) {
    if (resueltoCodigo[opts.provider] === wanted) delete resueltoCodigo[opts.provider];
    for (const candidate of (await listModels(preset, opts.key)).slice(0, 4)) {
      if (candidate === wanted) continue;
      res = await open(candidate);
      if (res.ok) {
        resolved[opts.provider] = candidate;
        break;
      }
    }
  }

  // El modelo bueno para código suele tener un límite gratuito más apretado.
  // Si está saturado, se responde con el de siempre en vez de dejar al usuario
  // sin nada: un proyecto algo más flojo es mejor que ninguno.
  if (res.status === 429 && opts.modo === "code" && wanted !== preset.model) {
    delete resueltoCodigo[opts.provider];
    const otro = resolved[opts.provider] || preset.model;
    if (otro !== wanted) res = await open(otro);
  }

  if (!res.ok) {
    const detail = await readError(res);
    if (res.status === 401)
      throw new CompatError("La clave no es válida. Revísala en Ajustes.", 401);
    if (res.status === 429)
      throw new CompatError(
        "Has llegado al límite gratuito de este proveedor. Espera un momento y vuelve a intentarlo.",
        429,
      );
    throw new CompatError(`${preset.label.split(" ")[0]}: ${detail}`, res.status);
  }

  if (!res.body) throw new CompatError("El proveedor no ha devuelto contenido.");

  // Cuál contestó de verdad: con la búsqueda del mejor modelo para código y los
  // respaldos, no tiene por qué ser el que se pidió, y sin esto no hay forma de
  // saber por qué una respuesta salió floja.
  yield { modelo: resolved[opts.provider] || wanted };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  /**
   * Las llamadas a herramientas no llegan enteras: llegan a trozos, y el
   * nombre puede venir en un fragmento y los argumentos repartidos entre
   * veinte. Se arman por su índice y no se entregan hasta que el flujo acaba.
   */
  const enObra = new Map<number, LlamadaCruda>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let cut: number;
    while ((cut = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const chunk = JSON.parse(payload) as {
          choices?: {
            delta?: {
              content?: string;
              tool_calls?: {
                index?: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }[];
            };
          }[];
          error?: { message?: string };
        };
        if (chunk.error?.message) throw new CompatError(chunk.error.message);

        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) yield { text: delta.content };

        for (const trozo of delta?.tool_calls ?? []) {
          const i = trozo.index ?? 0;
          const actual = enObra.get(i) ?? {
            id: "",
            type: "function" as const,
            function: { name: "", arguments: "" },
          };
          if (trozo.id) actual.id = trozo.id;
          if (trozo.function?.name) actual.function.name = trozo.function.name;
          if (trozo.function?.arguments) actual.function.arguments += trozo.function.arguments;
          enObra.set(i, actual);
        }
      } catch (err) {
        if (err instanceof CompatError) throw err;
        // Fragmento partido entre lecturas: seguimos.
      }
    }
  }

  const llamadas = [...enObra.values()].filter((l) => l.function.name);
  if (llamadas.length) {
    // Sin id no se puede emparejar la respuesta; algunos proveedores lo omiten.
    llamadas.forEach((l, i) => {
      if (!l.id) l.id = `llamada_${i}`;
    });
    yield { llamadas };
  }
}

/** Comprueba que la clave sirve, antes de guardarla. */
export async function verifyCompatKey(
  provider: CompatProvider,
  key: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const preset = PRESETS[provider];
  try {
    const res = await fetch(`${preset.base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403)
      return { ok: false, error: "Esa clave no es válida. Cópiala entera, sin espacios." };
    return { ok: false, error: `El proveedor respondió ${res.status}. Inténtalo en un momento.` };
  } catch {
    return { ok: false, error: "No se ha podido contactar con el proveedor." };
  }
}

/** Una sola respuesta corta, sin streaming. Para títulos y cosas parecidas. */
export async function oneShotCompat(
  provider: CompatProvider,
  key: string,
  prompt: string,
  /** Los títulos caben en cuatro palabras; un prompt de imagen, no. */
  tope = 48,
): Promise<string> {
  const preset = PRESETS[provider];
  const res = await fetch(`${preset.base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: envModel(provider) || resolved[provider] || preset.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: tope,
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new CompatError(await readError(res), res.status);

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}
