// El botón de "arréglalo" tiene que mandar el trozo de código donde está el
// error, no solo el número de línea.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });

const { trozoDelError } = await jiti.import(enSrc("lib/project.ts"));

const archivo = {
  path: "index.html",
  content: Array.from({ length: 20 }, (_, i) => `linea ${i + 1}`).join("\n"),
};

const conLinea = trozoDelError([archivo], "Uncaught SyntaxError: missing ) (linea 12)");
const sinLinea = trozoDelError([archivo], "Algo ha fallado");
const fueraDeRango = trozoDelError([archivo], "error (linea 400)");

console.log(conLinea);
const fallos = [];
if (!conLinea.includes("linea 12")) fallos.push("no incluye la línea del error");
if (!conLinea.includes("12 >>")) fallos.push("no marca cuál es la línea del error");
if (!conLinea.includes("linea 9") || !conLinea.includes("linea 15"))
  fallos.push("no incluye las líneas de alrededor");
if (sinLinea !== "") fallos.push("sin número de línea no debería inventarse nada");
if (fueraDeRango !== "") fallos.push("una línea que no existe no debería devolver nada");

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
