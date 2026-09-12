import type { GeneratedFile } from "./types";

/**
 * Montar el proyecto en una sola página para poder verlo funcionando.
 *
 * El navegador va a cargar el HTML dentro de un iframe sin origen propio, así
 * que no puede pedir sus hojas de estilo ni sus scripts: no hay servidor
 * detrás que se los dé. La solución es meterlos dentro, sustituyendo cada
 * referencia por el contenido del archivo correspondiente.
 */

/** El archivo que abre el proyecto, si es que se puede abrir. */
export function entryHtml(files: GeneratedFile[]): GeneratedFile | null {
  const htmls = files.filter((f) => /\.html?$/i.test(f.path));
  if (htmls.length === 0) return null;

  const nombre = (f: GeneratedFile) => f.path.split("/").pop()?.toLowerCase() ?? "";
  return (
    htmls.find((f) => nombre(f) === "index.html") ??
    // A igualdad, el que esté menos enterrado: suele ser el principal.
    htmls.sort((a, b) => a.path.split("/").length - b.path.split("/").length)[0]
  );
}

export interface Vista {
  html: string;
  /** Si de verdad se va a ver algo al abrirlo. */
  funciona: boolean;
  /** Qué le falta, cuando no funciona. */
  motivo?: string;
}

/** Busca un archivo por una ruta escrita desde otro archivo. */
function resolver(files: GeneratedFile[], desde: string, referencia: string): GeneratedFile | null {
  const limpia = referencia.split(/[?#]/)[0].trim();
  if (!limpia || /^(https?:)?\/\//i.test(limpia) || limpia.startsWith("data:")) return null;

  const carpeta = desde.includes("/") ? desde.slice(0, desde.lastIndexOf("/")) : "";
  const candidatos = [
    // Tal cual, relativa a la carpeta del HTML.
    [carpeta, limpia.replace(/^\.\//, "")].filter(Boolean).join("/"),
    // Desde la raíz del proyecto.
    limpia.replace(/^[./]+/, ""),
  ];

  for (const ruta of candidatos) {
    const exacto = files.find((f) => f.path === ruta);
    if (exacto) return exacto;
  }

  // Último recurso: por nombre de archivo, que en un proyecto pequeño basta.
  const nombre = limpia.split("/").pop();
  return files.find((f) => f.path.split("/").pop() === nombre) ?? null;
}

/** Evita que el contenido cierre antes de tiempo la etiqueta que lo envuelve. */
function seguro(texto: string): string {
  return texto.replace(/<\/(script|style)/gi, "<\\/$1");
}

/**
 * ¿Puede este HTML abrirse tal cual?
 *
 * Un proyecto de React o Vue no se ejecuta en el navegador sin compilar: su
 * index.html carga un módulo que importa la librería desde node_modules, y eso
 * aquí no existe. Enseñar un recuadro gris y llamarlo vista previa es peor que
 * no ofrecerla, así que se comprueba antes.
 */
function porQueNoSeVe(html: string, files: GeneratedFile[]): string | null {
  const pendientes = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((src) => !/^(https?:)?\/\//i.test(src) && !src.startsWith("data:"));

  if (pendientes.some((src) => /\.(jsx|tsx|ts)$/i.test(src)))
    return "Este proyecto usa React o TypeScript y hay que compilarlo antes de verlo.";

  if (pendientes.length)
    return "Falta algún archivo que la página necesita para abrirse.";

  // Importaciones de paquetes: `import React from "react"` no resuelve aquí.
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const paquete = /^\s*import\s[^;]*?\sfrom\s+["'](?![./])([^"']+)["']/m;
  if (scripts.some((codigo) => paquete.test(codigo)))
    return "Este proyecto usa librerías que hay que instalar antes de verlo.";

  if (files.some((f) => /package\.json$/i.test(f.path)) && !html.trim())
    return "Este proyecto se ejecuta con Node, no en el navegador.";

  return null;
}

/** El proyecto entero en un solo HTML, listo para un iframe. */
export function buildPreview(files: GeneratedFile[]): Vista | null {
  const entrada = entryHtml(files);
  if (!entrada) return null;

  let html = entrada.content;

  // Hojas de estilo.
  html = html.replace(
    /<link\b[^>]*>/gi,
    (etiqueta) => {
      if (!/rel\s*=\s*["']?stylesheet/i.test(etiqueta)) return etiqueta;
      const href = etiqueta.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
      const archivo = href ? resolver(files, entrada.path, href) : null;
      return archivo ? `<style>\n${seguro(archivo.content)}\n</style>` : etiqueta;
    },
  );

  // Scripts.
  html = html.replace(
    /<script\b([^>]*)>\s*<\/script>/gi,
    (etiqueta, atributos: string) => {
      const src = atributos.match(/src\s*=\s*["']([^"']+)["']/i)?.[1];
      const archivo = src ? resolver(files, entrada.path, src) : null;
      if (!archivo) return etiqueta;

      const tipo = /type\s*=\s*["']module["']/i.test(atributos) ? ' type="module"' : "";
      return `<script${tipo}>\n${seguro(archivo.content)}\n</script>`;
    },
  );

  const motivo = porQueNoSeVe(html, files);

  // Sin enlaces reales detrás, que al tocarlos no parezca que se ha roto algo.
  const completo = `${html}
<script>
  document.addEventListener("click", function (e) {
    var a = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (!a) return;
    var destino = a.getAttribute("href") || "";
    if (destino.charAt(0) === "#") return;
    e.preventDefault();
  }, true);
</script>`;

  return { html: completo, funciona: motivo === null, motivo: motivo ?? undefined };
}
