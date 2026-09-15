// Si el motor de turno no puede con la foto, ¿a quién se recurre?
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const probar = async (claves, deTurno) => {
  const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  process.env.ANTHROPIC_API_KEY = claves.includes("anthropic") ? "a" : "";
  process.env.GOOGLE_API_KEY = claves.includes("google") ? "g" : "";
  process.env.GEMINI_API_KEY = "";
  process.env.GROQ_API_KEY = claves.includes("groq") ? "q" : "";
  process.env.OPENROUTER_API_KEY = claves.includes("openrouter") ? "o" : "";
  process.env.MISTRAL_API_KEY = claves.includes("mistral") ? "m" : "";
  const { motoresConOjos } = await jiti.import(enSrc("lib/provider.ts"));
  return motoresConOjos(deTurno);
};

const casos = [
  [["mistral", "groq"], "mistral", ["groq"]],
  [["mistral", "groq", "google"], "mistral", ["google", "groq"]],
  [["mistral"], "mistral", []],
  [["mistral", "groq", "openrouter", "anthropic"], "mistral", ["groq", "openrouter", "anthropic"]],
];

const fallos = [];
console.log("a quién se le pasa la foto cuando el de turno no puede:");
for (const [claves, turno, esperado] of casos) {
  const r = await probar(claves, turno);
  console.log(`  con ${(claves.join("+")).padEnd(34)} (falla ${turno}) → ${r.join(", ") || "nadie"}`);
  if (r.join(",") !== esperado.join(",")) fallos.push(`${claves.join("+")}: esperaba [${esperado}] y salió [${r}]`);
}

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
