import type { Attachment, Speed } from "./types";

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
  role: "system" | "user" | "assistant";
  content: string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
}

function toMessages(
  system: string,
  turns: { role: "user" | "assistant"; content: string; attachments?: Attachment[] }[],
  vision: boolean,
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

  return out;
}

function maxTokens(speed: Speed): number {
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

const resolved: Partial<Record<CompatProvider, string>> = {};

/** Permite fijar el modelo desde el hosting, sin tocar el código. */
function envModel(provider: CompatProvider): string {
  return (
    (provider === "groq" ? process.env.GROQ_MODEL : process.env.OPENROUTER_MODEL) || ""
  );
}

export interface CompatEvent {
  text?: string;
}

/** Conversa con el proveedor y va entregando lo que escribe. */
export async function* streamCompat(opts: {
  provider: CompatProvider;
  key: string;
  system: string;
  turns: { role: "user" | "assistant"; content: string; attachments?: Attachment[] }[];
  speed: Speed;
  signal?: AbortSignal;
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
      messages: toMessages(opts.system, opts.turns, preset.vision.test(model)),
      max_tokens: maxTokens(opts.speed),
      temperature: 0.7,
      stream: true,
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

  const wanted = envModel(opts.provider) || resolved[opts.provider] || preset.model;
  let res = await open(wanted);

  // Modelo desconocido o retirado: buscamos uno disponible en la cuenta.
  if (res.status === 404 || res.status === 400) {
    for (const candidate of (await listModels(preset, opts.key)).slice(0, 4)) {
      if (candidate === wanted) continue;
      res = await open(candidate);
      if (res.ok) {
        resolved[opts.provider] = candidate;
        break;
      }
    }
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

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
          choices?: { delta?: { content?: string } }[];
          error?: { message?: string };
        };
        if (chunk.error?.message) throw new CompatError(chunk.error.message);
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) yield { text };
      } catch (err) {
        if (err instanceof CompatError) throw err;
        // Fragmento partido entre lecturas: seguimos.
      }
    }
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
): Promise<string> {
  const preset = PRESETS[provider];
  const res = await fetch(`${preset.base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: envModel(provider) || resolved[provider] || preset.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 48,
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new CompatError(await readError(res), res.status);

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}
