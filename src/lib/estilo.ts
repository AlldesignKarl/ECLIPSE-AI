/**
 * Cómo escribe la persona que tienes delante, para escribirle igual.
 *
 * Carlos lo pidió así: que ECLIPSE vaya aprendiendo su forma de comunicarse
 * —longitud, nivel técnico, formalidad, emojis— sin convertirse en una
 * caricatura suya. La diferencia entre las dos cosas es lo que hace esto:
 *
 * - Se miran SEÑALES, no frases. De sus últimos mensajes sale "escribe corto",
 *   "es informal", "usa emojis"; nunca sus palabras, que es lo que produce el
 *   efecto loro.
 * - Sale una línea, no un párrafo. Esto viaja en cada petición, así que si
 *   costara cien tokens no compensaría.
 * - Si no hay señal clara, no se dice nada. Inventarse un perfil con dos
 *   mensajes es peor que no tener ninguno.
 *
 * Se calcula aquí, en el servidor, con lo que ya viene en la petición: no
 * cuesta ni una llamada al modelo ni una lectura de base de datos.
 */

export interface Turno {
  role: string;
  content: string;
}

/** Cuántos mensajes suyos se miran. Los últimos, que son los que valen. */
const CUANTOS = 8;
/** Con menos de esto no hay patrón, hay casualidad. */
const MINIMO = 3;

const EMOJI = /\p{Extended_Pictographic}/u;
const INFORMAL = /\b(bro|tío|tia|tía|colega|chaval|máquina|crack|jaja+|jeje+|porfa|vale|guay|joder|buah|xd)\b/i;
const FORMAL = /\b(usted|ustedes|le agradecería|cordialmente|estimad[oa]|por favor, podría)\b/i;
const TECNICO =
  /\b(api|endpoint|json|deploy|build|commit|css|html|sql|token|servidor|repositorio|función|variable|dominio|dns|framework|webhook|tsx?|componente)\b/i;

export function estiloDe(turnos: Turno[]): string {
  const suyos = turnos
    .filter((t) => t.role === "user" && typeof t.content === "string")
    .map((t) => t.content.trim())
    .filter(Boolean)
    .slice(-CUANTOS);

  if (suyos.length < MINIMO) return "";

  const medio = suyos.reduce((s, t) => s + t.length, 0) / suyos.length;
  const conEmoji = suyos.filter((t) => EMOJI.test(t)).length;
  const informales = suyos.filter((t) => INFORMAL.test(t)).length;
  const formales = suyos.filter((t) => FORMAL.test(t)).length;
  const tecnicos = suyos.filter((t) => TECNICO.test(t)).length;

  const señales: string[] = [];

  // Los umbrales son altos a propósito: una señal floja mandando sobre el tono
  // de todas las respuestas hace más daño que no tener ninguna.
  if (medio < 60) señales.push("escribe mensajes muy cortos, así que contéstale corto");
  else if (medio > 400) señales.push("escribe largo y con detalle");

  if (formales > informales && formales >= 2) señales.push("es formal: trátale de usted");
  else if (informales >= 2) señales.push("es informal y coloquial");

  if (conEmoji >= 2) señales.push("usa emojis, así que alguno tuyo encaja");
  else if (conEmoji === 0 && suyos.length >= 5) señales.push("no usa emojis; tú tampoco");

  if (tecnicos >= 3) señales.push("sabe de tecnología: no le expliques lo básico");

  if (!señales.length) return "";

  return `Cómo escribe esta persona (sale de sus últimos mensajes): ${señales.join("; ")}.
Devuélvele ese registro, pero NO copies sus palabras ni sus erratas ni le imites:
eso es lo que suena a burla.`;
}
