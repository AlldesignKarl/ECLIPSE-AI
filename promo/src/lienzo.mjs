/**
 * Abrir el lienzo del anuncio en un navegador de verdad.
 *
 * Lo usan el grabador (`renderizar.mjs`) y el mirador (`ojear.mjs`), y está
 * aparte porque los dos necesitan exactamente lo mismo: un servidor —la escena
 * se carga con módulos y un módulo abierto desde `file://` no puede importar a
 * otro— y un Chromium configurado igual, que si no la letra no sale idéntica.
 */
import { chromium } from "playwright-core";
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function servir() {
  const s = createServer((req, res) => {
    const pedido = decodeURIComponent((req.url || "/").split("?")[0]);
    const camino = resolve(RAIZ, "." + normalize(pedido));
    if (!camino.startsWith(RAIZ)) return res.writeHead(403).end();
    try {
      if (!statSync(camino).isFile()) throw new Error("no");
    } catch {
      return res.writeHead(404).end("no está: " + pedido);
    }
    res.writeHead(200, { "Content-Type": TIPOS[extname(camino)] ?? "application/octet-stream" });
    createReadStream(camino).pipe(res);
  });
  return new Promise((ok) => s.listen(0, "127.0.0.1", () => ok({ servidor: s, puerto: s.address().port })));
}

/** Devuelve la página lista para pedirle fotogramas, y cómo cerrarlo todo. */
export async function abrirLienzo() {
  const { servidor, puerto } = await servir();
  const navegador = await chromium.launch({
    executablePath: process.env.CHROME_BIN || "/opt/pw-browsers/chromium",
    args: [
      "--force-device-scale-factor=1",
      // El suavizado de subpíxel deja flecos de color en los bordes de la letra
      // y el hinting la hace saltar un píxel de un fotograma a otro. En una
      // página no se nota; en un vídeo, sí.
      "--disable-lcd-text",
      "--font-render-hinting=none",
      "--hide-scrollbars",
    ],
  });
  const ctx = await navegador.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const pagina = await ctx.newPage();

  const fallos = [];
  pagina.on("pageerror", (e) => fallos.push(String(e)));
  // El navegador pide un favicon que no existe y lo canta como error. Es lo
  // único que se perdona: cualquier otro 404 aquí es una captura que falta, y
  // eso sí tiene que parar el render.
  pagina.on("console", (m) => {
    if (m.type() !== "error") return;
    if (m.location()?.url?.includes("favicon")) return;
    fallos.push(m.text() + " · " + (m.location()?.url ?? ""));
  });
  pagina.on("requestfailed", (r) => {
    if (!r.url().includes("favicon")) fallos.push("no se pudo cargar: " + r.url());
  });

  await pagina.goto(`http://127.0.0.1:${puerto}/src/escena.html`, { waitUntil: "load" });
  await pagina.waitForFunction("window.listo !== undefined", null, { timeout: 30000 });
  await pagina.evaluate(() => window.listo);
  if (fallos.length) throw new Error("La escena tiene errores:\n" + fallos.join("\n"));

  return {
    pagina,
    fallos,
    cerrar: async () => {
      await navegador.close();
      servidor.close();
    },
  };
}
