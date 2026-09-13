import { generateImage, MediaError } from "../media";
import { estamparDataUrl } from "../watermark";
import type { Herramienta } from "./tipos";

/**
 * Crear imágenes, como herramienta.
 *
 * Antes esto era un modo: había que acordarse de pulsar "Imagen" antes de
 * pedirla. Eso obliga a la persona a saber cómo está construida la aplicación
 * por dentro, que es justo lo que no tiene por qué saber. Siendo herramienta,
 * quien decide es el modelo: si le pides una imagen, la hace; si le preguntas
 * algo, responde. Como en cualquier otra IA.
 *
 * La cadena de motores, la mejora del prompt y la marca de agua son las mismas
 * de siempre: esto solo cambia quién aprieta el botón.
 */
export const herramientaImagen: Herramienta = {
  nombre: "crear_imagen",
  descripcion: `Crea una imagen a partir de una descripción y se la enseña al usuario.
Úsala cuando pidan una imagen, un dibujo, una ilustración, un logo, un fondo o una
idea visual, aunque no digan la palabra "imagen" ("hazme un eclipse sobre el mar").
Tarda unos segundos y consume cuota, así que no la uses por tu cuenta para adornar
una respuesta: solo cuando quieran una imagen. Si te piden cambios sobre una que ya
hiciste, vuelve a llamarla describiendo la escena ENTERA como debe quedar, no solo el
cambio.`,
  parametros: {
    type: "object",
    properties: {
      descripcion: {
        type: "string",
        description:
          "Qué debe verse. Cuanto más concreta —encuadre, luz, estilo, colores—, mejor sale.",
      },
    },
    required: ["descripcion"],
  },
  // Siempre hay con qué: la cadena acaba en un servicio que no pide clave.
  disponible: () => true,
  async ejecutar(args, ctx) {
    const descripcion = String(args.descripcion ?? "").trim();
    if (!descripcion) return { texto: "", error: "No has dicho qué imagen quieres." };

    ctx.avisar?.(descripcion);

    try {
      const hecha = await generateImage(descripcion);
      const url = await estamparDataUrl(hecha.dataUrl);

      return {
        // Al modelo se le dice que ya está hecha y que no la describa: la ve el
        // usuario en pantalla, y contarla otra vez con palabras sobra.
        texto: `Imagen creada y ya visible para el usuario. No la describas ni repitas el prompt; como mucho, una frase corta.${
          hecha.note ? ` (Nota del motor: ${hecha.note})` : ""
        }`,
        imagen: { url, prompt: hecha.prompt || descripcion },
      };
    } catch (err) {
      return {
        texto: "",
        error:
          err instanceof MediaError || err instanceof Error
            ? err.message
            : "No se ha podido crear la imagen.",
      };
    }
  },
};
