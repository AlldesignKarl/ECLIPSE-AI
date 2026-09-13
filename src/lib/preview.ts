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

  /*
    Importaciones de paquetes: `import React from "react"` no resuelve aquí.

    Pero `import * as THREE from "https://cdn…/three.module.js"` SÍ resuelve: es
    una dirección completa y el navegador la descarga igual que cualquier
    script. Sin esta distinción, una escena 3D perfectamente visible se
    rechazaba por parecerse a un proyecto sin compilar.
  */
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const paquete = /^\s*import\s[^;]*?\sfrom\s+["'](?![./]|https?:|data:)([^"']+)["']/m;
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

  /*
    Navegación dentro de la vista previa.

    La página se pinta con `srcdoc`, y ahí las direcciones relativas se
    resuelven contra la dirección del documento de arriba, no contra la vista
    previa. Así que un `href="#contacto"` no bajaba a la sección: cargaba
    eclipse-ia.vercel.app dentro del recuadro, y parecía que la página hecha
    llevaba a ECLIPSE. Por eso los anclajes se resuelven aquí a mano, buscando
    el destino y desplazándose hasta él.

    Lo demás se queda quieto: no hay servidor detrás que sirva otra página, y
    al pulsarlo parecería que algo se ha roto.
  */
  const completo = `${html}
<script>
  (function () {
    function irA(destino) {
      if (destino === "#" || destino === "") return window.scrollTo({ top: 0, behavior: "smooth" });
      var id = decodeURIComponent(destino.slice(1));
      var objetivo = document.getElementById(id) || document.getElementsByName(id)[0];
      if (objetivo && objetivo.scrollIntoView) objetivo.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    document.addEventListener("click", function (e) {
      var a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!a) return;
      var destino = a.getAttribute("href") || "";
      e.preventDefault();
      if (destino.charAt(0) === "#") irA(destino);
    }, true);

    // Un formulario sin servidor detrás haría lo mismo que los anclajes: irse
    // a la dirección de arriba y cargar ECLIPSE dentro del recuadro.
    document.addEventListener("submit", function (e) { e.preventDefault(); }, true);

    /*
      Red de seguridad contra la trampa más habitual de las apariciones.

      El patrón de "aparecer al bajar" se escribe poniendo el elemento en
      opacity: 0 y encendiéndolo con una animación. Cuando el móvil lleva las
      animaciones desactivadas —viene puesto de fábrica en muchos para ahorrar
      batería— la animación no corre y el contenido se queda invisible: se ve
      un rectángulo de color enorme y vacío.

      La señal no puede ser "tiene animación": cuando se desactivan, el propio
      CSS suele escribir animation: none, así que el rastro desaparece
      justo en el caso que hay que arreglar. Se usa dónde está el elemento:
      lo que va en el flujo normal de la página y lleva texto dentro es
      contenido, y el contenido no se esconde a propósito. Un menú
      desplegable, en cambio, va colocado por encima —fixed o absolute— y ese
      no se toca: si está oculto, es porque tiene que estarlo.
    */
    function rescatarInvisibles() {
      var todos = document.body ? document.body.querySelectorAll("*") : [];
      for (var i = 0; i < todos.length; i++) {
        var el = todos[i];
        var estilo = getComputedStyle(el);
        if (estilo.opacity !== "0") continue;

        var colocado = estilo.position === "fixed" || estilo.position === "absolute";
        var conAnimacion = estilo.animationName !== "none";
        var conTexto = (el.textContent || "").trim().length > 0;
        if (colocado && !conAnimacion) continue;
        if (!conAnimacion && !conTexto) continue;
        if (!el.getBoundingClientRect().height) continue;

        el.style.setProperty("opacity", "1", "important");
        el.style.setProperty("transform", "none", "important");
      }
    }
    // Una al asentarse la página y otra por si algo tardaba en pintarse.
    window.addEventListener("load", function () {
      setTimeout(rescatarInvisibles, 400);
      setTimeout(rescatarInvisibles, 1600);
    });
  })();
</script>`;

  return { html: completo, funciona: motivo === null, motivo: motivo ?? undefined };
}
