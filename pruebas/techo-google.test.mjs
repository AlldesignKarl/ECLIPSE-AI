// Cuánto se le deja escribir a Google. En ECLIPSE CODE la respuesta es un
// archivo entero, y con 8.192 tokens una página con diseño de verdad sale
// cortada siempre, tenga la cuenta el cupo que tenga.
import { createServer } from "node:http";
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

let pedido = null;
const s = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    pedido = JSON.parse(c);
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] })}\n\n`);
    res.end();
  });
});
await new Promise((r) => s.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${s.address().port}`;

const pedir = async ({ speed, modo }) => {
  pedido = null;
  const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  const fuente = await jiti.import(enSrc("lib/gemini.ts"));
  const real = globalThis.fetch;
  globalThis.fetch = (url, init) =>
    real(String(url).replace(/^https:\/\/generativelanguage\.googleapis\.com\/[^/]+/, base), init);
  try {
    for await (const _ of fuente.streamChat({
      system: "s", turns: [{ role: "user", content: "hazme una página" }],
      speed, modo, webSearch: false, key: "k",
    }));
  } catch { /* da igual: lo que se mira es lo que se pidió */ }
  globalThis.fetch = real;
  return pedido?.generationConfig?.maxOutputTokens ?? null;
};

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const casos = [
  ["conversación normal", { speed: "equilibrado" }, 8192],
  ["conversación rápida", { speed: "rapido" }, 4096],
  ["conversación profunda", { speed: "profundo" }, 16384],
  ["ECLIPSE CODE", { speed: "equilibrado", modo: "code" }, 32768],
  ["ECLIPSE CODE rápido", { speed: "rapido", modo: "code" }, 12288],
  ["ECLIPSE CODE profundo", { speed: "profundo", modo: "code" }, 32768],
];

console.log("\nCuánto le deja escribir a Google");
for (const [nombre, opts, esperado] of casos) {
  const v = await pedir(opts);
  ok(v === esperado, `${nombre.padEnd(24)} → ${v} tokens (esperado ${esperado})`);
}

// Y que no se haya quedado por debajo del otro camino, que es de lo que iba.
const { default: nada } = { default: null };
void nada;
const compat = (await import("node:fs")).readFileSync(enSrc("lib/openai-compat.ts"), "utf8");
const techoCompat = compat.match(/modo === "code"\) return speed === "rapido" \? (\d+) : (\d+)/);
ok(Boolean(techoCompat), "se encuentra el techo del otro camino");
ok(
  Number(techoCompat[2]) === 32768,
  `Google pide lo mismo que Groq y Mistral para programar (${techoCompat?.[2]})`,
);

s.close();
console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
