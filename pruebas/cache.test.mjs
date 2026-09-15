// Una elección vieja y mala no puede seguir contestando en el chat.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
const { streamCompat } = await jiti.import(enSrc("lib/openai-compat.ts"));

const CATALOGO = ["codestral-2508", "mistral-large-2512", "mistral-small-latest"];
const usados = [];
globalThis.fetch = async (u, init) => {
  if (String(u).endsWith("/models"))
    return new Response(JSON.stringify({ data: CATALOGO.map((id) => ({ id })) }), { status: 200 });
  usados.push(JSON.parse(init.body).model);
  return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { status: 200 });
};

const pedir = async (modo) => {
  for await (const _ of streamCompat({
    provider: "mistral", key: "k", system: "s",
    turns: [{ role: "user", content: "hola" }], speed: "equilibrado", modo,
  }));
  return usados.at(-1);
};

// Primero código: deja Codestral o el que sea guardado para código.
const a = await pedir("code");
// Y ahora chat, varias veces: nunca puede salir un modelo de completar código.
const b = await pedir("chat");
const c = await pedir("chat");

console.log(`  código → ${a}`);
console.log(`  chat   → ${b}`);
console.log(`  chat   → ${c}   (segunda vez, con la elección ya guardada)`);

const fallos = [];
for (const [cual, m] of [["primera", b], ["segunda", c]])
  if (/code|codestral/i.test(m)) fallos.push(`la ${cual} vez del chat contestó ${m}`);

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
