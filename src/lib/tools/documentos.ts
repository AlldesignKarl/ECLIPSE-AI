import type { Herramienta } from "./tipos";

/**
 * Generar archivos de verdad a partir de la conversación.
 *
 * Solo formatos que este servidor sabe escribir **bien** y sin librerías que
 * inflen el paquete: texto, Markdown, CSV y JSON. Son los que se producen
 * escribiendo bytes, sin ambigüedad y sin quedar a medias.
 *
 * PDF, DOCX y XLSX quedan fuera a propósito y no es pereza: un DOCX o un XLSX
 * son un ZIP con varios XML dentro, y un PDF real necesita tipografías y tabla
 * de referencias cruzadas. Se pueden hacer, pero mal hechos abren corruptos en
 * la mitad de los programas, y prefiero no ofrecer un botón que a veces
 * entrega basura. Se harán con su librería cuando toque.
 */

/** Un campo de CSV que lleve coma, comilla o salto necesita ir entrecomillado. */
function celdaCSV(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const FORMATOS = {
  txt: { mime: "text/plain; charset=utf-8", extension: "txt" },
  md: { mime: "text/markdown; charset=utf-8", extension: "md" },
  csv: { mime: "text/csv; charset=utf-8", extension: "csv" },
  json: { mime: "application/json; charset=utf-8", extension: "json" },
} as const;

type Formato = keyof typeof FORMATOS;

/** Sin barras ni dos puntos: el nombre acaba en el disco de alguien. */
function nombreSeguro(propuesto: string, extension: string): string {
  const limpio = propuesto
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .trim()
    .slice(0, 60);
  return `${limpio || "eclipse"}.${extension}`;
}

export const herramientaDocumento: Herramienta = {
  nombre: "crear_archivo",
  descripcion: `Crea un archivo descargable con el contenido que le des. Formatos: txt, md
(Markdown), csv (tabla) y json. Úsala cuando te pidan explícitamente un archivo, una
tabla para abrir en Excel o algo para guardar. Para csv pasa las filas en "tabla";
para el resto, el texto en "contenido". No la uses para enseñar algo que cabe en la
respuesta: un archivo que hay que descargar para leer dos líneas estorba.`,
  parametros: {
    type: "object",
    properties: {
      nombre: { type: "string", description: "Nombre del archivo, sin extensión." },
      formato: { type: "string", enum: Object.keys(FORMATOS), description: "txt, md, csv o json." },
      contenido: {
        type: "string",
        description: "El contenido, para txt, md y json. Se ignora si el formato es csv.",
      },
      tabla: {
        type: "array",
        description:
          "Solo para csv: las filas, la primera con los encabezados. Cada fila, una lista de celdas.",
        items: { type: "array", items: { type: "string" } },
      },
    },
    required: ["nombre", "formato"],
  },
  // No necesita ninguna clave: son bytes que escribe el propio servidor.
  disponible: () => true,
  async ejecutar(args, ctx) {
    const formato = String(args.formato ?? "txt").toLowerCase() as Formato;
    if (!(formato in FORMATOS))
      return {
        texto: "",
        error: `No sé crear archivos "${formato}". Puedo: ${Object.keys(FORMATOS).join(", ")}.`,
      };

    let contenido: string;

    if (formato === "csv") {
      const tabla = args.tabla;
      if (!Array.isArray(tabla) || tabla.length === 0)
        return { texto: "", error: "Para un CSV hace falta la tabla con sus filas." };

      contenido = tabla
        .map((fila) => (Array.isArray(fila) ? fila.map(celdaCSV).join(",") : celdaCSV(fila)))
        // CRLF: es lo que espera Excel, y con saltos sueltos parte mal las filas.
        .join("\r\n");
    } else {
      contenido = String(args.contenido ?? "");
      if (!contenido.trim()) return { texto: "", error: "El archivo saldría vacío." };

      if (formato === "json") {
        try {
          contenido = JSON.stringify(JSON.parse(contenido), null, 2);
        } catch {
          return { texto: "", error: "Ese contenido no es JSON válido." };
        }
      }
    }

    // Medio mega es de sobra para cualquier cosa escrita, y evita que una
    // respuesta desbocada se convierta en una descarga enorme.
    if (contenido.length > 500_000)
      return { texto: "", error: "El archivo es demasiado grande (más de 500.000 caracteres)." };

    const { mime, extension } = FORMATOS[formato];
    const nombre = nombreSeguro(String(args.nombre ?? "eclipse"), extension);
    ctx.avisar?.(`Escribiendo ${nombre}`);

    return {
      texto: `Archivo "${nombre}" creado (${contenido.length} caracteres). Ya lo tiene el usuario para descargar; no repitas su contenido en la respuesta.`,
      archivo: { nombre, mime, contenido },
    };
  },
};
