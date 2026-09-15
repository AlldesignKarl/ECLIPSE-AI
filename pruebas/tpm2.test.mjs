// El otro mensaje que también habla de "tokens per minute" pero no significa
// lo mismo: el cupo de este minuto está gastado. Eso no se arregla recortando.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { streamCompat } = await jiti.import(enSrc("lib/openai-compat.ts"));

let n = 0;
globalThis.fetch = async (url, init) => {
  if (String(url).endsWith("/models"))
    return new Response(JSON.stringify({ data: [{ id: "gpt-oss-120b" }, { id: "kimi-k2" }] }), { status: 200 });
  n++;
  return new Response(
    JSON.stringify({
      error: {
        message:
          "Rate limit reached for model `kimi-k2` in organization org_x service tier `on_demand` on tokens per minute (TPM): Limit 8000, Used 7800, Requested 900. Please try again in 5.2s.",
        code: "rate_limit_exceeded",
      },
    }),
    { status: 429 },
  );
};

let error = null;
try {
  for await (const _ of streamCompat({
    provider: "groq", key: "t", system: "s",
    turns: [{ role: "user", content: "hola" }], speed: "equilibrado", modo: "code",
  }));
} catch (e) { error = e; }

console.log(`peticiones: ${n}`);
console.log(`mensaje: ${error?.message}`);

const fallos = [];
if (!error) fallos.push("debería fallar");
if (error?.status !== 429) fallos.push("debería seguir siendo un 429, no un 413");
if (/conversación ya pesa/i.test(error?.message ?? ""))
  fallos.push("un cupo gastado no es una conversación demasiado larga: mensaje equivocado");
if (!/límite gratuito/i.test(error?.message ?? ""))
  fallos.push("debería decir que es el límite gratuito");
if (n > 8) fallos.push(`demasiados reintentos inútiles (${n})`);

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
