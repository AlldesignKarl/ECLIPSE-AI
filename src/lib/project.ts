import type { GeneratedFile } from "./types";

const FENCE = /^```([^\n`]*)\n([\s\S]*?)\n?^```[ \t]*$/gm;

const LANGUAGES = new Set([
  "ts", "tsx", "js", "jsx", "json", "html", "css", "scss", "py", "python",
  "sh", "bash", "yaml", "yml", "toml", "md", "markdown", "sql", "go", "rust",
  "rs", "java", "kotlin", "kt", "c", "cpp", "cs", "php", "ruby", "rb", "swift",
  "dockerfile", "text", "plaintext", "env", "xml", "vue", "svelte",
]);

const PATH_LIKE = /^[\w.@-]+(?:\/[\w.@ -]+)*\.[\w]+$|^[\w.-]*Dockerfile$|^Makefile$|^\.[\w.-]+$/;

/**
 * Cuando el bloque viene sin ruta, el contenido suele decir qué archivo es.
 * Vale más `index.html` que `archivo-1.html`: con el nombre bueno, la página se
 * puede abrir y los estilos se encuentran entre sí.
 */
function nombrePorContenido(content: string, lang: string): string {
  const inicio = content.trimStart().slice(0, 400).toLowerCase();

  if (inicio.startsWith("<!doctype html") || inicio.startsWith("<html")) return "index.html";
  if (/^\{[\s\S]*"name"\s*:/.test(content.trim()) && /"version"\s*:/.test(content))
    return "package.json";
  if (inicio.startsWith("# ")) return "README.md";

  if (lang === "css" || lang === "scss") return `styles.${lang}`;
  if (lang === "js" || lang === "javascript") return "script.js";
  if (lang === "html") return "index.html";
  return "";
}

function extensionFor(lang: string): string {
  const map: Record<string, string> = {
    typescript: "ts", ts: "ts", tsx: "tsx", javascript: "js", js: "js", jsx: "jsx",
    python: "py", py: "py", bash: "sh", sh: "sh", json: "json", html: "html",
    css: "css", yaml: "yml", yml: "yml", markdown: "md", md: "md", sql: "sql",
    go: "go", rust: "rs", rs: "rs", java: "java", php: "php", ruby: "rb", rb: "rb",
  };
  return map[lang.toLowerCase()] ?? "txt";
}

/**
 * Saca los archivos de una respuesta en modo código.
 * Acepta ```lang ruta/archivo.ext y también una línea con la ruta justo antes
 * del bloque (`**src/app.ts**`, `// src/app.ts`, `Archivo: src/app.ts`).
 */
/**
 * Cierra el último bloque si se quedó abierto.
 *
 * Cuando una respuesta se corta por ser demasiado larga, el bloque de código
 * se queda sin su línea de cierre. Y sin cierre no hay archivo: el panel con
 * la vista previa y el ZIP no aparecía, y quedaba el código en crudo, que es
 * justo lo que no queríamos. Con el cierre puesto, el archivo existe —aunque
 * esté a medias— y se puede ver, descargar y pedir que lo continúe.
 */
function cerrarBloqueAbierto(markdown: string): string {
  const aperturas = (markdown.match(/^```/gm) ?? []).length;
  return aperturas % 2 === 1 ? `${markdown}\n\u0060\u0060\u0060` : markdown;
}

export function extractFiles(texto: string): GeneratedFile[] {
  const markdown = cerrarBloqueAbierto(texto);
  const files: GeneratedFile[] = [];
  const used = new Map<string, number>();
  FENCE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = FENCE.exec(markdown)) !== null) {
    const info = match[1].trim();
    const content = match[2];
    if (!content.trim()) continue;

    const tokens = info.split(/\s+/).filter(Boolean);
    let lang = "";
    let path = "";

    for (const token of tokens) {
      const clean = token.replace(/^[("']|[)"',:]$/g, "");
      if (!lang && LANGUAGES.has(clean.toLowerCase()) && !clean.includes("/")) {
        lang = clean.toLowerCase();
        continue;
      }
      if (!path && (PATH_LIKE.test(clean) || clean.includes("/"))) path = clean;
    }

    if (!path) path = pathFromPrecedingLine(markdown, match.index);

    if (!path) path = nombrePorContenido(content, lang);

    if (!path) {
      const index = files.length + 1;
      path = `archivo-${index}.${extensionFor(lang || "text")}`;
    }

    path = path.replace(/^\.\//, "").replace(/^\/+/, "");

    // Si el modelo repite una ruta, nos quedamos con la última versión.
    if (used.has(path)) {
      files[used.get(path)!].content = content;
    } else {
      used.set(path, files.length);
      files.push({ path, content });
    }
  }

  return files;
}

function pathFromPrecedingLine(markdown: string, fenceIndex: number): string {
  const before = markdown.slice(0, fenceIndex).trimEnd();
  const line = before.slice(before.lastIndexOf("\n") + 1).trim();
  const candidate = line
    .replace(/^#+\s*/, "")
    .replace(/^(?:archivo|fichero|file|ruta|path)\s*:\s*/i, "")
    .replace(/^[/#*`\-\s]*|[*`:\s]*$/g, "")
    .trim();
  return PATH_LIKE.test(candidate) || (candidate.includes("/") && candidate.includes("."))
    ? candidate
    : "";
}

/** Nombre de proyecto a partir de la petición del usuario. */
export function projectName(prompt: string): string {
  const slug = prompt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("-");
  return slug || "proyecto-eclipse";
}

export function guessLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", json: "json",
    html: "html", css: "css", scss: "scss", py: "python", sh: "bash",
    yml: "yaml", yaml: "yaml", md: "markdown", sql: "sql", go: "go",
    rs: "rust", java: "java", php: "php", rb: "ruby", toml: "toml",
  };
  return map[ext] ?? "plaintext";
}

/**
 * La explicación sin el código.
 *
 * En modo código la respuesta trae los archivos enteros dentro, y volcarlos en
 * la conversación obliga a desplazarse cientos de líneas para leer las cuatro
 * frases que los acompañan. Los archivos ya se ven en su panel, con su árbol y
 * su botón de copiar, así que aquí se quitan y queda lo que sí se lee.
 */
export function proseOnly(markdown: string): string {
  return quitarBloqueSinCerrar(markdown)
    .replace(FENCE_ANY, "")
    // La línea que anunciaba el archivo se queda huérfana sin su bloque.
    .replace(/^[ \t]*(?:\*\*|__)?(?:archivo|file|fichero)\s*:?[^\n]*(?:\*\*|__)?[ \t]*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Mientras la respuesta llega, el último bloque puede estar a medio escribir.
 * Se corta desde su apertura para que el código no asome y desaparezca; el
 * resto del texto, incluido lo que va después de los bloques ya cerrados, se
 * queda donde está.
 */
function quitarBloqueSinCerrar(markdown: string): string {
  const aperturas: number[] = [];
  const marca = /^```/gm;

  let hallazgo: RegExpExecArray | null;
  while ((hallazgo = marca.exec(markdown)) !== null) aperturas.push(hallazgo.index);

  // Pares completos: todos los bloques están cerrados.
  if (aperturas.length % 2 === 0) return markdown;
  return markdown.slice(0, aperturas[aperturas.length - 1]);
}

/** Como FENCE, pero sin estado: `proseOnly` puede llamarse en cualquier orden. */
const FENCE_ANY = /^```[^\n`]*\n[\s\S]*?\n?^```[ \t]*$/gm;

/**
 * La línea con la que el modelo pide que se retoque la imagen adjunta.
 *
 * Va al final de su respuesta, sola, con el formato `[EDITAR: ...]`. Se saca de
 * ahí y se borra del texto: es una instrucción para el motor de imagen, no algo
 * que nadie tenga que leer. Si el modelo no la escribe, es que la foto ya
 * estaba bien y no hay nada que hacer.
 */
export function leerRetoque(texto: string): { limpio: string; encargo?: string } {
  const marca = /\[\s*EDITAR\s*:\s*([\s\S]+?)\]\s*$/i;
  const hallazgo = texto.match(marca);
  if (!hallazgo) return { limpio: texto };

  const encargo = hallazgo[1].trim();
  const limpio = texto.slice(0, hallazgo.index).trimEnd();

  // "no", "ninguno" y compañía: el modelo ha contestado a la marca en vez de
  // omitirla. Es lo mismo que no pedir nada.
  if (!encargo || /^(no|nada|ninguno|none|n\/a)\b/i.test(encargo)) return { limpio };
  return { limpio, encargo };
}

/**
 * Los archivos de una respuesta del chat normal, no de ECLIPSE CODE.
 *
 * En CODE todo bloque de código es parte del proyecto y se guarda. En una
 * conversación no: ahí la mitad de los bloques son un ejemplo de tres líneas, un
 * comando para pegar en la terminal o un trozo suelto para explicar algo, y
 * convertir cada uno en un "proyecto" con su panel y su ZIP llenaría la
 * conversación de ruido.
 *
 * La frontera es si lo escrito se abre y funciona por sí solo: un documento HTML
 * completo sí —una animación, una escena 3D, un juego, una página—, y eso es
 * justo lo que alguien quiere ver funcionando y descargarse. Un fragmento, no.
 */
export function archivosEjecutables(markdown: string): GeneratedFile[] {
  const archivos = extractFiles(markdown);
  const hayPagina = archivos.some((f) => {
    const inicio = f.content.trimStart().slice(0, 400).toLowerCase();
    return inicio.startsWith("<!doctype html") || inicio.startsWith("<html");
  });
  return hayPagina ? archivos : [];
}

/**
 * Adelgaza la conversación antes de mandarla.
 *
 * Una charla de ECLIPSE CODE engorda muy deprisa: cada respuesta lleva un
 * archivo entero dentro, y a los cuatro cubos de Rubik la conversación pesa
 * más que todo lo demás junto. Como se manda entera en cada mensaje, se acaba
 * chocando con el límite por minuto del proveedor —"Request too large"— y deja
 * de responder justo cuando más contexto hay.
 *
 * Lo que se quita son las versiones viejas del código. La última se conserva
 * entera, porque es sobre la que se pide el cambio; de las anteriores basta
 * con saber que existieron. Nadie pide "vuelve a la versión de hace cuatro",
 * y si lo pidiera, ahí está el panel de cada mensaje con sus archivos.
 */
export function aligerarHistorial<T extends { role: string; content: string }>(
  mensajes: T[],
): T[] {
  const ultimoConCodigo = mensajes.reduce(
    (ultimo, m, i) => (m.role === "assistant" && m.content.includes("\u0060\u0060\u0060") ? i : ultimo),
    -1,
  );

  return mensajes.map((m, i) => {
    if (m.role !== "assistant" || i === ultimoConCodigo) return m;
    if (!m.content.includes("\u0060\u0060\u0060")) return m;

    return {
      ...m,
      content: m.content.replace(
        /^\u0060\u0060\u0060[^\n]*\n[\s\S]*?\n?^\u0060\u0060\u0060[ \t]*$/gm,
        "[código de una versión anterior, omitido para no repetirlo]",
      ),
    };
  });
}
