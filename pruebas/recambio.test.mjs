// Si al motor de turno se le acaba el cupo, ¿hay recambio?
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const probar = async (claves, agotado) => {
  const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  process.env.ANTHROPIC_API_KEY = claves.includes("anthropic") ? "a" : "";
  process.env.GOOGLE_API_KEY = claves.includes("google") ? "g" : "";
  process.env.GEMINI_API_KEY = "";
  process.env.GROQ_API_KEY = claves.includes("groq") ? "q" : "";
  process.env.OPENROUTER_API_KEY = claves.includes("openrouter") ? "o" : "";
  process.env.MISTRAL_API_KEY = claves.includes("mistral") ? "m" : "";
  const { siguienteMotor } = await jiti.import(enSrc("lib/provider.ts"));
  return siguienteMotor(agotado);
};

const casos = [
  [["mistral", "groq", "google"], "mistral", "groq"],
  [["mistral", "google"], "mistral", "google"],
  [["mistral"], "mistral", null],
  [["mistral", "anthropic"], "mistral", "anthropic"],
  [["groq", "mistral"], "groq", "mistral"],
  [[], "groq", null],
];

const fallos = [];
console.log("se agota un motor y hay que seguir:");
for (const [claves, agotado, esperado] of casos) {
  const r = await probar(claves, agotado);
  console.log(`  claves ${(claves.join("+") || "ninguna").padEnd(26)} se agota ${String(agotado).padEnd(10)} → ${r}`);
  if (r !== esperado) fallos.push(`${claves.join("+")} / ${agotado}: esperaba ${esperado} y salió ${r}`);
}

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
