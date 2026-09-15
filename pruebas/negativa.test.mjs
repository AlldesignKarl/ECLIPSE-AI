// Distinguir "no puedo ver imágenes" de una observación sobre la foto.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { esNegativaDeVista } = await jiti.import(enSrc("lib/negativa.ts"));

const esNegativa = [
  "Lo siento, no puedo ver imágenes. ¿De qué edificios te gustaría saber su ubicación?",
  "Lo siento, no puedo ver las imágenes adjuntas.",
  "No puedo ver la imagen que has adjuntado.",
  "Este motor no puede ver imágenes. En Ajustes puedes cambiar el motor.",
  "No tengo acceso a la imagen que mencionas.",
  "No veo ninguna imagen adjunta en tu mensaje.",
  "No se ha adjuntado ninguna imagen a la conversación.",
  "I'm sorry, I can't see images.",
  "I am unable to view the attached photo.",
  "No soy capaz de ver imágenes, pero puedo ayudarte si me la describes.",
  "No puedo analizar la imagen adjunta.",
];

const noLoEs = [
  "Esta foto es de Londres. Muestra el distrito financiero de la City.",
  "En la imagen se ven las Cuatro Torres de Madrid.",
  "La foto está muy oscura y no puedo ver bien la matrícula del coche.",
  "Se ve un cartel, aunque no puedo leer la letra pequeña de la esquina.",
  "Aquí tienes la imagen que me has pedido.",
  "No puedo crear vídeos, pero sí una animación en código.",
  "La calidad es baja, así que no distingo las caras del fondo.",
  "Puedo ver tres edificios: uno curvo, uno estrecho y una torre clásica.",
];

const fallos = [];
console.log("lo es:");
for (const t of esNegativa) {
  const r = esNegativaDeVista(t);
  console.log(`  ${r ? "✓" : "✗"} ${t.slice(0, 60)}`);
  if (!r) fallos.push(`no detectada: "${t.slice(0, 50)}"`);
}
console.log("\nno lo es:");
for (const t of noLoEs) {
  const r = esNegativaDeVista(t);
  console.log(`  ${!r ? "✓" : "✗"} ${t.slice(0, 60)}`);
  if (r) fallos.push(`falso positivo: "${t.slice(0, 50)}"`);
}

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
