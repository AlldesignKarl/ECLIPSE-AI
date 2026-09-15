// El camino de verdad: el del chat, que lleva herramientas por medio.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

process.env.TAVILY_API_KEY = "fake";   // para que haya herramientas, como en producción

const FOTO = { kind: "image", name: "15743.jpg", mime: "image/jpeg", data: "/9j/4AAQSkZJRgABAQAAAQ" };
const CATALOGO = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
];

const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
const { conversarConHerramientas } = await jiti.import(enSrc("lib/tools/bucle.ts"));

const peticiones = [];
globalThis.fetch = async (url, init) => {
  if (String(url).endsWith("/models"))
    return new Response(JSON.stringify({ data: CATALOGO.map((id) => ({ id })) }), { status: 200 });
  const b = JSON.parse(init.body);
  const user = b.messages.find((m) => m.role === "user");
  peticiones.push({
    modelo: b.model,
    conHerramientas: Boolean(b.tools),
    conImagen: Array.isArray(user?.content) && user.content.some((p) => p.type === "image_url"),
  });
  return new Response('data: {"choices":[{"delta":{"content":"veo un cartel"}}]}\n\ndata: [DONE]\n\n', { status: 200 });
};

for await (const _ of conversarConHerramientas({
  provider: "groq", key: "t", system: "eres eclipse",
  turns: [{ role: "user", content: "Me lo traduces?", attachments: [FOTO] }],
  speed: "equilibrado", mode: "chat", plan: "pro",
}));

for (const p of peticiones)
  console.log(`   modelo=${p.modelo}  herramientas=${p.conHerramientas ? "sí" : "no"}  ¿va la foto?=${p.conImagen ? "SÍ" : "NO"}`);

const fallos = [];
if (!peticiones.length) fallos.push("no ha salido ninguna petición");
if (!peticiones[0]?.conImagen) fallos.push("la foto no viaja por el camino del chat");
if (!/llama-4|scout|maverick/.test(peticiones[0]?.modelo ?? ""))
  fallos.push(`ha elegido ${peticiones[0]?.modelo}, que no sabe mirar imágenes`);

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
