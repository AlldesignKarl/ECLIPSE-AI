// Una foto de móvil de verdad, pasada por lo que hace el navegador al
// adjuntarla: se encoge para que quepa, y un PNG sigue siendo un PNG.
import { readFileSync, existsSync } from "node:fs";
import http from "node:http";
import { RAIZ, abrirNavegador, enSrc } from "./entorno.mjs";
const sharp = (await import(RAIZ + "node_modules/sharp/dist/index.cjs")).default;

const AQUI = new URL(".", import.meta.url).pathname;

/*
  La foto de móvil, hecha aquí y no guardada en el repositorio.

  Hacía falta una de verdad —diez megas, como la que sale de cualquier
  teléfono— para comprobar que se encoge antes de mandarla. Meter diez megas en
  el control de versiones para siempre, por una prueba, no compensa: se fabrica
  la primera vez y se queda en disco, ignorada por git.

  Ruido y no un degradado, a propósito: un degradado se comprime a nada y el
  archivo saldría de doscientos kilobytes, con lo que la prueba pasaría sin
  probar nada.
*/
const FOTO_GRANDE = AQUI + "foto-movil.jpg";
if (!existsSync(FOTO_GRANDE)) {
  // Sobre diez megas, que es lo que pesa una foto de móvil de verdad.
  const ancho = 2400;
  const alto = 1800;
  const pixeles = Buffer.allocUnsafe(ancho * alto * 3);
  // Ruido con una semilla fija: la misma foto en cada ordenador.
  let semilla = 12345;
  for (let i = 0; i < pixeles.length; i++) {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
    pixeles[i] = semilla >>> 23;
  }
  await sharp(pixeles, { raw: { width: ancho, height: alto, channels: 3 } })
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toFile(FOTO_GRANDE);
  const megas = (readFileSync(FOTO_GRANDE).length / 1024 / 1024).toFixed(1);
  console.log(`  (fabricada foto-movil.jpg, ${megas} MB)`);
}

// El archivo de verdad, compilado con el TypeScript del proyecto: así se
// prueba lo que hay, no una copia adaptada que se queda vieja.
const ts = (await import(RAIZ + "node_modules/typescript/lib/typescript.js")).default;
const fuente = readFileSync(enSrc("lib/files.ts"), "utf8")
  // Solo interesa `encoger`: lo demás arrastra imports que no existen aquí.
  .replace(/^import[\s\S]*?;$/gm, "")
  .replace(/^export /gm, "");
const js = ts.transpileModule(fuente, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;

let puerto = 0;
const server = http.createServer((req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  if (p !== "/") {
    const f = AQUI + p.slice(1);
    if (existsSync(f)) { res.writeHead(200); return res.end(readFileSync(f)); }
    res.writeHead(404); return res.end("no");
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><meta charset="utf-8"><script type="module">
${js}
window.__encoger = async (archivo, mime) => {
  const blob = await (await fetch("/" + archivo)).blob();
  const file = new File([blob], archivo, { type: mime });
  const t0 = performance.now();
  const r = await encoger(file);
  return r ? { original: file.size, final: r.size, mime: r.mime, ms: Math.round(performance.now() - t0), data: r.data } : null;
};
</script>`);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
puerto = server.address().port;

const navegador = await abrirNavegador();
const pagina = await navegador.newPage();
const errores = [];
pagina.on("pageerror", (e) => errores.push(String(e)));
await pagina.goto(`http://127.0.0.1:${puerto}/`);

const probar = async (archivo, mime) =>
  pagina.evaluate(([a, m]) => window.__encoger(a, m), [archivo, mime]);

const foto = await probar("foto-movil.jpg", "image/jpeg");
const captura = await probar("captura-grande.png", "image/png");

await navegador.close();
server.close();

const fallos = [];
if (errores.length) fallos.push("errores: " + errores.join(" | "));

if (!foto) fallos.push("una foto de 9,7 MB debería encogerse");
else {
  const meta = await sharp(Buffer.from(foto.data, "base64")).metadata();
  console.log(`foto de móvil:  ${(foto.original / 1024 / 1024).toFixed(1)} MB → ${(foto.final / 1024).toFixed(0)} KB  ${meta.format} ${meta.width}x${meta.height}  (${foto.ms} ms)`);
  if (foto.final >= 3 * 1024 * 1024) fallos.push("la foto sigue pasando de 3 MB");
  if (meta.format !== "jpeg") fallos.push("una foto debería salir en JPEG");
  if (Math.max(meta.width, meta.height) !== 1568) fallos.push(`el lado largo debería ser 1568 y es ${Math.max(meta.width, meta.height)}`);
  if (foto.ms > 4000) fallos.push(`tarda demasiado (${foto.ms} ms)`);
}

// Una captura pequeña no se toca: encoger devuelve null y se manda tal cual.
if (captura) {
  const meta = await sharp(Buffer.from(captura.data, "base64")).metadata();
  console.log(`captura PNG:    ${(captura.original / 1024).toFixed(0)} KB → ${(captura.final / 1024).toFixed(0)} KB  ${meta.format}`);
  if (meta.format !== "png") fallos.push("una captura PNG no puede acabar en JPEG: se emborronan las letras");
} else {
  console.log("captura PNG:    se manda tal cual, sin tocarla");
}

console.log("\n" + (fallos.length ? "MAL:\n- " + fallos.join("\n- ") : "BIEN"));
process.exit(fallos.length ? 1 : 0);
