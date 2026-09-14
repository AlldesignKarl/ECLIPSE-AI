/**
 * Grupos: varias personas hablando con ECLIPSE en el mismo sitio.
 *
 * No es un chat de grupo con un bot dentro: es una conversación con ECLIPSE a
 * la que entran varias personas. La diferencia se nota en lo que ve el modelo
 * —quién dice cada cosa, porque "yo ya lo hice" no significa lo mismo dicho por
 * uno o por otro— y en lo que se espera de él: no contesta a cada frase suelta,
 * contesta cuando le preguntan.
 *
 * Para qué sirve de verdad: un piso organizando un viaje, tres socios montando
 * algo, una clase preparando un trabajo. Sitios donde ahora mismo alguien le
 * pregunta a una IA en su móvil y luego copia y pega el resultado al grupo.
 */

/** Cuánta gente cabe. Más de esto deja de ser una conversación. */
export const MAX_PERSONAS = 20;
/** Y cuántos mensajes se guardan de cada grupo. */
export const MAX_MENSAJES = 300;
/** Grupos que puede tener una persona. */
export const MAX_GRUPOS = 10;

export interface Miembro {
  /** El correo, que es quien es. No se le enseña a los demás. */
  email: string;
  /** Cómo se le ve: el nombre que eligió, o el principio de su correo. */
  nombre: string;
  /** Quien lo creó puede echar a gente y borrarlo. */
  dueno: boolean;
  entro: number;
}

export interface MensajeGrupo {
  id: string;
  /** Quién lo escribió. `null` cuando habla ECLIPSE. */
  de: string | null;
  /** El nombre con el que se ve, guardado aquí para que no cambie al pasar. */
  nombre: string;
  texto: string;
  cuando: number;
}

export interface Grupo {
  id: string;
  nombre: string;
  creado: number;
  miembros: Miembro[];
  /** La llave para entrar. Quien la tiene, entra. */
  invitacion: string;
}

/** Lo que se le enseña a quien no está dentro: lo justo para decidir si entra. */
export interface Ojeada {
  id: string;
  nombre: string;
  personas: number;
  hueco: boolean;
}

export function esDueno(grupo: Grupo, email: string): boolean {
  return grupo.miembros.some((m) => m.email === email && m.dueno);
}

export function estaDentro(grupo: Grupo, email: string): boolean {
  return grupo.miembros.some((m) => m.email === email);
}

/**
 * Cómo se le ve a alguien en el grupo.
 *
 * Nunca el correo. En un grupo de gente que no tiene por qué conocerse entre
 * sí, enseñar el correo de todos es repartir sus datos sin que nadie lo haya
 * pedido. Con el nombre que eligió basta; y quien no eligió ninguno se queda
 * con el principio de su correo, que es lo que él mismo escribiría.
 */
export function comoSeLeVe(email: string, nombre?: string): string {
  const limpio = (nombre ?? "").trim();
  if (limpio) return limpio.slice(0, 40);
  const antes = email.split("@")[0] ?? "alguien";
  return antes.slice(0, 20);
}

/**
 * ¿Le están hablando a ECLIPSE, o están hablando entre ellos?
 *
 * Es la decisión que hace que un grupo con IA sea usable o insoportable. Si
 * contesta a todo, no se puede hablar; si no contesta nunca, no sirve de nada.
 *
 * Contesta cuando le nombran, cuando le preguntan algo directamente, o cuando
 * es el primer mensaje del grupo. Lo demás lo lee y se calla, que es lo que
 * haría alguien educado sentado en esa mesa.
 */
export function leHablanAEclipse(texto: string, esElPrimero = false): boolean {
  if (esElPrimero) return true;

  const t = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  // Por su nombre, con arroba o sin ella.
  if (/(^|\s)@?eclipse\b/.test(t)) return true;
  // Una orden directa: "dinos", "búscanos", "hazme"…
  if (/^(dinos|dime|cuentanos|cuentame|buscanos|buscame|hazme|haznos|explicanos|explicame|resumenos|resumeme|ayudanos|ayudame|ponme|ponnos|crea|créanos|recomiendanos|recomiendame)\b/.test(t))
    return true;
  return false;
}
