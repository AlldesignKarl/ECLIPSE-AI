"use client";

/**
 * Grabar la voz para transcribirla en el servidor.
 *
 * Es el camino que funciona en todas partes: `MediaRecorder` está en cualquier
 * navegador moderno, también dentro del visor de páginas de otras apps, que es
 * donde el dictado del navegador se queda mudo.
 */

export class VozError extends Error {}

/** El formato que este navegador sabe grabar. */
function formato(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const opciones = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return opciones.find((tipo) => MediaRecorder.isTypeSupported(tipo));
}

export function grabacionDisponible(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export interface Grabacion {
  /** Termina y entrega el audio. */
  parar: () => Promise<Blob>;
  /** Termina y lo tira. */
  cancelar: () => void;
}

export async function grabar(): Promise<Grabacion> {
  if (!grabacionDisponible())
    throw new VozError("Este navegador no sabe grabar audio.");

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  } catch (err) {
    const nombre = err instanceof Error ? err.name : "";
    if (nombre === "NotAllowedError" || nombre === "SecurityError")
      throw new VozError(
        "No has dado permiso al micrófono. Búscalo en el candado de la barra de direcciones, o en los ajustes del navegador para este sitio.",
      );
    if (nombre === "NotFoundError")
      throw new VozError("No se encuentra ningún micrófono.");
    throw new VozError("No se ha podido abrir el micrófono.");
  }

  const tipo = formato();
  const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
  const trozos: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) trozos.push(e.data);
  };
  rec.start();

  const soltar = () => stream.getTracks().forEach((t) => t.stop());

  return {
    parar: () =>
      new Promise<Blob>((resolve, reject) => {
        rec.onstop = () => {
          soltar();
          const blob = new Blob(trozos, { type: tipo || "audio/webm" });
          if (blob.size === 0) reject(new VozError("No se ha grabado nada."));
          else resolve(blob);
        };
        try {
          rec.stop();
        } catch {
          soltar();
          reject(new VozError("La grabación se ha cortado."));
        }
      }),
    cancelar() {
      try {
        rec.stop();
      } catch {
        /* ya estaba parada */
      }
      soltar();
    },
  };
}

/** Manda el audio al servidor y devuelve lo que se ha entendido. */
export async function transcribir(audio: Blob): Promise<string> {
  const form = new FormData();
  const extension = audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `voz.${extension}`);

  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { texto?: string; error?: string };

  if (!res.ok || !data.texto)
    throw new VozError(data.error ?? "No se ha podido transcribir el audio.");
  return data.texto;
}

/** ¿Puede el servidor transcribir con las claves que haya puestas? */
export async function transcripcionDisponible(): Promise<boolean> {
  try {
    const res = await fetch("/api/transcribe");
    const data = (await res.json()) as { disponible?: boolean };
    return Boolean(data.disponible);
  } catch {
    return false;
  }
}
