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
  return process.env.GEMINI_MODEL || "gemini-3.6-flash";
}

/**
 * Los nombres de los modelos de Google cambian con el tiempo. Si el que hay
 * configurado ya no existe, preguntamos a Google cuáles tiene disponibles esta
 * cuenta y elegimos uno, en vez de dejar la aplicación muerta.
 */
let resolvedModel: string | null = null;

async function pickModel(key: string, preferLite = false): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/models`, { headers: { "x-goog-api-key": key } });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
    };

    const all = (json.models ?? []).filter((m) => m.name);
    const chat = all.filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"));

    // Si ninguno declara generateContent, no nos quedamos sin nada: los
    // modelos nuevos pueden anunciar métodos distintos.
    const names = (chat.length ? chat : all)
      .map((m) => (m.name as string).replace(/^models\//, ""))
      .filter((n) => n.startsWith("gemini") && !/embedding|image|tts|audio|live|vision/.test(n));

    // "flash" es el que más cuota gratuita tiene, así que va primero. Cuando
    // nos hemos quedado sin cuota, buscamos el "lite", que suele tener más.
    if (preferLite) {
      return names.find((n) => n.includes("lite")) ?? names.find((n) => n.includes("flash")) ?? null;
    }
    return names.find((n) => n.includes("flash") && !n.includes("lite")) ?? names[0] ?? null;
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
  /** Segundos que vamos a esperar antes de reintentar por falta de cuota. */
  waiting?: number;
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

/** Google dice en el error cuántos segundos hay que esperar. Le hacemos caso. */
function retryDelaySeconds(detail: string): number | null {
  const match = detail.match(/retryDelay"?\s*[:=]\s*"?(\d+(?:\.\d+)?)s/i);
  if (match) return Math.ceil(Number(match[1]));
  const loose = detail.match(/(\d+(?:\.\d+)?)\s*s(?:econds?)?\b/i);
  return loose ? Math.ceil(Number(loose[1])) : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readError(res: Response): Promise<{ message: string; raw: string }> {
  const raw = await res.text().catch(() => "");
  try {
    const json = JSON.parse(raw) as { error?: { message?: string } };
    return { message: json.error?.message || raw.slice(0, 300), raw };
  } catch {
    return { message: raw.slice(0, 300) || `HTTP ${res.status}`, raw };
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
  let last = { message: "", raw: "" };
  const pinned = Boolean(process.env.GEMINI_MODEL);

  // Modelo retirado o desconocido. Google suele decir en el propio mensaje de
  // error cuál hay que usar ahora, así que le hacemos caso; y si no, le
  // preguntamos qué modelos tiene esta cuenta. Reintentamos una sola vez.
  // Si el usuario ha fijado GEMINI_MODEL a mano, respetamos su elección.
  if ((res.status === 404 || res.status === 400) && !pinned) {
    last = await readError(res);

    const proposed = (last.message.match(/models\/[a-zA-Z0-9.\-]+/g) ?? [])
      .map((m) => m.replace(/^models\//, ""))
      .find((name) => name !== wanted && name.startsWith("gemini"));

    const alternative = proposed ?? (await pickModel(key));
    if (alternative && alternative !== wanted) {
      resolvedModel = alternative;
      res = await open(alternative);
    }
  }

  // Sin cuota. El límite de la capa gratuita es por minuto y Google dice
  // cuántos segundos faltan, así que esperamos nosotros en vez de hacérselo
  // esperar al usuario. Una sola vez: la función tiene 60 s de margen.
  if (res.status === 429) {
    last = await readError(res);
    const wait = Math.min(retryDelaySeconds(last.raw) ?? 20, 25);

    yield { waiting: wait };
    await sleep(wait * 1000);
    res = await open(resolvedModel ?? wanted);

    // Sigue sin haber cuota: probamos con un modelo ligero, que suele tener más.
    if (res.status === 429 && !pinned) {
      last = await readError(res);
      const lite = await pickModel(key, true);
      if (lite && lite !== (resolvedModel ?? wanted)) {
        resolvedModel = lite;
        res = await open(lite);
      }
    }
  }

  if (!res.ok) {
    const detail = res.bodyUsed ? last : await readError(res);
    const message = detail.message || last.message;

    if (res.status === 404 || res.status === 400)
      throw new GeminiError(
        `Google no acepta el modelo "${resolvedModel ?? wanted}". Define GEMINI_MODEL con uno disponible en tu cuenta. (${message})`,
        res.status,
      );

    if (res.status === 429) {
      const wait = retryDelaySeconds(detail.raw || last.raw);
      throw new GeminiError(
        "Sigues sin cuota en la capa gratuita de Google" +
          (wait ? `: pide esperar unos ${wait} segundos más` : "") +
          ". No se te ha cobrado nada. Si te pasa a menudo, activa la facturación en tu cuenta " +
          "de Google (pagas solo por uso) y el límite desaparece.",
        429,
      );
    }

    throw new GeminiError(`Google: ${message}`, res.status);
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

  if (!res.ok) throw new GeminiError(`Google: ${(await readError(res)).message}`, res.status);

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}
