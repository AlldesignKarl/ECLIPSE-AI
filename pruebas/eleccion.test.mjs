// Con un catálogo como el de Groq, ¿a quién le encarga el código?
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });

const CATALOGO = [
  "qwen3.8-27b",
  "gpt-oss-20b",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile",
];

const probar = async (modo) => {
  // Módulo nuevo en cada prueba: el modelo elegido se guarda entre llamadas.
  const jiti2 = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  const { streamCompat } = await jiti2.import(enSrc("lib/openai-compat.ts"));
  let elegido = null;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/models"))
      return new Response(JSON.stringify({ data: CATALOGO.map((id) => ({ id })) }), { status: 200 });
    elegido = JSON.parse(init.body).model;
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { status: 200 });
  };
  for await (const _ of streamCompat({
    provider: "groq", key: "t", system: "s",
    turns: [{ role: "user", content: "hazme un cubo de rubik en 3D" }],
    speed: "equilibrado", modo,
  }));
  return elegido;
};

const codigo = await probar("code");
const chat = await probar("chat");
console.log("catálogo:", CATALOGO.join(", "));
console.log("para CÓDIGO elige:", codigo);
console.log("para CHAT   elige:", chat);

const fallos = [];
if (/-27b|-20b|-8b/i.test(codigo))
  fallos.push(`para programar ha cogido un modelo pequeño (${codigo})`);
if (codigo !== "openai/gpt-oss-120b")
  fallos.push(`esperaba el de 120B y ha cogido ${codigo}`);

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
