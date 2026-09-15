// Con una cuenta de Mistral: ¿a quién se le pregunta en el chat, y qué pasa
// cuando la foto la rechaza el modelo de turno?
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const elegir = async (catalogo, modo, conFoto) => {
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
    provider: "mistral", key: "k", system: "s",
    turns: [{ role: "user", content: "¿de dónde son estos edificios?", attachments: conFoto ? [{ kind: "image", name: "a.jpg", mime: "image/jpeg", data: "x" }] : undefined }],
    speed: "equilibrado", modo,
  }));
  return modelo;
};

// Como el catálogo que le tocó a él: sin ningún modelo que mire imágenes.
const SIN_OJOS = ["codestral-2508", "mistral-small-latest", "open-mistral-nemo", "mistral-large-2512"];
const CON_OJOS = [...SIN_OJOS, "pixtral-large-latest"];

const casos = [
  ["chat, catálogo sin vista", SIN_OJOS, "chat", false, /mistral-large/],
  ["chat con foto, catálogo sin vista", SIN_OJOS, "chat", true, /mistral-large/],
  ["chat con foto, catálogo con Pixtral", CON_OJOS, "chat", true, /pixtral/],
  // Sin Devstral, para escribir un archivo entero es mejor Mistral Large que
  // Codestral, que está afinado para completar líneas sueltas.
  ["código sin Devstral", SIN_OJOS, "code", false, /mistral-large/],
  ["código con Devstral", [...SIN_OJOS, "devstral-medium-2507"], "code", false, /devstral/],
];

const fallos = [];
console.log("qué modelo de Mistral responde:");
for (const [nombre, catalogo, modo, foto, esperado] of casos) {
  const m = await elegir(catalogo, modo, foto);
  const ok = esperado.test(m);
  console.log(`  ${ok ? "✓" : "✗"} ${nombre.padEnd(36)} → ${m}`);
  if (!ok) fallos.push(`${nombre}: salió ${m}`);
  if (modo === "chat" && /codestral/.test(m)) fallos.push(`${nombre}: Codestral no puede contestar en el chat`);
}

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
