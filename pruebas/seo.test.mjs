// La auditoría SEO contra páginas de verdad: una bien hecha, una desastrosa y
// una con un noindex puesto sin querer, que es el fallo que más dinero cuesta
// y el que menos se ve.
import { createServer } from "node:http";
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { herramientaSeo } = await jiti.import(enSrc("lib/tools/seo.ts"));

const BUENA = `<!doctype html><html lang="es"><head>
<title>Velas de soja artesanales | Eclipse Velas</title>
<meta name="description" content="Velas de soja hechas a mano en Zaragoza, con 40 horas de duración y aceites esenciales naturales. Envío en 24 horas a toda España.">
<link rel="canonical" href="https://ejemplo.com/velas">
<meta property="og:title" content="Velas de soja artesanales">
<meta property="og:image" content="https://ejemplo.com/vela.jpg">
<script type="application/ld+json">{"@type":"Product"}</script>
</head><body>
<h1>Velas de soja artesanales</h1>
<h2>Cómo las hacemos</h2><h2>Envíos</h2>
<img src="a.jpg" alt="Vela encendida sobre una mesa de madera">
<p>${"Palabra ".repeat(300)}</p>
</body></html>`;

const MALA = `<!doctype html><html><head></head><body>
<h1>Bienvenidos</h1><h1>A nuestra tienda</h1>
<img src="a.jpg"><img src="b.jpg"><img src="c.jpg" alt="ok">
<p>Hola.</p></body></html>`;

const NOINDEX = `<!doctype html><html lang="es"><head>
<title>Tienda online de velas artesanales en Zaragoza</title>
<meta name="description" content="Velas de soja artesanales hechas a mano con aceites esenciales. Envío rápido a toda España desde nuestro taller de Zaragoza.">
<meta name="robots" content="noindex, nofollow">
</head><body><h1>Tienda</h1><p>${"Texto ".repeat(300)}</p></body></html>`;

const paginas = { "/buena": BUENA, "/mala": MALA, "/noindex": NOINDEX };
let conRobots = true;

const s = createServer((req, res) => {
  const u = new URL(req.url, "http://x").pathname;
  if (u === "/robots.txt") {
    if (!conRobots) { res.writeHead(404); return res.end("no"); }
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("User-agent: *\nAllow: /\nSitemap: /sitemap.xml");
  }
  if (u === "/sitemap.xml") {
    res.writeHead(200, { "content-type": "application/xml" });
    return res.end('<?xml version="1.0"?><urlset><url><loc>http://x/a</loc></url><url><loc>http://x/b</loc></url></urlset>');
  }
  if (u === "/rota") { res.writeHead(500); return res.end("boom"); }
  const p = paginas[u];
  if (!p) { res.writeHead(404); return res.end("no"); }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(p);
});
await new Promise((r) => s.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${s.address().port}`;

const fallos = [];
const ok = (cond, que) => {
  console.log(`  ${cond ? "✓" : "✗"} ${que}`);
  if (!cond) fallos.push(que);
};
const auditar = (camino) => herramientaSeo.ejecutar({ url: `${base}${camino}` }, { plan: "pro" });

console.log("\nUna página bien hecha");
const buena = (await auditar("/buena")).texto;
ok(/✅ Título \(\d+\)/.test(buena), "el título se da por bueno");
ok(/✅ Descripción \(\d+\)/.test(buena), "la descripción también");
ok(/✅ Un solo H1/.test(buena), "un solo H1");
ok(/✅ 2 subtítulo/.test(buena), "cuenta los H2");
ok(/✅ Las 1 imágenes tienen texto alternativo/.test(buena), "las imágenes tienen alt");
ok(/✅ Canónica/.test(buena), "detecta la canónica");
ok(/✅ Idioma declarado: es/.test(buena), "y el idioma");
ok(/✅ Tarjeta para redes sociales.*con imagen/s.test(buena), "detecta el Open Graph con imagen");
ok(/✅ Tiene datos estructurados/.test(buena), "y los datos estructurados");
ok(/✅ robots\.txt correcto/.test(buena), "lee el robots.txt");
ok(/✅ Sitemap con 2 dirección/.test(buena), "y cuenta las URLs del sitemap");
ok(!/❌/.test(buena), "no inventa problemas donde no los hay");

console.log("\nUna página desastrosa");
const mala = (await auditar("/mala")).texto;
ok(/❌ Título: NO HAY/.test(mala), "canta que no hay título");
ok(/❌ Descripción: NO HAY/.test(mala), "ni descripción");
ok(/⚠️ Hay 2 H1/.test(mala), "y que hay dos H1");
ok(/⚠️ 2 de 3 imágenes sin texto alternativo/.test(mala), "cuenta bien las imágenes sin alt");
ok(/⚠️ Sin etiqueta canónica/.test(mala), "avisa de la canónica");
ok(/no dice en qué idioma/.test(mala), "y del idioma sin declarar");
ok(/⚠️ Sin datos Open Graph/.test(mala), "y de que al compartirla sale pelada");
ok(/palabras de texto visible \(poco/.test(mala), "y de que casi no tiene texto");

console.log("\nUn noindex puesto sin querer");
const noindex = (await auditar("/noindex")).texto;
ok(/❌ La página lleva «noindex»/.test(noindex), "lo detecta");
ok(/el fallo más grave/.test(noindex), "y dice lo gordo que es");

console.log("\nCuando algo no va");
const rota = await auditar("/rota");
ok(/error 500/.test(rota.error ?? ""), "una página rota se cuenta como error, no como auditoría");
ok(/Google tampoco puede leerla/.test(rota.error ?? ""), "y se explica por qué importa");
const inventada = await herramientaSeo.ejecutar({ url: "no es una url" }, { plan: "pro" });
ok(Boolean(inventada.error), "una dirección inventada se rechaza");
const vacia = await herramientaSeo.ejecutar({}, { plan: "pro" });
ok(/Falta la dirección/.test(vacia.error ?? ""), "y sin dirección, se pide");

console.log("\nSin robots.txt");
conRobots = false;
const sinRobots = (await auditar("/buena")).texto;
ok(/⚠️ No hay robots\.txt/.test(sinRobots), "se nota su ausencia");

// Una dirección sin https:// delante es lo que escribe todo el mundo.
const sinEsquema = await herramientaSeo.ejecutar({ url: `127.0.0.1:${s.address().port}/buena` }, { plan: "pro" });
ok(Boolean(sinEsquema.texto || sinEsquema.error), "una dirección sin https:// no revienta");

ok(herramientaSeo.soloPro === true, "la auditoría es del plan Pro");

s.close();
console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
