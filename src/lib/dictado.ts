"use client";

/**
 * Dictado por voz.
 *
 * Lo hace el propio navegador con la API de reconocimiento de voz: no se sube
 * ningún audio a nuestro servidor, no cuesta dinero y no hace falta ninguna
 * clave. A cambio, no está en todos los navegadores —en móvil funciona en
 * Chrome y en Safari reciente—, así que el botón solo aparece donde sirve.
 */

interface Alternativa {
  transcript: string;
}
interface Resultado {
  readonly length: number;
  isFinal: boolean;
  [index: number]: Alternativa;
}
interface ListaResultados {
  readonly length: number;
  [index: number]: Resultado;
}
interface EventoResultado {
  resultIndex: number;
  results: ListaResultados;
}
interface EventoError {
  error: string;
}

interface Reconocimiento {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: EventoResultado) => void) | null;
  onerror: ((e: EventoError) => void) | null;
  onend: (() => void) | null;
}

type Constructor = new () => Reconocimiento;

function constructor(): Constructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: Constructor;
    webkitSpeechRecognition?: Constructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function dictadoDisponible(): boolean {
  return constructor() !== null;
}

/** Cómo explicarle al usuario lo que ha fallado. */
function motivo(error: string): string | null {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "No has dado permiso al micrófono. Actívalo en los ajustes del navegador para este sitio.";
    case "no-speech":
      // No ha oído nada: no es un fallo que merezca un aviso.
      return null;
    case "audio-capture":
      return "No se encuentra el micrófono.";
    case "network":
      return "El dictado necesita conexión y ahora mismo no la hay.";
    case "aborted":
      return null;
    default:
      return "El dictado se ha cortado. Prueba otra vez.";
  }
}

export interface Dictado {
  parar: () => void;
}

/**
 * Empieza a escuchar. Va entregando lo que oye: `parcial` es lo que todavía
 * puede cambiar y `firme` lo que ya da por bueno, que es lo que se acumula.
 */
export function dictar(opts: {
  onTexto: (trozo: { firme: string; parcial: string }) => void;
  onFin: () => void;
  onError: (mensaje: string) => void;
  idioma?: string;
}): Dictado | null {
  const Reconocedor = constructor();
  if (!Reconocedor) return null;

  const rec = new Reconocedor();
  rec.lang = opts.idioma || (typeof navigator !== "undefined" ? navigator.language : "") || "es-ES";
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let parado = false;

  rec.onresult = (e) => {
    let firme = "";
    let parcial = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const trozo = e.results[i][0]?.transcript ?? "";
      if (e.results[i].isFinal) firme += trozo;
      else parcial += trozo;
    }
    opts.onTexto({ firme, parcial });
  };

  rec.onerror = (e) => {
    const mensaje = motivo(e.error);
    if (mensaje) opts.onError(mensaje);
    // Un permiso denegado no se arregla reintentando: se cierra.
    if (e.error === "not-allowed" || e.error === "service-not-allowed") parado = true;
  };

  rec.onend = () => {
    // El navegador corta solo tras unos segundos de silencio. Si el usuario no
    // ha pulsado parar, seguimos escuchando: dictar una frase larga no debería
    // obligarle a pulsar el botón cada poco.
    if (parado) {
      opts.onFin();
      return;
    }
    try {
      rec.start();
    } catch {
      opts.onFin();
    }
  };

  try {
    rec.start();
  } catch {
    return null;
  }

  return {
    parar() {
      parado = true;
      try {
        rec.stop();
      } catch {
        /* ya estaba parado */
      }
    },
  };
}
