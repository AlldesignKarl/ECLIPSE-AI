import { googleKeyFromEnv, resolveGoogleKey } from "./keys";

/**
 * Generación de imagen y vídeo. Se apoya en proveedores externos configurables
 * por variables de entorno para que la app funcione con lo que tengas a mano.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export class MediaError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
  }
}

export interface ImageResult {
  dataUrl: string;
  provider: string;
  note?: string;
}

function googleKey() {
  return googleKeyFromEnv();
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const json = JSON.parse(text);
    return json?.error?.message || text.slice(0, 400);
  } catch {
    return text.slice(0, 400) || `HTTP ${res.status}`;
  }
}

/* ------------------------------- Imágenes ------------------------------- */

async function geminiImage(prompt: string): Promise<ImageResult> {
  const key = await resolveGoogleKey();
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview";

  const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });

  if (!res.ok) throw new MediaError(`Google: ${await readError(res)}`, res.status);

  const json = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string; inlineData?: { mimeType: string; data: string } }[] };
    }[];
  };

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((p) => p.inlineData?.data)?.inlineData;
  if (!image) {
    const text = parts.find((p) => p.text)?.text;
    throw new MediaError(
      text
        ? `El modelo no devolvió imagen: ${text.slice(0, 200)}`
        : "El modelo no devolvió ninguna imagen.",
    );
  }

  return {
    dataUrl: `data:${image.mimeType};base64,${image.data}`,
    provider: `google/${model}`,
    note: parts.find((p) => p.text)?.text,
  };
}

async function openaiImage(prompt: string): Promise<ImageResult> {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, prompt, size: "1024x1024", n: 1 }),
  });

  if (!res.ok) throw new MediaError(`OpenAI: ${await readError(res)}`, res.status);

  const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const item = json.data?.[0];
  if (item?.b64_json)
    return { dataUrl: `data:image/png;base64,${item.b64_json}`, provider: `openai/${model}` };
  if (item?.url) return { dataUrl: item.url, provider: `openai/${model}` };
  throw new MediaError("OpenAI no devolvió ninguna imagen.");
}

export async function imageProviderAvailable(): Promise<boolean> {
  return Boolean((await resolveGoogleKey()) || process.env.OPENAI_API_KEY);
}

export async function generateImage(prompt: string): Promise<ImageResult> {
  if (await resolveGoogleKey()) return geminiImage(prompt);
  if (process.env.OPENAI_API_KEY) return openaiImage(prompt);
  throw new MediaError(
    "No hay proveedor de imágenes configurado. Añade GOOGLE_API_KEY (Gemini) o OPENAI_API_KEY.",
    503,
  );
}

/* -------------------------------- Vídeo --------------------------------- */

export async function videoProviderAvailable(): Promise<boolean> {
  return Boolean(await resolveGoogleKey());
}

/** Arranca la generación y devuelve el identificador de la operación. */
export async function startVideo(
  prompt: string,
  aspectRatio = "16:9",
): Promise<{ operation: string }> {
  const key = await resolveGoogleKey();
  if (!key)
    throw new MediaError(
      "El vídeo necesita GOOGLE_API_KEY (modelo Veo) en las variables de entorno.",
      503,
    );

  const model = process.env.GEMINI_VIDEO_MODEL || "veo-3.1-generate-preview";
  const res = await fetch(`${GEMINI_BASE}/models/${model}:predictLongRunning`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { aspectRatio, personGeneration: "allow_adult" },
    }),
  });

  if (!res.ok) throw new MediaError(`Google Veo: ${await readError(res)}`, res.status);

  const json = (await res.json()) as { name?: string };
  if (!json.name) throw new MediaError("Veo no devolvió una operación válida.");
  return { operation: json.name };
}

export interface VideoStatus {
  done: boolean;
  uri?: string;
  error?: string;
}

export async function pollVideo(operation: string): Promise<VideoStatus> {
  const key = await resolveGoogleKey();
  const res = await fetch(`${GEMINI_BASE}/${operation}`, {
    headers: { "x-goog-api-key": key },
  });
  if (!res.ok) throw new MediaError(`Google Veo: ${await readError(res)}`, res.status);

  const json = (await res.json()) as {
    done?: boolean;
    error?: { message?: string };
    response?: {
      generateVideoResponse?: {
        generatedSamples?: { video?: { uri?: string } }[];
      };
    };
  };

  if (json.error?.message) return { done: true, error: json.error.message };
  if (!json.done) return { done: false };

  const uri = json.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) return { done: true, error: "La operación terminó sin devolver vídeo." };
  return { done: true, uri };
}

/** Descarga el vídeo con la clave del servidor (nunca se expone al navegador). */
export async function fetchVideoBytes(uri: string): Promise<Response> {
  const key = await resolveGoogleKey();
  if (!uri.startsWith(GEMINI_BASE) && !uri.startsWith("https://generativelanguage.googleapis.com"))
    throw new MediaError("URI de vídeo no permitida.", 400);

  const res = await fetch(uri, { headers: { "x-goog-api-key": key } });
  if (!res.ok) throw new MediaError(`No se pudo descargar el vídeo: ${await readError(res)}`, res.status);
  return res;
}
