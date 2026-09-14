/**
 * Reconocer cuando un modelo dice que no puede ver la imagen.
 *
 * Hace falta porque no siempre falla de forma limpia. Lo normal es que el
 * proveedor rechace la petición y entonces se sabe al instante; pero hay
 * modelos que la aceptan, no miran nada, y contestan tan tranquilos "lo siento,
 * no puedo ver imágenes". Para la aplicación eso es una respuesta correcta y
 * para quien pregunta es exactamente el mismo fallo.
 *
 * Así que se lee lo primero que escribe, y si es esa negativa, se cambia de
 * motor y se vuelve a preguntar. Solo se miran los primeros caracteres: una
 * negativa así va siempre al principio, y más adelante "no puedo ver la
 * matrícula" es una observación legítima sobre la foto, no una excusa.
 */

/** Cuánto hay que leer antes de dar por buena una respuesta sobre una foto. */
export const INICIO = 220;

const NEGATIVAS: RegExp[] = [
  /\bno\s+(?:puedo|puede[ns]?|podr[íi]a|(?:soy|es|son)\s+capa[cz](?:es)?\s+de|tengo\s+(?:la\s+)?(?:capacidad|posibilidad)\s+de)\s+(?:\w+\s+){0,3}?(?:ver|mirar|leer|abrir|analizar|procesar|visualizar|acceder\s+a)\b(?!\s+(?:bien|del\s+todo|con\s+claridad|claramente|con\s+detalle|apenas))[^.]{0,40}\b(?:im[áa]gen|foto|adjunt|archivo)/i,
  /\bno\s+tengo\s+acceso\s+a\s+[^.]{0,40}\b(?:im[áa]gen|foto|adjunt)/i,
  /\bno\s+(?:veo|recibo|me\s+llega)\s+(?:ninguna|la|ning[úu]n)\s*(?:im[áa]gen|foto|adjunto)/i,
  /\bno\s+(?:se\s+ha\s+adjuntado|hay)\s+(?:ninguna|ning[úu]n)\s*(?:im[áa]gen|foto|adjunto)/i,
  /\b(?:i\s+(?:can'?t|cannot|am\s+unable\s+to)|unable\s+to)\s+(?:\w+\s+){0,3}?(?:see|view|read|open|analyz|process)\w*\b[^.]{0,40}\b(?:image|photo|picture|attach)/i,
  /\bas\s+an\s+ai[^.]{0,60}\bcannot\s+(?:see|view|process)\b[^.]{0,30}\b(?:image|photo)/i,
];

/** ¿Lo que ha empezado a escribir es "no puedo ver la imagen"? */
export function esNegativaDeVista(texto: string): boolean {
  const principio = texto.slice(0, INICIO);
  return NEGATIVAS.some((r) => r.test(principio));
}

/**
 * El filtro que retiene el principio de una respuesta con foto delante.
 *
 * Va aparte de la ruta para poder probarlo con trozos de verdad —los modelos
 * escriben de tres en tres letras, y una negativa partida en «no pue» + «do
 * ver imágenes» tiene que detectarse igual—. Mientras mira, no sale nada; en
 * cuanto decide que no es una negativa, suelta lo retenido de golpe y se
 * aparta para el resto de la respuesta.
 */
export function crearFiltroDeNegativa(vigilar: boolean) {
  let retenido = "";
  let mirando = vigilar;

  return {
    /** Un trozo recién llegado. Devuelve lo que ya se puede enseñar. */
    recibir(trozo: string): { mostrar: string; negativa: boolean } {
      if (!mirando) return { mostrar: trozo, negativa: false };
      retenido += trozo;
      if (esNegativaDeVista(retenido)) return { mostrar: "", negativa: true };
      if (retenido.length < INICIO) return { mostrar: "", negativa: false };
      return { mostrar: this.resto(), negativa: false };
    },

    /** Se acabó, o se puso a trabajar: lo retenido sale tal cual. */
    resto(): string {
      mirando = false;
      const todo = retenido;
      retenido = "";
      return todo;
    },

    get retiene() {
      return mirando;
    },
  };
}
