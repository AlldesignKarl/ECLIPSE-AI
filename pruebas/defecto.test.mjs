// Sin haber elegido nada en Ajustes, ¿quién responde?
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const probar = async (claves) => {
  const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  process.env.AI_PROVIDER = "";
  process.env.CODE_PROVIDER = "";
  process.env.ANTHROPIC_API_KEY = "";
  process.env.GOOGLE_API_KEY = claves.includes("google") ? "g" : "";
  process.env.GEMINI_API_KEY = "";
  process.env.GROQ_API_KEY = claves.includes("groq") ? "q" : "";
  process.env.OPENROUTER_API_KEY = claves.includes("openrouter") ? "o" : "";
  process.env.MISTRAL_API_KEY = claves.includes("mistral") ? "m" : "";
  const { activeProvider } = await jiti.import(enSrc("lib/provider.ts"));
  return activeProvider();
};

const casos = [
  [["groq", "mistral", "google"], "mistral"],
  [["groq", "google"], "groq"],
  [["mistral"], "mistral"],
  [["openrouter"], "openrouter"],
  [[], null],
];

const fallos = [];
console.log("con estas claves puestas, responde:");
for (const [claves, esperado] of casos) {
  const r = await probar(claves);
  console.log(`  ${(claves.join(" + ") || "(ninguna)").padEnd(28)} → ${r}`);
  if (r !== esperado) fallos.push(`${claves.join("+")}: esperaba ${esperado} y salió ${r}`);
}

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
