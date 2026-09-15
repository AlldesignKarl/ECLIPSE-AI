// Convertir tiene que dar EL MISMO archivo en otro formato. Se comprueba
// píxel a píxel, y en el PDF se saca la imagen de dentro y se compara.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { inflateSync } from "node:zlib";
import http from "node:http";
import { RAIZ, abrirNavegador, enSrc } from "./entorno.mjs";
const sharp = (await import(RAIZ + "node_modules/sharp/dist/index.cjs")).default;

const AQUI = new URL(".", import.meta.url).pathname;

// El módulo de verdad, compilado a JavaScript con el mismo TypeScript del
// proyecto: así se prueba el archivo tal cual está, no una copia adaptada.
const ts = (await import(RAIZ + "node_modules/typescript/lib/typescript.js")).default;
const js = ts.transpileModule(readFileSync(enSrc("lib/convertir.ts"), "utf8"), {
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
window.__convertir = async (archivo, mime, formato) => {
  const b = await (await fetch("/" + archivo)).blob();
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const r = await convertirImagen({ data: btoa(s), mime, name: archivo }, formato);
  return { nombre: r.nombre, mime: r.mime, bytes: r.bytes, b64: r.dataUrl.slice(r.dataUrl.indexOf(",") + 1) };
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

const hacer = async (archivo, mime, formato) => {
  const r = await pagina.evaluate(([a, m, f]) => window.__convertir(a, m, f), [archivo, mime, formato]);
  const bytes = Buffer.from(r.b64, "base64");
  writeFileSync(AQUI + "salida-" + formato + "-" + r.nombre, bytes);
  return { ...r, buf: bytes };
};

const original = await sharp(AQUI + "origen.png").raw().toBuffer({ resolveWithObject: true });
const difMedia = (a, b) => {
  let suma = 0;
  for (let i = 0; i < a.length; i++) suma += Math.abs(a[i] - b[i]);
  return suma / a.length;
};

const fallos = [];
console.log("desde un PNG de 640x400:\n");

for (const [formato, tope] of [["png", 0], ["webp", 2], ["jpg", 4]]) {
  const r = await hacer("origen.png", "image/png", formato);
  const { data, info } = await sharp(r.buf).raw().toBuffer({ resolveWithObject: true });
  const canales = info.channels === 4 ? 4 : 3;
  const suyo = canales === 4 ? (await sharp(r.buf).removeAlpha().raw().toBuffer()) : data;
  const mio = original.info.channels === 4 ? await sharp(AQUI + "origen.png").removeAlpha().raw().toBuffer() : original.data;
  const d = difMedia(mio, suyo);
  console.log(`  ${formato.toUpperCase().padEnd(5)} ${String(r.bytes).padStart(8)} bytes  ${info.width}x${info.height}  diferencia media por píxel: ${d.toFixed(3)}`);
  if (info.width !== 640 || info.height !== 400) fallos.push(`${formato}: ha cambiado el tamaño`);
  if (d > tope) fallos.push(`${formato}: se ve distinto (diferencia ${d.toFixed(2)}, tope ${tope})`);
}

// PDF desde PNG: se saca el flujo de dentro y se compara con el original.
const pdfPng = await hacer("origen.png", "image/png", "pdf");
const texto = pdfPng.buf.toString("latin1");
const okCabecera = texto.startsWith("%PDF-") && texto.includes("%%EOF");
const flate = texto.includes("/Filter /FlateDecode");
const i0 = pdfPng.buf.indexOf(Buffer.from("stream\n")) + 7;
const i1 = pdfPng.buf.indexOf(Buffer.from("\nendstream"), i0);
const crudo = inflateSync(pdfPng.buf.subarray(i0, i1));
const rgbOriginal = await sharp(AQUI + "origen.png").removeAlpha().raw().toBuffer();
const dPdf = crudo.length === rgbOriginal.length ? difMedia(rgbOriginal, crudo) : Infinity;
console.log(`\n  PDF   ${String(pdfPng.bytes).padStart(8)} bytes  cabecera ${okCabecera ? "ok" : "MAL"}  sin pérdida: diferencia ${dPdf}`);
if (!okCabecera) fallos.push("el PDF no tiene cabecera ni cierre válidos");
if (!flate) fallos.push("el PDF desde PNG debería ir sin pérdida");
if (dPdf !== 0) fallos.push(`el PDF desde PNG no es idéntico (diferencia ${dPdf})`);

// PDF desde JPEG: los bytes del JPEG tienen que ir tal cual.
const jpegOriginal = readFileSync(AQUI + "origen.jpg");
const pdfJpg = await hacer("origen.jpg", "image/jpeg", "pdf");
const t2 = pdfJpg.buf.toString("latin1");
const dct = t2.includes("/Filter /DCTDecode");
const metido = pdfJpg.buf.includes(jpegOriginal);
console.log(`  PDF   ${String(pdfJpg.bytes).padStart(8)} bytes desde JPEG  DCTDecode ${dct ? "sí" : "no"}  bytes del original intactos: ${metido ? "sí" : "no"}`);
if (!dct) fallos.push("un JPEG debería entrar en el PDF sin recodificar");
if (!metido) fallos.push("los bytes del JPEG original no están tal cual en el PDF");

await navegador.close();
server.close();

// Y que los abra un lector de PDF de verdad: pdf.js, el de Firefox.
const pdfjs = await import(RAIZ + "node_modules/pdfjs-dist/legacy/build/pdf.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

for (const [archivo, desde] of [["origen.png", "PNG"], ["origen.jpg", "JPEG"]]) {
  const nombre = AQUI + "salida-pdf-" + archivo.replace(/\.[^.]+$/, "") + ".pdf";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(nombre)) }).promise;
  const pagina = await doc.getPage(1);
  const vista = pagina.getViewport({ scale: 1 });
  const ops = await pagina.getOperatorList();
  const pinta = ops.fnArray.includes(pdfjs.OPS.paintImageXObject);
  console.log(`  pdf.js abre el PDF ${desde.padEnd(4)}: ${doc.numPages} página, ${vista.width}x${vista.height}, imagen dentro: ${pinta ? "sí" : "NO"}`);
  if (doc.numPages !== 1) fallos.push(`PDF ${desde}: debería tener una página`);
  if (vista.width !== 640 || vista.height !== 400) fallos.push(`PDF ${desde}: la página mide ${vista.width}x${vista.height}`);
  if (!pinta) fallos.push(`PDF ${desde}: un lector de verdad no encuentra la imagen`);
}

if (errores.length) fallos.push("errores: " + errores.join(" | "));
console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
