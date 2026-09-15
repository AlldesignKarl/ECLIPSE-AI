// La ruta repetida dentro del bloque no debe acabar pintada en la página.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { extractFiles } = await jiti.import(enSrc("lib/project.ts"));

const casos = [
  ["la repite tal cual", "```html index.html\nindex.html\n<!doctype html>\n<h1>Hola</h1>\n```"],
  ["repite la cabecera entera", "```html index.html\nhtml index.html\n<!doctype html>\n<h1>Hola</h1>\n```"],
  ["solo el lenguaje", "```html index.html\nhtml\n<!doctype html>\n<h1>Hola</h1>\n```"],
  ["la repite comentada", "```html index.html\n<!-- index.html -->\n<!doctype html>\n<h1>Hola</h1>\n```"],
  ["con ruta larga", "```js src/app.js\n// src/app.js\nconsole.log(1);\n```"],
  ["sin repetirla", "```html index.html\n<!doctype html>\n<h1>Hola</h1>\n```"],
  ["primera línea legítima", "```js notas.js\nindexado(2);\nmas();\n```"],
  ["un CSS que empieza por html", "```css estilos.css\nhtml { margin: 0 }\nbody { color: red }\n```"],
  ["una etiqueta html suelta", "```html pagina.html\n<html>\n<body>hola</body>\n```"],
];

const fallos = [];
for (const [nombre, texto] of casos) {
  const [f] = extractFiles(texto);
  const primera = f.content.split("\n")[0];
  console.log(`${nombre.padEnd(24)} ${f.path.padEnd(12)} empieza por: ${JSON.stringify(primera)}`);
  if (/^(index\.html|html index\.html|html|<!-- index\.html -->|\/\/ src\/app\.js)$/.test(primera))
    fallos.push(`${nombre}: la cabecera sigue dentro del archivo`);
}

const css = extractFiles(casos.find((c) => c[0].includes("CSS"))[1])[0].content;
if (!css.startsWith("html { margin: 0 }")) fallos.push("ha borrado la primera regla de un CSS");
const etiqueta = extractFiles(casos.find((c) => c[0].includes("etiqueta"))[1])[0].content;
if (!etiqueta.startsWith("<html>")) fallos.push("ha borrado una etiqueta html de verdad");

const legitimo = extractFiles(casos.find((c) => c[0].includes("legítima"))[1])[0].content;
if (!legitimo.startsWith("indexado(2);")) fallos.push("ha borrado una línea que era del programa");
const intacto = extractFiles(casos.find((c) => c[0].includes("Sin repetirla") || c[0].includes("sin repetirla"))[1])[0].content;
if (!intacto.startsWith("<!doctype html>")) fallos.push("ha tocado un archivo que estaba bien");

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
