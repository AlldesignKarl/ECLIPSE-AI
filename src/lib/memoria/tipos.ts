/**
 * La memoria de ECLIPSE: que cuanto más se use, más sepa de ti.
 *
 * Hay dos cosas distintas aquí dentro, y conviene no mezclarlas:
 *
 * - Los HECHOS son lo que se sabe de una persona y sigue valiendo mañana: que
 *   tiene una tienda en Shopify, que estudia segundo de Bachillerato, que
 *   prefiere las respuestas cortas, que su perro se llama Tor. Son pocos,
 *   cortos, y se le pasan siempre.
 * - Los RESÚMENES son de qué fue cada conversación, en dos líneas. No se le
 *   pasan: los busca él cuando hace falta ("¿cómo llamamos al proyecto aquel?",
 *   "sigue con lo de la web"). Es lo que permite mirar atrás sin cargar con
 *   todo delante.
 *
 * Lo que NO se guarda es la conversación entera. Las conversaciones viven en el
 * móvil de cada uno y ahí se quedan; aquí solo queda lo justo para no empezar
 * de cero cada vez, y se puede borrar de un botón.
 */

export interface Hecho {
  id: string;
  /** Una frase. "Tiene una tienda de ropa en Shopify". */
  texto: string;
  /** Cuándo se supo por última vez. */
  cuando: number;
}

export interface Resumen {
  id: string;
  /** El de la conversación, tal cual se ve en la lista. */
  titulo: string;
  /** Dos líneas: de qué iba y en qué quedó. */
  texto: string;
  cuando: number;
}

/**
 * Cuántos hechos se guardan.
 *
 * Sesenta y no seiscientos, y no es por espacio: es que todos se le pasan al
 * modelo en cada mensaje. Con doscientos hechos delante, lo que pasa no es que
 * sepa más, es que se pierde entre lo que importa y lo que no. Cuando se llena,
 * cae lo más viejo.
 */
export const MAX_HECHOS = 60;

/** Y de cuántas conversaciones se recuerda de qué iban. */
export const MAX_RESUMENES = 80;

/** Un hecho más largo que esto no es un hecho, es un párrafo. */
export const LARGO_HECHO = 160;

/**
 * ¿Son el mismo hecho dicho de dos formas?
 *
 * Sin esto, la lista se llena de "Tiene una tienda online", "Vende ropa por
 * internet", "Tiene una tienda de ropa"... y las tres ocupan sitio para decir
 * lo mismo. Se comparan las palabras con contenido: si comparten casi todas, es
 * el mismo y se queda el más reciente, que es el que está más al día.
 */
export function esElMismo(a: string, b: string): boolean {
  const palabras = (t: string) =>
    new Set(
      t
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9ñ\s]/g, " ")
        .split(/\s+/)
        .filter((p) => p.length > 3),
    );

  const A = palabras(a);
  const B = palabras(b);
  if (!A.size || !B.size) return a.trim().toLowerCase() === b.trim().toLowerCase();

  let juntas = 0;
  for (const p of A) if (B.has(p)) juntas++;

  /*
    Ocho de cada diez, y al menos tres palabras en común.

    El umbral era siete de diez y se pasaba de listo: "tienda de ropa en
    Shopify" y "tienda de bicis en Shopify" comparten tres de cuatro palabras
    y se fundían en una, borrando que esa persona tiene dos tiendas. Fundir de
    más es peor que fundir de menos: de menos sobra una línea parecida, de más
    se pierde un dato.
  */
  return juntas >= 3 && juntas / Math.min(A.size, B.size) >= 0.8;
}

/** Mete un hecho nuevo, quitando el viejo si decía lo mismo. */
export function fundir(hechos: Hecho[], nuevo: Hecho): Hecho[] {
  const limpios = hechos.filter((h) => !esElMismo(h.texto, nuevo.texto));
  // Lo último arriba: al recortar, lo que cae es lo más viejo.
  return [nuevo, ...limpios].slice(0, MAX_HECHOS);
}

/**
 * Los que buscan, ordenados por lo que se parecen a lo que se busca.
 *
 * Búsqueda por palabras y no por significado, a propósito: buscar por
 * significado pide un modelo de embeddings, una base de datos vectorial y una
 * llamada de red por consulta. Para ochenta resúmenes de una persona, contar
 * palabras que coinciden acierta casi siempre y contesta al instante.
 */
export function buscar<T extends { titulo?: string; texto: string }>(
  lista: T[],
  consulta: string,
  cuantos = 6,
): T[] {
  const claves = consulta
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter((p) => p.length > 2);

  if (!claves.length) return lista.slice(0, cuantos);

  return lista
    .map((item) => {
      const texto = `${item.titulo ?? ""} ${item.texto}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      // El título pesa el doble: si alguien tituló algo "la web de la tienda",
      // eso es de lo que iba.
      const puntos = claves.reduce(
        (suma, c) =>
          suma +
          (texto.includes(c) ? 1 : 0) +
          ((item.titulo ?? "").toLowerCase().includes(c) ? 1 : 0),
        0,
      );
      return { item, puntos };
    })
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, cuantos)
    .map((x) => x.item);
}

/** Cómo se le cuentan los hechos al modelo. Sin adornos: es una ficha. */
export function comoFicha(hechos: Hecho[]): string {
  if (!hechos.length) return "";
  return hechos.map((h) => `- ${h.texto}`).join("\n");
}
