// Reconocer "pásamela a PDF" sin depender de que el modelo lo entienda.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { formatoPedido } = await jiti.import(enSrc("lib/convertir.ts"));

const si = [
  ["pásala a pdf", "pdf"],
  ["Pásamela a PNG porfa", "png"],
  ["conviértela a jpg", "jpg"],
  ["conviérteme esta imagen en webp", "webp"],
  ["quiero esta foto en pdf", "pdf"],
  ["guárdamela como png", "png"],
  ["me la pasas a jpeg?", "jpg"],
  ["exporta la imagen a PDF", "pdf"],
  ["ponla en formato png", "png"],
  ["transformala a webp", "webp"],
  ["la misma imagen pero en pdf", "pdf"],
  ["PÁSALA A PDF", "pdf"],
];

const no = [
  "créame una imagen de un eclipse",
  "hazme un png de una pirámide",   // crear, no convertir
  "genera una imagen en formato jpg",
  "qué ves en esta foto",
  "mejórale la luz",
  "pásame el enlace de la app",
  "hazme una web con fondo azul",
  "dime de dónde son estos rascacielos",
];

const fallos = [];
console.log("debe convertir:");
for (const [texto, esperado] of si) {
  const r = formatoPedido(texto);
  console.log(`  ${r === esperado ? "✓" : "✗"} ${texto.padEnd(38)} → ${r ?? "(nada)"}`);
  if (r !== esperado) fallos.push(`"${texto}" debería dar ${esperado} y dio ${r}`);
}
console.log("\nno debe convertir:");
for (const texto of no) {
  const r = formatoPedido(texto);
  console.log(`  ${r === null ? "✓" : "✗"} ${texto.padEnd(38)} → ${r ?? "(nada)"}`);
  if (r !== null) fallos.push(`"${texto}" no debería convertir y dio ${r}`);
}

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
