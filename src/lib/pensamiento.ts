/**
 * Separar lo que el modelo piensa de lo que responde.
 *
 * Los modelos escriben cosas que no son la respuesta y que nunca deberían
 * llegar a la pantalla:
 *
 * - Su deliberación, entre <think> y </think>. Es el borrador, va en inglés
 *   aunque la conversación sea en español, y verlo parece que la app se ha
 *   roto.
 * - Sus llamadas a herramientas, entre <tool_code>, <tool_call> y parecidos.
 *   Eso es maquinaria interna que se le escapa en texto, y al usuario le llega
 *   algo como search.query("Spain total household net worth 2024") en mitad de
 *   una pregunta sobre unos rascacielos. No significa nada para él.
 *
 * Todo eso va al panel de razonamiento, que es donde tiene sentido.
 *
 * Lo difícil es que el texto llega a trozos y una etiqueta puede partirse por
 * la mitad entre dos: "<thi" en uno y "nk>" en el siguiente. Por eso el final
 * de cada trozo se guarda hasta saber si empieza una etiqueta o no.
 */

/** Las etiquetas cuyo contenido no es la respuesta. */
const ETIQUETAS = [
  "think",
  "thinking",
  "tool_code",
  "tool_call",
  "tool_calls",
  "tool_outputs",
  "tool_output",
  "function_call",
  "reasoning",
  "scratchpad",
];

const ABRE = new RegExp(`<(${ETIQUETAS.join("|")})>`, "i");
const cierreDe = (etiqueta: string) => new RegExp(`</${etiqueta}>`, "i");

/** Lo más largo que puede medir una etiqueta: no hace falta guardar más. */
const MAX_COLA = Math.max(...ETIQUETAS.map((e) => e.length)) + 3;

export interface Separado {
  /** Lo que va a la respuesta. */
  texto: string;
  /** Lo que va al panel de razonamiento. */
  pensando: string;
}

export function crearSeparador() {
  /** La etiqueta abierta ahora mismo, o "" si estamos en la respuesta. */
  let abierta = "";
  let cola = "";

  return {
    /** Entrega un trozo y devuelve lo que ya se puede enseñar. */
    trozo(entrada: string): Separado {
      let resto = cola + entrada;
      cola = "";
      let texto = "";
      let pensando = "";

      while (resto) {
        const marca = abierta ? cierreDe(abierta).exec(resto) : ABRE.exec(resto);

        if (marca) {
          const antes = resto.slice(0, marca.index);
          if (abierta) pensando += antes;
          else texto += antes;
          abierta = abierta ? "" : marca[1].toLowerCase();
          resto = resto.slice(marca.index + marca[0].length);
          continue;
        }

        /*
          Sin etiqueta completa a la vista, el final puede ser el principio de
          una: se guarda para el trozo siguiente. Si no lo fuera, se soltará
          igualmente en cuanto llegue más texto o al cerrar.
        */
        const corte = Math.max(0, resto.length - MAX_COLA);
        const seguro = resto.slice(0, corte);
        const dudoso = resto.slice(corte);

        if (dudoso.includes("<")) {
          const desde = dudoso.indexOf("<");
          if (abierta) pensando += seguro + dudoso.slice(0, desde);
          else texto += seguro + dudoso.slice(0, desde);
          cola = dudoso.slice(desde);
        } else if (abierta) {
          pensando += resto;
        } else {
          texto += resto;
        }
        break;
      }

      return { texto, pensando };
    },

    /** Al acabar el flujo, lo que quedara guardado sale tal cual. */
    cerrar(): Separado {
      const sobra = cola;
      cola = "";
      // Si la etiqueta se quedó sin cerrar, lo que hay dentro sigue sin ser la
      // respuesta: un <tool_code> a medias en pantalla es ruido igualmente.
      return abierta ? { texto: "", pensando: sobra } : { texto: sobra, pensando: "" };
    },
  };
}
