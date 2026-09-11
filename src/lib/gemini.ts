import { googleKeyFromEnv } from "./keys";
import { looksLikeDomain } from "./sources";
import type { Attachment, Speed } from "./types";

/**
 * Motor de Google (Gemini). Es el que permite usar ECLIPSE gratis: la capa
 * gratuita de Google AI Studio no pide tarjeta, e incluye la búsqueda en Google,
 * que es exactamente lo que necesitamos para citar fuentes.
 *
 * Todo por REST: Google no publica SDK oficial para el runtime de Next.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export function googleKey(): string {
  return googleKeyFromEnv();
}

export function chatModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

/**
 * Los nombres de los modelos de Google cambian con el tiempo. Si el que hay
 * configurado ya no existe, preguntamos a Google cuáles tiene disponibles esta
 * cuenta y elegimos uno, en vez de dejar la aplicación muerta.
 */
let resolvedModel: string | null = null;

async function pickModel(key: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/models`, { headers: { "x-goog-api-key": key } });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
    };

    const usable = (json.models ?? [])
      .filter((m) => m.name && (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => (m.name as string).replace(/^models\//, ""))
      .filter(
        (n) =>
          n.startsWith("gemini") &&
          !/embedding|image|tts|audio|live|vision/.test(n),
      );

    // "flash" es el que más cuota gratuita tiene, así que va primero.
    return usable.find((n) => n.includes("flash") && !n.includes("lite")) ?? usable[0] ?? null;
  } catch {
    return null;
  }
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
  }
}

interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface Content {
  role: "user" | "model";
  parts: Part[];
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
}

/** Traduce nuestros mensajes al formato de Google. */
function toContents(turns: Turn[]): Content[] {
  return turns.map((turn) => {
    const parts: Part[] = [];

    for (const file of turn.attachments ?? []) {
      if (file.kind === "image" || file.kind === "pdf") {
        parts.push({
          inlineData: {
            mimeType: file.kind === "pdf" ? "application/pdf" : file.mime,
            data: file.data,
          },
        });
      } else {
        parts.push({ text: `<archivo nombre="${file.name}">\n${file.data}\n</archivo>` });
      }
    }

    if (turn.content.trim()) parts.push({ text: turn.content });
    if (parts.length === 0) parts.push({ text: "(sin texto)" });

    return { role: turn.role === "user" ? "user" : "model", parts };
  });
}

/** Cuántas palabras dejamos escribir según lo que haya pedido el usuario. */
function maxTokens(speed: Speed): number {
  if (speed === "rapido") return 4096;
  if (speed === "profundo") return 16384;
  return 8192;
}

export interface GeminiEvent {
  text?: string;
  sources?: { url: string; title?: string; domainHint?: string }[];
  searching?: boolean;
}

interface Chunk {
  candidates?: {
    content?: { parts?: Part[] };
    finishReason?: string;
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
    };
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

async function readError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  try {
    const json = JSON.parse(raw) as { error?: { message?: string } };
    return json.error?.message || raw.slice(0, 300);
  } catch {
    return raw.slice(0, 300) || `HTTP ${res.status}`;
  }
}

/**
 * Conversa con Gemini y va entregando lo que escribe.
 * `webSearch` activa la búsqueda en Google con citación de fuentes.
 */
export async function* streamChat(opts: {
  system: string;
  turns: Turn[];
  speed: Speed;
  webSearch: boolean;
  /** Clave resuelta por quien llama (variable de entorno o dispositivo). */
  key: string;
  signal?: AbortSignal;
}): AsyncGenerator<GeminiEvent> {
  const key = opts.key;
  if (!key)
    throw new GeminiError(
      "Falta GOOGLE_API_KEY. Consíguela gratis en https://aistudio.google.com/apikey",
      503,
    );

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: toContents(opts.turns),
    ...(opts.webSearch ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: {
      maxOutputTokens: maxTokens(opts.speed),
      temperature: 0.7,
    },
  });

  const open = (model: string) =>
    fetch(`${BASE}/models/${model}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: opts.signal,
      body,
    });

  const wanted = resolvedModel ?? chatModel();
  let res = await open(wanted);

  // Modelo desconocido: buscamos uno válido y reintentamos una sola vez.
  // Si el usuario ha fijado GEMINI_MODEL a mano, respetamos su elección.
  if (res.status === 404 && !process.env.GEMINI_MODEL) {
    const alternative = await pickModel(key);
    if (alternative && alternative !== wanted) {
      resolvedModel = alternative;
      res = await open(alternative);
    }
  }

  if (!res.ok) {
    const detail = await readError(res);
    if (res.status === 404)
      throw new GeminiError(
        `Google no reconoce el modelo "${wanted}". Cambia la variable GEMINI_MODEL por uno disponible en tu cuenta. (${detail})`,
        404,
      );
    if (res.status === 429)
      throw new GeminiError(
        "Has alcanzado el límite gratuito de Google por ahora. Espera un minuto y vuelve a intentarlo.",
        429,
      );
    throw new GeminiError(`Google: ${detail}`, res.status);
  }

  if (!res.body) throw new GeminiError("Google no ha devuelto contenido.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const sources: { url: string; title?: string; domainHint?: string }[] = [];
  let buffer = "";
  let announcedSearch = false;

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

      let chunk: Chunk;
      try {
        chunk = JSON.parse(payload) as Chunk;
      } catch {
        continue; // fragmento partido entre lecturas
      }

      if (chunk.error?.message) throw new GeminiError(`Google: ${chunk.error.message}`);
      if (chunk.promptFeedback?.blockReason)
        throw new GeminiError(
          "Google ha bloqueado esta petición por sus filtros de contenido. Prueba a reformularla.",
        );

      const candidate = chunk.candidates?.[0];
      if (!candidate) continue;

      const grounding = candidate.groundingMetadata;
      if (grounding) {
        if (!announcedSearch && grounding.webSearchQueries?.length) {
          announcedSearch = true;
          yield { searching: true };
        }
        for (const g of grounding.groundingChunks ?? []) {
          const uri = g.web?.uri;
          if (!uri) continue;
          const title = g.web?.title ?? "";
          // Google devuelve enlaces de redirección; el título suele traer el
          // dominio real, y es lo que necesitamos para puntuar la fuente.
          sources.push({
            url: uri,
            title,
            domainHint: looksLikeDomain(title) ? title : "",
          });
        }
      }

      for (const part of candidate.content?.parts ?? []) {
        if (part.text) yield { text: part.text };
      }
    }
  }

  if (sources.length) yield { sources };
}

/** Una respuesta corta y sin streaming. Se usa para titular conversaciones. */
export async function oneShot(
  prompt: string,
  key: string,
  maxOutputTokens = 40,
): Promise<string> {
  if (!key) throw new GeminiError("Falta la clave de Google.", 503);

  const res = await fetch(`${BASE}/models/${resolvedModel ?? chatModel()}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens, temperature: 0.3 },
    }),
  });

  if (!res.ok) throw new GeminiError(`Google: ${await readError(res)}`, res.status);

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}
