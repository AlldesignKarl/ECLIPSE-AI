import { memoriaApagada } from "../auth";
import { hechosDe, quien, resumenesDe } from "../memoria/almacen";
import { buscar } from "../memoria/tipos";
import type { Herramienta } from "./tipos";

/**
 * Mirar las conversaciones de antes.
 *
 * Esto es lo que convierte la memoria en algo útil de verdad. Los hechos —"tiene
 * una tienda en Shopify"— se le pasan siempre porque son cuatro líneas; de qué
 * fue cada conversación NO, porque son ochenta y le llenarían la cabeza de
 * ruido. Así que están aquí, y las busca cuando hacen falta: "¿cómo llamamos al
 * proyecto aquel?", "sigue con lo de la web", "¿qué decidimos del logo?".
 *
 * Lo que devuelve son los resúmenes, no las conversaciones: las conversaciones
 * viven en el móvil de cada uno y no se guardan en ninguna parte. Es de qué
 * hablasteis, no lo que dijisteis.
 */
export const herramientaRecuerdos: Herramienta = {
  nombre: "mis_conversaciones",
  descripcion: `Busca en las conversaciones anteriores de esta misma persona: de qué
hablasteis y en qué quedasteis. Úsala cuando se refiera a algo de antes sin explicarlo
—"sigue con lo de la web", "¿cómo llamamos al proyecto?", "lo que hablamos ayer",
"¿qué habíamos decidido?"— o cuando te pregunte qué habéis hecho juntos. Devuelve
resúmenes de dos líneas, no las conversaciones enteras: para los detalles, pídeselos.
NO la uses para cosas que ya están en esta conversación ni para conocimiento general.`,
  parametros: {
    type: "object",
    properties: {
      buscar: {
        type: "string",
        description:
          'Sobre qué. Palabras clave: "la tienda", "el logo", "el trabajo de biología". Vacío para ver las últimas.',
      },
    },
  },
  // Depende de la persona, no del servidor: si no hay nada guardado, lo dice.
  disponible: () => true,
  async ejecutar(args) {
    const email = await quien();
    if (!email)
      return {
        texto:
          "Esta persona no ha entrado con su cuenta, así que no hay conversaciones anteriores a las que mirar. No te lo inventes: pregúntale lo que te falte.",
      };

    // Con la memoria apagada tampoco se puede mirar atrás: es la misma
    // promesa, y dejar esta puerta abierta la rompería entera.
    if (await memoriaApagada(email))
      return {
        texto:
          "Esta persona tiene la memoria apagada en Ajustes, así que no hay nada anterior que mirar. No insistas: pregúntale lo que te falte.",
      };

    const consulta = String(args.buscar ?? "").trim();
    const temas = await resumenesDe(email);
    if (!temas.length)
      return {
        texto:
          "Todavía no hay conversaciones anteriores guardadas de esta persona. Es la primera vez, o tiene la memoria apagada.",
      };

    const encontrados = consulta ? buscar(temas, consulta, 6) : temas.slice(0, 6);
    if (!encontrados.length)
      return { texto: `No hay ninguna conversación anterior que hable de "${consulta}".` };

    const fecha = (ms: number) =>
      new Date(ms).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

    const lista = encontrados
      .map((t) => `— «${t.titulo}» (${fecha(t.cuando)}): ${t.texto}`)
      .join("\n");

    const hechos = await hechosDe(email);
    const ficha = hechos.length
      ? `\n\nY lo que ya sabes de ella:\n${hechos.slice(0, 8).map((h) => `- ${h.texto}`).join("\n")}`
      : "";

    return {
      texto: `Conversaciones anteriores${consulta ? ` sobre "${consulta}"` : ""}:\n\n${lista}${ficha}\n\n(Son resúmenes: de lo que no esté aquí, pregúntale.)`,
    };
  },
};
