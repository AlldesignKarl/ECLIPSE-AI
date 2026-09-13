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
 * Librerías que un navegador puede traerse solo.
 *
 * Cuando el modelo escribe `import * as THREE from "three"` no está haciendo
 * nada raro: es como se escribe hoy en día. Lo que pasa es que ese nombre a
 * secas solo lo entiende un empaquetador, y en un navegador da el error de
 * "no se puede resolver el módulo three".
 *
 * Un mapa de importaciones es justo la pieza que falta: le dice al navegador
 * que "three" significa esta dirección. Con él, el código idiomático funciona
 * tal cual está escrito, sin instalar nada y sin pedirle al modelo que escriba
 * de una forma rara.
 *
 * Las versiones van fijas a propósito: "la última" cambia sin avisar y rompe
 * páginas que funcionaban.
 */
const LIBRERIAS: Record<string, string> = {
  three: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "three/": "https://cdn.jsdelivr.net/npm/three@0.160.0/",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/",
  "three/examples/jsm/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/",
  gsap: "https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js",
  "lil-gui": "https://cdn.jsdelivr.net/npm/lil-gui@0.19.2/dist/lil-gui.esm.js",
  "cannon-es": "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js",
  "matter-js": "https://cdn.jsdelivr.net/npm/matter-js@0.19.0/build/matter.min.js",
  d3: "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm",
  "chart.js": "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/+esm",
  "chart.js/auto": "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/auto/+esm",
  tone: "https://cdn.jsdelivr.net/npm/tone@14.7.77/build/esm/index.js",
};

/** ¿Sabemos de dónde sacar esta librería sin instalar nada? */
function resoluble(nombre: string): boolean {
  return Object.keys(LIBRERIAS).some((clave) =>
    clave.endsWith("/") ? nombre.startsWith(clave) : nombre === clave,
  );
}

/**
 * El mapa va antes que cualquier módulo: el navegador lo lee una sola vez y
 * al empezar. Puesto después, ya se ha intentado resolver la importación y ha
 * fallado.
 */
function mapaDeImportaciones(): string {
  return `<script type="importmap">${JSON.stringify({ imports: LIBRERIAS })}<\/script>`;
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
  const sinResolver = scripts
    .flatMap((codigo) => [...codigo.matchAll(/from\s+["'](?![./]|https?:|data:)([^"']+)["']/g)])
    .map((m) => m[1])
    .filter((nombre) => !resoluble(nombre));

  if (sinResolver.length)
    return `Este proyecto usa ${sinResolver[0]}, que hay que instalar antes de verlo.`;

  if (scripts.some((codigo) => paquete.test(codigo)) && sinResolver.length)
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
    El vigilante de errores va ANTES que nada, no al final.

    Puesto al final, cuando se ejecuta ya han pasado los errores que tenía que
    recoger: el <script> de la librería externa falló hace rato y no había
    nadie escuchando. Arriba lo oye todo desde la primera línea.

    Y hace falta, porque una vista previa que falla se queda en un rectángulo
    negro, y un rectángulo negro no dice si el código está mal, si falta una
    librería o si la página tarda. Lo más habitual con diferencia es lo
    segundo: Three.js y compañía no llegan a descargarse, la variable se queda
    sin definir y el código revienta en su primera línea.
  */
  const vigilante = `<script>
(function () {
  var avisado = false;
  function avisar(titulo, detalle) {
    if (avisado) return;
    avisado = true;
    function pintar() {
      var caja = document.createElement("div");
      caja.setAttribute("style",
        "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;" +
        "background:#1a1014;border:1px solid #6b2230;border-radius:12px;padding:12px 14px;" +
        "font:13px/1.5 system-ui,sans-serif;color:#ffd9df;box-shadow:0 10px 40px rgba(0,0,0,.6)");
      var t = document.createElement("strong");
      t.textContent = titulo;
      t.setAttribute("style", "display:block;margin-bottom:4px;color:#ff9aa8");
      var d = document.createElement("span");
      d.textContent = detalle;
      d.setAttribute("style", "opacity:.85;word-break:break-word");
      caja.appendChild(t);
      caja.appendChild(d);
      document.body.appendChild(caja);
    }
    if (document.body) pintar();
    else document.addEventListener("DOMContentLoaded", pintar);
  }

  window.addEventListener("error", function (e) {
    var el = e.target;
    if (el && el !== window && (el.tagName === "SCRIPT" || el.tagName === "LINK")) {
      var url = el.src || el.href || "";
      return avisar(
        "No se ha podido cargar una libreria externa",
        url + " — sin ella el codigo no puede arrancar. Pidele a ECLIPSE que use otra direccion o que lo haga sin esa libreria."
      );
    }
    avisar("El codigo ha dado un error", (e.message || "error desconocido") + (e.lineno ? " (linea " + e.lineno + ")" : ""));
  }, true);

  window.addEventListener("unhandledrejection", function (e) {
    avisar("El codigo ha dado un error", String((e.reason && e.reason.message) || e.reason || ""));
  });

  window.__eclipseAvisar = avisar;
  window.__eclipseAvisado = function () { return avisado; };
})();
<\/script>`;

  // El mapa primero, y el vigilante justo detrás: los dos antes que nada.
  const cabecera = mapaDeImportaciones() + vigilante;
  const conVigilante = /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (etiqueta) => etiqueta + cabecera)
    : cabecera + html;

  /*
    Navegación dentro de la vista previa.

    La página se pinta con `srcdoc`, y ahí las direcciones relativas se
    resuelven contra la dirección del documento de arriba, no contra la vista
    previa. Así que un `href="#contacto"` no bajaba a la sección: cargaba
    eclipse-ia.vercel.app dentro del recuadro, y parecía que la página hecha
    llevaba a ECLIPSE. Por eso los anclajes se resuelven aquí a mano.
  */
  const completo = `${conVigilante}
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
      Red de seguridad contra la trampa más habitual de las apariciones: el
      contenido se pone en opacity 0 y se enciende con una animación, y en un
      móvil con las animaciones desactivadas —viene puesto de fábrica en
      muchos— nunca se enciende.

      La señal no puede ser "tiene animación": al desactivarlas, el propio CSS
      escribe animation: none y el rastro desaparece justo en el caso que hay
      que arreglar. Se usa dónde está el elemento: lo que va en el flujo normal
      y lleva texto es contenido, y el contenido no se esconde a propósito. Un
      menú desplegable va colocado por encima, y ese no se toca.
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

    /** Ni error ni contenido: eso también hay que contarlo. */
    function avisarSiEstaVacia() {
      if (!document.body) return;
      if (window.__eclipseAvisado && window.__eclipseAvisado()) return;
      if (document.body.innerText.trim().length > 0) return;
      if (document.querySelector("canvas, img, svg, video")) return;
      if (window.__eclipseAvisar)
        window.__eclipseAvisar(
          "La pagina no ha pintado nada",
          "El codigo se ha ejecutado pero no ha dibujado nada visible. Pidele a ECLIPSE que lo revise."
        );
    }

    window.addEventListener("load", function () {
      setTimeout(rescatarInvisibles, 400);
      setTimeout(rescatarInvisibles, 1600);
      setTimeout(avisarSiEstaVacia, 3000);
    });
  })();
</script>`;

  return { html: completo, funciona: motivo === null, motivo: motivo ?? undefined };
}
