// Con una foto adjunta, crear imágenes se retira salvo que se pida una nueva.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
process.env.TAVILY_API_KEY = "fake";
process.env.GOOGLE_API_KEY = "fake";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { herramientasPara } = await jiti.import(enSrc("lib/tools/registro.ts"));

const casos = [
  ["pregunta por SU foto", "De dónde son estos edificios", true, false],
  ["pregunta por su foto (2)", "¿Qué ves aquí?", true, false],
  ["pide traducirla", "Me lo traduces?", true, false],
  ["pide retocarla", "¿le cambiarías algo?", true, false],
  ["pide una imagen NUEVA con foto delante", "Créame una imagen parecida a esta", true, true],
  ["pide una imagen nueva, sin foto", "Hazme una imagen de un eclipse", false, true],
  ["conversación normal, sin foto", "Explícame los agujeros negros", false, true],
];

const fallos = [];
for (const [nombre, texto, conImagen, deberiaOfrecerse] of casos) {
  const hs = (await herramientasPara("chat", "pro", { texto, conImagen })).map((h) => h.nombre);
  const ofrece = hs.includes("crear_imagen");
  console.log(`  ${ofrece === deberiaOfrecerse ? "✓" : "✗"} ${nombre.padEnd(38)} crear_imagen: ${ofrece ? "sí" : "no"}`);
  if (ofrece !== deberiaOfrecerse) fallos.push(nombre);
  if (!hs.includes("buscar_web")) fallos.push(`${nombre}: buscar_web debería seguir estando`);
}

console.log("\n" + (fallos.length ? "FALLOS en: " + fallos.join(", ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
