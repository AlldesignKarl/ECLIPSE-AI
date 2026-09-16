/**
 * Las fotos de apuntes que salen en el anuncio.
 *
 * Hacen falta dos veces: se adjuntan de verdad en la caja de escribir de la
 * aplicación para grabar esa captura, y vuelan por la pantalla en la escena del
 * problema. Se dibujan aquí en lugar de buscar fotos de banco de imágenes
 * porque una foto ajena tiene dueño y este vídeo no puede tener dueños fuera.
 *
 *   node promo/src/apuntes.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const MATERIAL = resolve(AQUI, "..", "material");
const CHROME = process.env.CHROME_BIN || "/opt/pw-browsers/chromium";

/** Cada hoja: su título, sus renglones y su color de tinta. */
const HOJAS = [
  {
    archivo: "apuntes-tema4.png",
    titulo: "Tema 4 — Genética",
    tinta: "#1b3a8f",
    giro: -1.4,
    lineas: [
      "MEIOSIS",
      "· 2 divisiones seguidas, 1 sola copia del ADN",
      "· de 1 célula salen 4 con la mitad de cromosomas",
      "· entrecruzamiento → PROFASE I  ← ¡cae siempre!",
      "",
      "MITOSIS",
      "· 1 división → 2 células idénticas a la madre",
      "· sirve para crecer y reparar tejidos",
    ],
  },
  {
    archivo: "apuntes-mendel.png",
    titulo: "Leyes de Mendel",
    tinta: "#17306f",
    giro: 2.1,
    lineas: [
      "1ª — uniformidad de los híbridos",
      "2ª — segregación: los alelos se separan",
      "     al formarse los gametos",
      "3ª — transmisión independiente",
      "",
      "genotipo = los genes que tienes",
      "fenotipo = lo que se ve",
      "AaBb × AaBb → 9:3:3:1",
    ],
  },
  {
    archivo: "pizarra-clase.png",
    titulo: "Repaso rápido",
    tinta: "#2b2f6b",
    giro: -3.2,
    lineas: [
      "gen = trozo de ADN → 1 proteína",
      "cromosoma = ADN muy enrollado",
      "cariotipo humano: 46 (23 pares)",
      "",
      "MUTACIONES",
      "· génicas / cromosómicas / genómicas",
      "· no todas son malas",
      "· son materia prima de la evolución",
    ],
  },
];

const pagina = (hoja) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="fuentes/Caveat.css">
<style>
  html,body{margin:0;width:900px;height:1200px;background:#12141a;}
  .escena{width:900px;height:1200px;display:grid;place-items:center;overflow:hidden;padding:0;box-sizing:border-box;}
  .hoja{
    width:730px;height:900px;border-radius:6px;
    transform:rotate(${hoja.giro}deg);
    background:
      /* La sombra del pliegue y la luz de la ventana: sin esto es un rectángulo blanco, no una foto */
      linear-gradient(105deg, rgba(0,0,0,.20) 0%, rgba(0,0,0,0) 22%, rgba(255,255,255,.10) 55%, rgba(0,0,0,.16) 100%),
      repeating-linear-gradient(to bottom, rgba(120,140,180,.20) 0 1px, transparent 1px 34px),
      repeating-linear-gradient(to right, rgba(120,140,180,.13) 0 1px, transparent 1px 34px),
      linear-gradient(180deg,#f4f1e8,#e9e5d8);
    box-shadow:0 40px 90px -30px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.06);
    padding:52px 50px;box-sizing:border-box;position:relative;
  }
  /* El margen rojo del cuaderno */
  .hoja::before{content:"";position:absolute;left:96px;top:0;bottom:0;width:2px;background:rgba(200,80,80,.35);}
  h1{font-family:Caveat,cursive;font-size:50px;margin:0 0 26px;color:${hoja.tinta};letter-spacing:.5px;}
  p{font-family:Caveat,cursive;font-size:34px;line-height:32px;margin:0 0 18px;color:${hoja.tinta};opacity:.92;}
  .velo{position:absolute;inset:0;background:radial-gradient(70% 60% at 40% 30%, rgba(255,255,255,.12), transparent 70%);pointer-events:none;}
</style></head>
<body><div class="escena"><div class="hoja">
  <h1>${hoja.titulo}</h1>
  ${hoja.lineas.map((l) => `<p>${l || "&nbsp;"}</p>`).join("")}
  <div class="velo"></div>
</div></div></body></html>`;

const main = async () => {
  mkdirSync(MATERIAL, { recursive: true });
  const navegador = await chromium.launch({ executablePath: CHROME });
  const ctx = await navegador.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  for (const hoja of HOJAS) {
    // Se escribe a disco en vez de inyectar el HTML: así el `href` relativo a
    // `fuentes/` resuelve y la letra manuscrita es la de verdad.
    const temporal = resolve(AQUI, ".hoja-temporal.html");
    writeFileSync(temporal, pagina(hoja), "utf8");
    await p.goto(pathToFileURL(temporal).href, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: resolve(MATERIAL, hoja.archivo) });
    console.log("·", hoja.archivo);
  }
  rmSync(resolve(AQUI, ".hoja-temporal.html"), { force: true });
  await navegador.close();
};

main();
