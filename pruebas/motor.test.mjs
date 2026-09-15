// Con una foto delante, ¿quién contesta?
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const probar = async ({ claves, fijado, base, foto, etiqueta }) => {
  const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  process.env.AI_PROVIDER = fijado ?? "";
  // Las claves se declaran por variables de entorno, que es como están en el
  // servidor de verdad; así no hace falta tocar nada del código.
  process.env.GOOGLE_API_KEY = claves.includes("google") ? "g" : "";
  process.env.GEMINI_API_KEY = "";
  process.env.GROQ_API_KEY = claves.includes("groq") ? "q" : "";
  process.env.OPENROUTER_API_KEY = claves.includes("openrouter") ? "o" : "";
  const { providerForTurn } = await jiti.import(enSrc("lib/provider.ts"));
  const r = await providerForTurn(base, foto);
  console.log(`   ${etiqueta.padEnd(52)} → ${r}`);
  return r;
};

console.log("con foto:");
const a = await probar({ claves: ["groq", "google"], base: "groq", foto: true, etiqueta: "Ajustes dice Groq, hay clave de Google" });
const b = await probar({ claves: ["groq"], base: "groq", foto: true, etiqueta: "Ajustes dice Groq, NO hay clave de Google" });
const c = await probar({ claves: ["groq", "google"], base: "groq", foto: true, fijado: "groq", etiqueta: "el hosting fija Groq a la fuerza" });
const d = await probar({ claves: ["google"], base: "google", foto: true, etiqueta: "ya estaba en Google" });

console.log("sin foto:");
const e = await probar({ claves: ["groq", "google"], base: "groq", foto: false, etiqueta: "Ajustes dice Groq" });

const fallos = [];
if (a !== "google") fallos.push("con foto y clave de Google debería contestar Google");
if (b !== "groq") fallos.push("sin clave de Google hay que quedarse en Groq");
if (c !== "groq") fallos.push("si el hosting fija el motor, no se toca");
if (d !== "google") fallos.push("Google se queda como está");
if (e !== "groq") fallos.push("sin foto se respeta lo de Ajustes");

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
