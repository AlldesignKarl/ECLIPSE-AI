import { buscar, type Hecho } from "./tipos";

/**
 * Qué parte de la memoria se le manda al modelo en ESTE mensaje.
 *
 * Antes se le mandaban los veinte hechos más recientes siempre, preguntara lo
 * que preguntara. Eso tiene dos costes y ninguno se ve: se pagan esos tokens en
 * cada mensaje —y en la capa gratuita el cupo por minuto es el techo de lo que
 * puede escribir— y, lo que es peor, con veinte frases delante el modelo se
 * pierde entre lo que importa y lo que no. Que sepa que tienes un perro no
 * ayuda a contestar una pregunta sobre facturas.
 *
 * Así que van dos grupos y nada más:
 *
 * 1. Las PREFERENCIAS, que valen para cualquier pregunta: cómo quiere las
 *    respuestas, en qué idioma, cómo se le trata. Son las que cambian el tono
 *    de todo y por eso se mandan siempre.
 * 2. Lo que tiene que ver con lo que acaba de escribir, buscado por palabras.
 *
 * Si no hay nada relevante, no se manda nada relevante. Esa es la gracia.
 */

/**
 * Cómo se reconoce una preferencia.
 *
 * Ojo con qué se considera preferencia: lo que se busca aquí es lo que cambia
 * CÓMO hay que hablarle —respuestas cortas, en castellano, sin listas, de
 * usted—, no lo que le gusta. "Le gusta el cine de los ochenta" es un dato
 * suyo perfectamente válido, pero mandarlo en cada mensaje no mejora ninguna
 * respuesta: ese sale cuando se hable de cine, como los demás.
 *
 * No es perfecto ni pretende serlo: colar una de más cuesta quince tokens, y
 * dejar fuera "prefiere que le tutees" cuesta que ECLIPSE hable como no le
 * gusta.
 */
const PREFERENCIA =
  /respuestas?|responder|contest|idioma|castellano|espa[ñn]ol|ingl[eé]s|tutea|de usted|tono|breve|concis|listas|vi[ñn]etas|emoji|explicaci|tecnicismos|formato|llamarle|que le llames|trato/i;

export function esPreferencia(texto: string): boolean {
  return PREFERENCIA.test(texto);
}

/**
 * Cuántos hechos van SIEMPRE, aunque no vengan a cuento.
 *
 * Cuatro, y no cero, por un caso que se vio en la prueba de memoria y que es de
 * los que más se dan: "¿por dónde íbamos?". Ahí no hay ninguna palabra que
 * buscar, así que un filtro estricto no manda nada y ECLIPSE se queda a ciegas
 * justo cuando le están pidiendo que se acuerde. Se rellena con los más
 * RECIENTES, que son los que tienen que ver con lo que esa persona anda
 * haciendo estos días.
 *
 * Cuatro frases cortas son unos sesenta tokens. Los veinte de antes eran
 * cuatrocientos, en cada mensaje.
 */
const SIEMPRE = 4;

export function hechosRelevantes(
  hechos: Hecho[],
  mensaje: string,
  /** Cuántos como mucho. Ocho frases cortas son ficha de sobra. */
  tope = 8,
): Hecho[] {
  if (!hechos.length) return [];

  // Las preferencias, las más recientes primero: son las que siguen valiendo.
  const preferencias = hechos.filter((h) => esPreferencia(h.texto)).slice(0, 3);

  const puestos = new Set(preferencias.map((h) => h.id));
  const relevantes = buscar(
    hechos.filter((h) => !puestos.has(h.id)),
    mensaje,
    tope - preferencias.length,
  );
  for (const h of relevantes) puestos.add(h.id);

  const salida = [...preferencias, ...relevantes];

  /*
    El relleno es SOLO para cuando no ha encontrado nada.

    Si la pregunta ha encajado con algo, eso es lo que hace falta y punto:
    añadirle tres frases más "por si acaso" es volver a lo de antes en pequeño.
    El relleno existe para el caso contrario —"¿por dónde íbamos?", donde no hay
    ninguna palabra que buscar—, que es justo cuando quedarse sin nada duele.
  */
  if (!relevantes.length) {
    for (const h of hechos) {
      if (salida.length >= Math.min(SIEMPRE, tope)) break;
      if (!puestos.has(h.id)) {
        salida.push(h);
        puestos.add(h.id);
      }
    }
  }

  return salida.slice(0, tope);
}
