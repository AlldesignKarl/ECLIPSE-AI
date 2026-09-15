// Qué se conserva de la conversación al volver a mandarla.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { aligerarHistorial } = await jiti.import(enSrc("lib/project.ts"));

const conCodigo = (n) => `Versión ${n}.\n\n\`\`\`html index.html\n<h1>v${n}</h1>\n\`\`\``;
const historia = [];
for (let i = 1; i <= 5; i++) {
  historia.push({ role: "user", content: `cámbiame la ${i}` });
  historia.push({ role: "assistant", content: conCodigo(i) });
}
historia.push({ role: "user", content: "ahora ponlo en azul" });

const ligero = aligerarHistorial(historia);
const conservados = ligero.filter((m) => m.content.includes("```")).map((m) => m.content.match(/v(\d)/)[1]);
const omitidos = ligero.filter((m) => m.content.includes("omitido")).length;

console.log("versiones con su código entero:", conservados.join(", "));
console.log("versiones resumidas:", omitidos);

const fallos = [];
if (conservados.join(",") !== "4,5") fallos.push(`deberían quedar la 4 y la 5, quedaron ${conservados.join(",")}`);
if (omitidos !== 3) fallos.push(`deberían resumirse 3 y se resumieron ${omitidos}`);
if (ligero.length !== historia.length) fallos.push("no se puede perder ningún mensaje");
if (ligero.filter((m) => m.role === "user").some((m, i) => m.content !== historia.filter((x) => x.role === "user")[i].content))
  fallos.push("los mensajes del usuario no se tocan");

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
