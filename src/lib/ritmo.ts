/**
 * A qué ritmo aparece la respuesta en pantalla.
 *
 * El texto no llega del motor a un ritmo humano: llega a borbotones, y a veces
 * un párrafo entero de golpe. Pintarlo tal cual se lee mal —aparece un muro y
 * hay que buscar por dónde ibas— y además se lee como si no hubiera pensado
 * nada: la respuesta ya estaba hecha antes de que te diera tiempo a mirarla.
 *
 * Así que el texto se guarda entero según llega, pero se enseña a un ritmo
 * propio. No es un adorno: es lo que deja seguir la frase mientras se escribe,
 * que es como se lee a alguien que está contestando.
 *
 * La velocidad no es fija. Sale del retraso que se lleva acumulado, con un
 * suelo y un techo:
 *
 * - El SUELO evita que una respuesta corta salga letra a letra.
 * - El TECHO es lo que hace que se note. Sin él, un motor rápido volvería a
 *   escupir el párrafo de golpe y no habríamos hecho nada.
 * - Y el retraso manda por encima del suelo, así que cuanto más se acumula,
 *   más rápido se vacía: nunca se queda atrás sin remedio.
 *
 * Cuando el motor ha terminado, el techo sube: ahí ya no se está esperando a
 * nadie y hacer esperar sería una tontería.
 */

export interface Ajustes {
  /** Caracteres por segundo como mínimo. */
  suelo?: number;
  /** Y como máximo mientras el motor sigue escribiendo. */
  techo?: number;
  /** El máximo una vez ha terminado: solo queda vaciar lo que falta. */
  techoFinal?: number;
  /** En cuántos segundos se querría alcanzar lo que falta. */
  alcance?: number;
}

const POR_DEFECTO: Required<Ajustes> = {
  // Unos 150 caracteres por segundo: se lee mientras se escribe, que es el
  // ritmo al que se le lee a alguien que está contestando. Por debajo de 100
  // impacienta, y por encima de 350 vuelve a ser un muro que aparece.
  suelo: 150,
  techo: 330,
  techoFinal: 2800,
  // Lo que se tarda como mucho en alcanzar lo que falta. Corto a propósito: es
  // lo que evita que la cola se arrastre cuando el motor ya ha terminado.
  alcance: 0.55,
};

export interface Ritmo {
  /**
   * Cuántos caracteres se pueden enseñar ya, a día de `ahora`.
   *
   * Se le pasa el total recibido y si el motor ya ha terminado. Devuelve
   * siempre un número que no baja: lo que se enseñó, enseñado está.
   */
  visibles(ahora: number, total: number, terminado?: boolean): number;
  /** ¿Queda texto recibido que todavía no se ha enseñado? */
  pendiente(total: number): boolean;
  /** Enseñarlo todo ya: parar, un error, o cambiar de conversación. */
  todo(total: number): void;
}

export function crearRitmo(ahora: number, ajustes: Ajustes = {}): Ritmo {
  const { suelo, techo, techoFinal, alcance } = { ...POR_DEFECTO, ...ajustes };

  let mostrados = 0;
  let ultimo = ahora;
  /*
    Los caracteres a medias, guardados de un fotograma al siguiente.

    Sin esto, el redondeo se comía la velocidad. A sesenta fotogramas por
    segundo, 150 caracteres por segundo son 2,5 por fotograma; redondeando
    hacia abajo salen 2, que son 120. Y lo que se pierde no es proporcional: a
    ritmos lentos, 1,4 se convierte en 1 y se pierde casi un tercio. El resto
    se acumula y se paga en el fotograma siguiente.
  */
  let resto = 0;

  return {
    visibles(momento, total, terminado = false) {
      const atraso = total - mostrados;
      if (atraso <= 0) {
        ultimo = momento;
        return mostrados;
      }

      // Un salto hacia atrás del reloj, o dos llamadas en el mismo milisegundo,
      // no pueden hacer que el texto retroceda ni que se quede clavado.
      const segundos = Math.max(0, (momento - ultimo) / 1000);
      ultimo = momento;
      if (segundos === 0) return mostrados;

      const velocidad = Math.min(
        Math.max(atraso / alcance, suelo),
        terminado ? techoFinal : techo,
      );

      resto += velocidad * segundos;
      // Siempre al menos un carácter cuando toca avanzar: si no, un fotograma
      // muy corto no movería nada y el texto daría tirones.
      const avance = Math.max(1, Math.floor(resto));
      resto -= avance;
      if (resto < 0) resto = 0;

      mostrados = Math.min(total, mostrados + avance);
      return mostrados;
    },

    pendiente(total) {
      return mostrados < total;
    },

    todo(total) {
      mostrados = total;
    },
  };
}
