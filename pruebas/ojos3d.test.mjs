// Con una foto delante, ¿quién contesta? Y sobre todo: ¿quién contesta en
// ECLIPSE CODE, donde la preferencia natural (Devstral, Codestral) es ciega?
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const elegir = async (provider, catalogo, modo, conFoto) => {
  const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  const { streamCompat } = await jiti.import(enSrc("lib/openai-compat.ts"));
  let modelo = null;
  globalThis.fetch = async (u, init) => {
    if (String(u).endsWith("/models"))
      return new Response(JSON.stringify({ data: catalogo.map((id) => ({ id })) }), { status: 200 });
    modelo = JSON.parse(init.body).model;
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { status: 200 });
  };
  for await (const _ of streamCompat({
    provider, key: "k", system: "s",
    turns: [{
      role: "user", content: "hazme esto en 3D",
      attachments: conFoto ? [{ kind: "image", name: "a.jpg", mime: "image/jpeg", data: "x" }] : undefined,
    }],
    speed: "equilibrado", modo,
  }));
  return modelo;
};

const MISTRAL = ["codestral-2508", "devstral-medium-2507", "mistral-large-2512", "pixtral-12b-2409", "pixtral-large-latest"];
const GROQ = ["llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"];

const casos = [
  // Sin foto, en código, manda Devstral: es lo suyo.
  ["mistral", MISTRAL, "code", false, /devstral/, "código sin foto → Devstral"],
  // Con foto, en código, manda ver. Y entre los que ven, el grande.
  ["mistral", MISTRAL, "code", true, /pixtral-large/, "código CON foto → el Pixtral grande"],
  ["mistral", MISTRAL, "chat", true, /pixtral-large/, "chat CON foto → el Pixtral grande"],
  ["groq", GROQ, "code", true, /llama-4/, "Groq código con foto → un Llama 4"],
];

const fallos = [];
console.log("qué modelo mira la foto:");
for (const [provider, catalogo, modo, foto, esperado, nombre] of casos) {
  const m = await elegir(provider, catalogo, modo, foto);
  const ok = esperado.test(m);
  console.log(`  ${ok ? "✓" : "✗"} ${nombre.padEnd(34)} → ${m}`);
  if (!ok) fallos.push(`${nombre}: salió ${m}`);
}

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
