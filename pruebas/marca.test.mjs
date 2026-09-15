// La marca de conversión se lee bien y no se confunde con la de retoque.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { leerConversion, leerRetoque } = await jiti.import(enSrc("lib/project.ts"));
const { leerFormato } = await jiti.import(enSrc("lib/convertir.ts"));

const casos = [
  ["Aquí la tienes en PDF.\n\n[CONVERTIR: pdf]", "Aquí la tienes en PDF.", "pdf"],
  ["Te la paso a PNG.\n[CONVERTIR:PNG]", "Te la paso a PNG.", "png"],
  ["Te la dejo en JPG.\n\n[ CONVERTIR : jpeg ]", "Te la dejo en JPG.", "jpeg"],
  ["Está muy bien como está.", "Está muy bien como está.", undefined],
];

const fallos = [];
for (const [entrada, esperadoLimpio, esperadoFormato] of casos) {
  const { limpio, formato } = leerConversion(entrada);
  console.log(`${JSON.stringify(limpio).padEnd(30)} → ${formato ?? "(nada)"}`);
  if (limpio !== esperadoLimpio) fallos.push(`la marca debería salir del texto: ${JSON.stringify(limpio)}`);
  if (formato !== esperadoFormato) fallos.push(`esperaba ${esperadoFormato} y salió ${formato}`);
}

// Los alias del formato.
for (const [escrito, esperado] of [["jpeg", "jpg"], ["JPG", "jpg"], [".png", "png"], ["webp", "webp"], ["pdf", "pdf"], ["svg", null], ["docx", null]])
  if (leerFormato(escrito) !== esperado) fallos.push(`leerFormato("${escrito}") = ${leerFormato(escrito)}`);

// Y que retoque y conversión puedan convivir en la misma respuesta.
const dos = "Le subo la luz y te la paso a PDF.\n\n[EDITAR: brighter, warmer light]\n\n[CONVERTIR: pdf]";
const c = leerConversion(dos);
const r = leerRetoque(c.limpio);
console.log(`\nlas dos juntas → formato=${c.formato}, encargo=${JSON.stringify(r.encargo)}`);
if (c.formato !== "pdf") fallos.push("no ha leído la conversión cuando van las dos");
if (!r.encargo?.includes("brighter")) fallos.push("no ha leído el retoque cuando van las dos");
if (r.limpio !== "Le subo la luz y te la paso a PDF.") fallos.push("el texto visible ha quedado sucio");

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
