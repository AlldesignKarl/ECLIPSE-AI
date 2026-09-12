import { NextRequest } from "next/server";
import { keyAvailable, resolveKey } from "@/lib/keys";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Voz a texto.
 *
 * El dictado del navegador es gratis pero no está en todas partes: dentro de
 * las aplicaciones que abren páginas en su propio visor no suele funcionar, y
 * ahí es justo donde mucha gente abre la app. Así que también sabemos
 * transcribir en el servidor, grabando y mandando el audio.
 *
 * Groq incluye Whisper en su capa gratuita, y Google entiende audio: con
 * cualquiera de las dos claves que ya estén puestas, esto funciona sin pagar
 * nada más.
 */

/** ¿Se puede transcribir en el servidor con lo que hay configurado? */
export async function GET() {
  return Response.json({
    disponible: (await keyAvailable("groq")) || (await keyAvailable("google")),
  });
}

const MAX_BYTES = 4 * 1024 * 1024;

class TranscripcionError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

/** El volcado del proveedor no le dice nada a nadie: lo traducimos. */
function explicar(status: number, proveedor: string): string {
  if (status === 401 || status === 403)
    return `La clave de ${proveedor} no vale para transcribir. Revísala en Ajustes.`;
  if (status === 429)
    return `Has llegado al límite gratuito de ${proveedor} por hoy. Espera un rato o cambia de motor en Ajustes.`;
  if (status === 413) return "La grabación es demasiado larga. Prueba con algo más corto.";
  if (status >= 500) return `${proveedor} no responde ahora mismo. Inténtalo en un momento.`;
  return `${proveedor} no ha podido transcribir el audio.`;
}

async function conGroq(audio: Blob, nombre: string, key: string): Promise<string> {
  const form = new FormData();
  form.append("file", audio, nombre);
  form.append("model", process.env.GROQ_TRANSCRIBE_MODEL || "whisper-large-v3-turbo");
  form.append("response_format", "text");
  form.append("language", "es");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(50000),
  });

  if (!res.ok) throw new TranscripcionError(explicar(res.status, "Groq"), res.status);
  return (await res.text()).trim();
}

async function conGoogle(audio: Blob, mime: string, key: string): Promise<string> {
  const base64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
  const model = process.env.GEMINI_TRANSCRIBE_MODEL || "gemini-3.6-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Transcribe este audio palabra por palabra, en su idioma original. Responde solo con la transcripción, sin comillas ni comentarios.",
              },
              { inlineData: { mimeType: mime || "audio/webm", data: base64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(50000),
    },
  );

  if (!res.ok) throw new TranscripcionError(explicar(res.status, "Google"), res.status);

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "No ha llegado el audio." }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0)
    return Response.json({ error: "No ha llegado el audio." }, { status: 400 });

  if (audio.size > MAX_BYTES)
    return Response.json(
      { error: "La grabación es demasiado larga. Prueba con algo más corto." },
      { status: 413 },
    );

  const groq = await resolveKey("groq");
  const google = await resolveKey("google");

  if (!groq && !google)
    return Response.json(
      {
        error:
          "Para transcribir hace falta una clave. Pon la de Groq en Ajustes: es gratis y no pide tarjeta.",
        code: "no_key",
      },
      { status: 503 },
    );

  const nombre = (audio as File).name || "audio.webm";
  const mime = audio.type || "audio/webm";

  try {
    const texto = groq
      ? await conGroq(audio, nombre, groq)
      : await conGoogle(audio, mime, google);

    if (!texto) return Response.json({ error: "No se ha entendido nada. Prueba otra vez." }, { status: 422 });
    return Response.json({ texto });
  } catch (err) {
    // Si Groq falla y hay clave de Google, todavía queda una bala.
    if (groq && google) {
      try {
        const texto = await conGoogle(audio, mime, google);
        if (texto) return Response.json({ texto });
      } catch {
        /* ninguno de los dos: lo contamos abajo */
      }
    }
    return Response.json(
      {
        error:
          err instanceof TranscripcionError
            ? err.message
            : "No se ha podido transcribir el audio. Comprueba la conexión e inténtalo otra vez.",
      },
      { status: err instanceof TranscripcionError ? err.status : 502 },
    );
  }
}
