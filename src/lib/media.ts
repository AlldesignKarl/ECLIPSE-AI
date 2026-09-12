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

/** ¿Es un "no te queda cuota" del proveedor? */
function isQuota(status: number, detail: string): boolean {
  return (
    status === 429 ||
    /quota|rate.?limit|billing|limit: 0|insufficient/i.test(detail)
  );
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

  if (!res.ok) {
    const detail = await readError(res);
    // El volcado de error de Google no le dice nada a nadie: lo traducimos.
    throw new MediaError(
      isQuota(res.status, detail)
        ? "Tu cuenta de Google no tiene cuota gratuita para crear imágenes. No pasa nada: lo intento con el servicio gratuito."
        : `Google no ha podido crear la imagen: ${detail.slice(0, 180)}`,
      res.status,
    );
  }

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

/**
 * Pollinations: un servicio gratuito que no pide clave ni cuenta. Va limitado y
 * a veces tarda, pero es la única forma de crear imágenes sin pagar ni
 * registrarse en ningún sitio, así que lo usamos de red de seguridad.
 */
async function pollinationsImage(prompt: string): Promise<ImageResult> {
  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
  url.searchParams.set("width", "1024");
  url.searchParams.set("height", "1024");
  url.searchParams.set("nologo", "true");
  url.searchParams.set("model", process.env.POLLINATIONS_MODEL || "flux");
  url.searchParams.set("seed", String(Math.floor(Math.random() * 1e9)));

  let res: Response;
  try {
    // Vercel corta la función a los 60 s; dejamos margen para responder.
    res = await fetch(url, { signal: AbortSignal.timeout(48000), cache: "no-store" });
  } catch {
    throw new MediaError(
      "El servicio gratuito de imágenes no ha respondido a tiempo. Vuelve a intentarlo en un minuto.",
      504,
    );
  }

  if (!res.ok)
    throw new MediaError(
      res.status === 429
        ? "El servicio gratuito de imágenes está saturado ahora mismo. Prueba otra vez en un par de minutos."
        : `El servicio gratuito de imágenes ha fallado (${res.status}). Inténtalo de nuevo.`,
      res.status,
    );

  const mime = res.headers.get("content-type") ?? "";
  if (!mime.startsWith("image/"))
    throw new MediaError("El servicio gratuito de imágenes no ha devuelto una imagen.", 502);

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.byteLength < 1024)
    throw new MediaError("El servicio gratuito de imágenes ha devuelto una imagen vacía.", 502);

  return {
    dataUrl: `data:${mime.split(";")[0]};base64,${bytes.toString("base64")}`,
    provider: "pollinations/flux",
    note: "Creada con el servicio gratuito, que va más justo de calidad y de velocidad.",
  };
}

/**
 * Cloudflare Workers AI: 10.000 "neuronas" al día gratis y sin tarjeta, que dan
 * para cientos de imágenes. Necesita dos datos del panel de Cloudflare.
 */
function cloudflareConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

async function cloudflareImage(prompt: string): Promise<ImageResult> {
  const model = process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      },
      body: JSON.stringify({ prompt, steps: 4 }),
      signal: AbortSignal.timeout(48000),
    },
  );

  if (!res.ok) throw new MediaError(`Cloudflare: ${await readError(res)}`, res.status);

  // Según el modelo devuelve JSON con base64 o directamente los bytes.
  const mime = res.headers.get("content-type") ?? "";
  if (mime.startsWith("image/")) {
    const bytes = Buffer.from(await res.arrayBuffer());
    return {
      dataUrl: `data:${mime.split(";")[0]};base64,${bytes.toString("base64")}`,
      provider: `cloudflare/${model}`,
    };
  }

  const json = (await res.json()) as { result?: { image?: string } };
  const image = json.result?.image;
  if (!image) throw new MediaError("Cloudflare no devolvió ninguna imagen.", 502);
  return { dataUrl: `data:image/jpeg;base64,${image}`, provider: `cloudflare/${model}` };
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

/** Siempre hay con qué: si no hay claves, queda el servicio gratuito sin clave. */
export async function imageProviderAvailable(): Promise<boolean> {
  return true;
}

/**
 * Crea la imagen con el mejor proveedor disponible y, si ese se queda sin
 * cuota, baja al siguiente. La última parada nunca falla por falta de clave:
 * es el servicio gratuito. Así crear imágenes sigue funcionando aunque la
 * cuenta de Google no tenga ni un hueco libre, que es lo normal.
 */
export async function generateImage(prompt: string): Promise<ImageResult> {
  const attempts: (() => Promise<ImageResult>)[] = [];

  if (await resolveGoogleKey()) attempts.push(() => geminiImage(prompt));
  if (process.env.OPENAI_API_KEY) attempts.push(() => openaiImage(prompt));
  if (cloudflareConfigured()) attempts.push(() => cloudflareImage(prompt));
  attempts.push(() => pollinationsImage(prompt));

  let last: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      last = err;
      const status = err instanceof MediaError ? err.status : 500;
      const detail = err instanceof Error ? err.message : "";
      // Sin cuota o caído: probamos con el siguiente. Un fallo distinto
      // (petición mal formada, contenido rechazado) sí se le cuenta al usuario.
      if (!isQuota(status, detail) && status < 500) throw err;
    }
  }

  throw last instanceof Error
    ? last
    : new MediaError("No se ha podido crear la imagen. Inténtalo de nuevo.", 502);
}
