// Cuando el motor rechaza la foto, hay que avisar ANTES de escribir nada, y el
// aviso tiene que llegar hasta arriba pasando por el bucle de herramientas.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
process.env.TAVILY_API_KEY = "fake";

const FOTO = { kind: "image", name: "torres.jpg", mime: "image/jpeg", data: "/9j/4AAQSkZJRg" };

const fingir = (rechaza) => {
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/models"))
      return new Response(JSON.stringify({ data: [{ id: "llama-3.3-70b-versatile" }] }), { status: 200 });
    const b = JSON.parse(init.body);
    const u = b.messages.find((m) => m.role === "user");
    const conImagen = Array.isArray(u?.content) && u.content.some((p) => p.type === "image_url");
    if (conImagen && rechaza)
      return new Response(JSON.stringify({ error: { message: "This model does not support image input." } }), { status: 400 });
    return new Response('data: {"choices":[{"delta":{"content":"texto"}}]}\n\ndata: [DONE]\n\n', { status: 200 });
  };
};

const porDondeSea = async (via, rechaza) => {
  const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  fingir(rechaza);
  const orden = [];
  const turns = [{ role: "user", content: "¿de dónde son?", attachments: [FOTO] }];

  if (via === "directo") {
    const { streamCompat } = await jiti.import(enSrc("lib/openai-compat.ts"));
    for await (const e of streamCompat({ provider: "groq", key: "t", system: "s", turns, speed: "equilibrado", modo: "chat" })) {
      if (e.sinVista) orden.push("aviso");
      if (e.text) orden.push("texto");
    }
  } else {
    const { conversarConHerramientas } = await jiti.import(enSrc("lib/tools/bucle.ts"));
    for await (const e of conversarConHerramientas({ provider: "groq", key: "t", system: "s", turns, speed: "equilibrado", mode: "chat", plan: "pro" })) {
      if (e.sinVista) orden.push("aviso");
      if (e.texto) orden.push("texto");
    }
  }
  console.log(`   ${via.padEnd(10)} ${rechaza ? "rechaza " : "acepta  "} → ${orden.join(", ") || "(nada)"}`);
  return orden;
};

console.log("orden de los sucesos:");
const a = await porDondeSea("directo", true);
const b = await porDondeSea("con tools", true);
const c = await porDondeSea("directo", false);
const d = await porDondeSea("con tools", false);

const fallos = [];
for (const [n, o] of [["directo", a], ["con tools", b]]) {
  if (!o.includes("aviso")) fallos.push(`${n}: no avisa de que se ha quedado sin la foto`);
  if (o.indexOf("aviso") > o.indexOf("texto")) fallos.push(`${n}: avisa DESPUÉS de escribir, ya no sirve`);
}
for (const [n, o] of [["directo", c], ["con tools", d]])
  if (o.includes("aviso")) fallos.push(`${n}: no debería avisar si la foto ha ido bien`);

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
