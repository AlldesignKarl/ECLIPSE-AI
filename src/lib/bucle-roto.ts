/**
 * Detectar cuando un modelo se engancha repitiendo lo mismo.
 *
 * Pasa con los modelos afinados para completar código cuando se les pone a
 * conversar: en vez de responder, entran en bucle. Lo que se vio fue una
 * respuesta con treinta "¿Qué forma de…?" seguidos, cada vez más absurdos, y
 * el usuario esperando a que terminara de gastarse el presupuesto entero.
 *
 * No se puede arreglar desde el modelo, pero sí se puede cortar: si lo último
 * que ha escrito es la misma frase una y otra vez, ya no va a decir nada nuevo.
 */

/** Cuántas repeticiones seguidas hacen falta para dar el bucle por cierto. */
const VECES = 5;
/** Lo más corto que se considera una frase, para no cortar por una coma. */
const MINIMO = 12;
/** Cuánto texto reciente se mira. */
const VENTANA = 600;

export function crearVigilanteDeBucle() {
  let todo = "";
  let avisado = false;

  return {
    /** Devuelve true la primera vez que detecta el bucle. */
    trozo(texto: string): boolean {
      if (avisado) return false;
      todo += texto;
      if (todo.length < MINIMO * VECES) return false;

      const cola = todo.slice(-VENTANA);

      /*
        Se busca el trozo final más corto que, repetido, llene lo último
        escrito. Empezando por el más corto porque el bucle se detecta antes:
        cuanto más pequeña es la frase que se repite, más veces cabe.
      */
      for (let largo = MINIMO; largo <= Math.floor(cola.length / VECES); largo++) {
        const patron = cola.slice(-largo);
        // Una frase que es todo el mismo carácter no cuenta: eso es una línea
        // de guiones o de espacios, y es legítimo.
        if (/^(.)\1*$/.test(patron)) continue;

        let veces = 1;
        while (
          veces < VECES &&
          cola.slice(-largo * (veces + 1), -largo * veces) === patron
        )
          veces++;

        if (veces >= VECES) {
          avisado = true;
          return true;
        }
      }
      return false;
    },
  };
}
