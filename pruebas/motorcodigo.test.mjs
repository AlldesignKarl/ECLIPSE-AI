// El motor de ECLIPSE CODE: propio si se elige, el del chat si no.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const probar = async ({ claves, paraCodigo, base, foto, codigo, etiqueta }) => {
  const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  process.env.AI_PROVIDER = "";
  process.env.CODE_PROVIDER = paraCodigo ?? "";
  process.env.GOOGLE_API_KEY = claves.includes("google") ? "g" : "";
  process.env.GEMINI_API_KEY = "";
  process.env.GROQ_API_KEY = claves.includes("groq") ? "q" : "";
  process.env.OPENROUTER_API_KEY = claves.includes("openrouter") ? "o" : "";
  process.env.MISTRAL_API_KEY = claves.includes("mistral") ? "m" : "";
  const { providerForTurn } = await jiti.import(enSrc("lib/provider.ts"));
  const r = await providerForTurn(base, foto, codigo);
  console.log(`  ${etiqueta.padEnd(50)} → ${r}`);
  return r;
};

const casos = [
  ["con clave de Mistral, programa Mistral sin elegir nada", { claves: ["groq", "mistral"], base: "groq", foto: false, codigo: true }, "mistral"],
  ["y el chat se queda donde estaba", { claves: ["groq", "mistral"], base: "groq", foto: false, codigo: false }, "groq"],
  ["Mistral con foto: no se va a Google", { claves: ["mistral", "google"], base: "mistral", foto: true, codigo: false }, "mistral"],
  ["lo elegido a mano gana sobre el automático", { claves: ["groq", "mistral", "openrouter"], paraCodigo: "openrouter", base: "groq", foto: false, codigo: true }, "openrouter"],
  ["código con motor propio (openrouter)", { claves: ["groq", "openrouter"], paraCodigo: "openrouter", base: "groq", foto: false, codigo: true }, "openrouter"],
  ["chat, con motor de código puesto", { claves: ["groq", "openrouter"], paraCodigo: "openrouter", base: "groq", foto: false, codigo: false }, "groq"],
  ["código sin motor propio", { claves: ["groq"], base: "groq", foto: false, codigo: true }, "groq"],
  ["motor de código elegido pero sin clave", { claves: ["groq"], paraCodigo: "openrouter", base: "groq", foto: false, codigo: true }, "groq"],
  ["código con foto: manda el de código", { claves: ["groq", "google", "openrouter"], paraCodigo: "openrouter", base: "groq", foto: true, codigo: true }, "openrouter"],
  ["chat con foto: manda Google", { claves: ["groq", "google"], base: "groq", foto: true, codigo: false }, "google"],
];

const fallos = [];
console.log("quién responde:");
for (const [etiqueta, opts, esperado] of casos) {
  const r = await probar({ ...opts, etiqueta });
  if (r !== esperado) fallos.push(`${etiqueta}: esperaba ${esperado} y salió ${r}`);
}

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
