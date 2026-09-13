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

export interface OpcionesGrabacion {
  /**
   * Se llama cuando la persona lleva un rato callada después de haber hablado.
   * Sirve para cerrar la grabación sola, sin tener que volver a pulsar.
   */
  alCallar?: () => void;
  /** Cuánto silencio hay que oír para darlo por terminado. */
  silencioMs?: number;
  /** Tope de seguridad: si el micro se queda abierto, se cierra igualmente. */
  maximoMs?: number;
}

/**
 * Escucha el volumen del micrófono y avisa cuando se hace el silencio.
 *
 * Mide el nivel real de la onda, no si hay "voz": distinguir voz de ruido
 * necesitaría bastante más maquinaria y aquí no hace falta. Lo que sí hace
 * falta es no cortar antes de que la persona empiece a hablar, así que hasta
 * que no se supera el umbral una vez, el silencio no cuenta.
 *
 * Los dos umbrales no son el mismo a propósito: se entra en "hablando" con uno
 * alto y se sale con otro más bajo. Con un único umbral, las pausas normales
 * entre palabras harían que el nivel lo cruzara sin parar en los dos sentidos.
 */
function vigilarSilencio(stream: MediaStream, opciones: OpcionesGrabacion): () => void {
  const { alCallar, silencioMs = 2500, maximoMs = 120000 } = opciones;
  if (!alCallar) return () => {};

  const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Audio) return () => {};

  let ctx: AudioContext;
  try {
    ctx = new Audio();
  } catch {
    return () => {};
  }

  const analizador = ctx.createAnalyser();
  analizador.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analizador);

  const muestras = new Float32Array(analizador.fftSize);
  const HABLANDO = 0.022;
  const CALLADO = 0.012;

  let haHablado = false;
  let calladoDesde = 0;
  let terminado = false;
  const inicio = Date.now();

  const rematar = () => {
    if (terminado) return;
    terminado = true;
    alCallar();
  };

  const reloj = window.setInterval(() => {
    if (terminado) return;

    analizador.getFloatTimeDomainData(muestras);
    let suma = 0;
    for (const v of muestras) suma += v * v;
    const nivel = Math.sqrt(suma / muestras.length);

    const ahora = Date.now();
    if (ahora - inicio > maximoMs) return rematar();

    if (nivel > HABLANDO) {
      haHablado = true;
      calladoDesde = 0;
      return;
    }

    if (!haHablado || nivel > CALLADO) return;

    if (!calladoDesde) calladoDesde = ahora;
    else if (ahora - calladoDesde >= silencioMs) rematar();
  }, 120);

  return () => {
    terminado = true;
    window.clearInterval(reloj);
    void ctx.close().catch(() => {});
  };
}

export async function grabar(opciones: OpcionesGrabacion = {}): Promise<Grabacion> {
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

  const dejarDeVigilar = vigilarSilencio(stream, opciones);

  const soltar = () => {
    dejarDeVigilar();
    stream.getTracks().forEach((t) => t.stop());
  };

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
