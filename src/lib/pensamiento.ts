/**
 * Separar lo que el modelo piensa de lo que responde.
 *
 * Los modelos de razonamiento escriben su deliberación entre <think> y
 * </think> antes de contestar. Eso no es la respuesta: es el borrador, va en
 * inglés aunque la conversación sea en español, y verlo en pantalla parece que
 * la aplicación se ha roto. La interfaz ya tiene su sitio para el
 * razonamiento, así que hay que llevarlo allí.
 *
 * Lo difícil es que el texto llega a trozos y una etiqueta puede partirse por
 * la mitad entre dos: "<thi" en uno y "nk>" en el siguiente. Por eso el final
 * de cada trozo se guarda hasta saber si empieza una etiqueta o no.
 */

const ABRE = /<think(?:ing)?>/i;
const CIERRA = /<\/think(?:ing)?>/i;
/** Lo más largo que puede medir una etiqueta: no hace falta guardar más. */
const MAX_COLA = "</thinking>".length;

export interface Separado {
  /** Lo que va a la respuesta. */
  texto: string;
  /** Lo que va al panel de razonamiento. */
  pensando: string;
}

export function crearSeparador() {
  let dentro = false;
  let cola = "";

  return {
    /** Entrega un trozo y devuelve lo que ya se puede enseñar. */
    trozo(entrada: string): Separado {
      let resto = cola + entrada;
      cola = "";
      let texto = "";
      let pensando = "";

      while (resto) {
        const marca = dentro ? CIERRA.exec(resto) : ABRE.exec(resto);

        if (marca) {
          const antes = resto.slice(0, marca.index);
          if (dentro) pensando += antes;
          else texto += antes;
          dentro = !dentro;
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
          if (dentro) pensando += seguro + dudoso.slice(0, desde);
          else texto += seguro + dudoso.slice(0, desde);
          cola = dudoso.slice(desde);
        } else if (dentro) {
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
      return dentro ? { texto: "", pensando: sobra } : { texto: sobra, pensando: "" };
    },
  };
}
