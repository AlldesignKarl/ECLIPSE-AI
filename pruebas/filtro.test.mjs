// Con una foto delante: la excusa no llega nunca, la respuesta buena sí, entera.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { crearFiltroDeNegativa } = await jiti.import(enSrc("lib/negativa.ts"));

// Los modelos escriben de tres en tres letras: se parte igual para probarlo.
const trocear = (t, n = 3) => t.match(new RegExp(`[\\s\\S]{1,${n}}`, "g")) ?? [];

function pasar(texto, { vigilar = true, herramientaEn = -1 } = {}) {
  const filtro = crearFiltroDeNegativa(vigilar);
  let visto = "";
  let excusa = false;
  const trozos = trocear(texto);
  for (let i = 0; i < trozos.length; i++) {
    if (i === herramientaEn) visto += filtro.resto();
    const { mostrar, negativa } = filtro.recibir(trozos[i]);
    if (negativa) { excusa = true; break; }
    visto += mostrar;
  }
  if (!excusa) visto += filtro.resto();
  return { visto, excusa };
}

const EXCUSAS = [
  "Lo siento, no puedo ver imágenes. ¿De qué edificios te gustaría saber su ubicación?",
  "Este motor no puede ver imágenes, pero cuéntame qué hay en ella.",
  "I'm sorry, I can't see images. Could you describe it?",
];

const BUENAS = [
  "Esta foto es de Londres: se ve el Gherkin y, al lado, la Torre 42.",
  "Ok.",
  "La foto está muy oscura y no puedo ver bien la matrícula, pero el coche es un Seat León.",
  "Aquí tienes la escena en 3D con las tres torres que salen en la imagen que me has pasado, " +
    "con las proporciones aproximadas y el suelo a la altura correcta para que no floten.",
];

const fallos = [];

console.log("excusas (no deben llegar):");
for (const t of EXCUSAS) {
  const { visto, excusa } = pasar(t);
  console.log(`  ${excusa && !visto ? "✓" : "✗"} ${JSON.stringify(t.slice(0, 45))} → visto: ${JSON.stringify(visto)}`);
  if (!excusa) fallos.push(`no la ha cazado: "${t.slice(0, 40)}"`);
  if (visto) fallos.push(`ha dejado escapar texto de la excusa: "${visto.slice(0, 40)}"`);
}

console.log("\nrespuestas buenas (deben llegar enteras):");
for (const t of BUENAS) {
  const { visto, excusa } = pasar(t);
  console.log(`  ${!excusa && visto === t ? "✓" : "✗"} ${JSON.stringify(t.slice(0, 45))}`);
  if (excusa) fallos.push(`falso positivo: "${t.slice(0, 40)}"`);
  if (visto !== t) fallos.push(`la ha recortado: "${t.slice(0, 30)}" → "${visto.slice(0, 30)}"`);
}

// Sin foto delante no se retiene nada: ni un carácter de retraso.
const sinFoto = crearFiltroDeNegativa(false);
const r = sinFoto.recibir("No puedo ver imágenes.");
if (r.mostrar !== "No puedo ver imágenes." || r.negativa)
  fallos.push("sin foto delante no debería vigilarse nada");

// Si se pone a usar una herramienta a mitad, lo retenido sale y no se pierde.
const conTool = pasar("Voy a buscarlo. ", { herramientaEn: 2 });
if (conTool.visto !== "Voy a buscarlo. ") fallos.push(`al usar herramienta se pierde texto: ${JSON.stringify(conTool.visto)}`);
if (!crearFiltroDeNegativa(true).retiene) fallos.push("debería estar reteniendo al empezar");

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
