// ¿Llega la foto al modelo? Se mira el cuerpo de la petición que sale de aquí.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const FOTO = {
  kind: "image",
  name: "foto.jpg",
  mime: "image/jpeg",
  data: "/9j/4AAQSkZJRgABAQAAAQ",  // un trozo de JPEG en base64, basta para la prueba
};

const probar = async (catalogo, etiqueta) => {
  const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  const { streamCompat } = await jiti.import(enSrc("lib/openai-compat.ts"));

  let cuerpo = null;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/models"))
      return new Response(JSON.stringify({ data: catalogo.map((id) => ({ id })) }), { status: 200 });
    cuerpo = JSON.parse(init.body);
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { status: 200 });
  };

  for await (const _ of streamCompat({
    provider: "groq", key: "t", system: "eres eclipse",
    turns: [{ role: "user", content: "¿Qué ves en esta foto?", attachments: [FOTO] }],
    speed: "equilibrado", modo: "chat",
  }));

  const user = cuerpo.messages.find((m) => m.role === "user");
  const partes = Array.isArray(user.content) ? user.content.map((p) => p.type) : ["texto suelto"];
  const conImagen = Array.isArray(user.content) && user.content.some((p) => p.type === "image_url");
  console.log(`\n${etiqueta}`);
  console.log(`   modelo elegido: ${cuerpo.model}`);
  console.log(`   partes del mensaje: ${partes.join(", ")}`);
  console.log(`   ¿va la foto?: ${conImagen ? "SÍ" : "NO"}`);
  if (!conImagen && typeof user.content === "string")
    console.log(`   texto: ${JSON.stringify(user.content.slice(-120))}`);
  return { modelo: cuerpo.model, conImagen };
};

const conOjos = await probar(
  ["llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct", "openai/gpt-oss-120b"],
  "cuenta CON un modelo que ve",
);
const sinOjos = await probar(
  ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"],
  "cuenta SIN ningún modelo que vea",
);

// Y con el cupo por minuto sabido, una foto no puede comerse el hueco de la
// respuesta: se cuenta por lo que vale, no por lo que ocupa en base64.
const conCupo = await (async () => {
  const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  const { streamCompat } = await jiti.import(enSrc("lib/openai-compat.ts"));
  const GORDA = { ...FOTO, data: "A".repeat(950_000) };  // 700 KB de foto, como la de un móvil
  const topes = [];
  globalThis.fetch = async (url, init) => {
    const cab = { "x-ratelimit-limit-tokens": "8000" };
    if (String(url).endsWith("/models"))
      return new Response(JSON.stringify({ data: [{ id: "meta-llama/llama-4-scout-17b-16e-instruct" }] }), { status: 200, headers: cab });
    const b = JSON.parse(init.body);
    topes.push(b.max_tokens ?? b.max_completion_tokens);
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { status: 200, headers: cab });
  };
  // La primera llamada aprende el cupo; la segunda ya lo aplica.
  for (let i = 0; i < 2; i++)
    for await (const _ of streamCompat({
      provider: "groq", key: "t", system: "eres eclipse",
      turns: [{ role: "user", content: "¿qué ves?", attachments: [GORDA] }],
      speed: "equilibrado", modo: "chat",
    }));
  return topes;
})();

console.log(`\ncon una foto de 700 KB y cupo de 8.000: huecos pedidos = ${conCupo.join(", ")}`);

const fallos = [];
if (conCupo.at(-1) < 2000)
  fallos.push(`la foto se ha comido el hueco para responder (solo ${conCupo.at(-1)} tokens)`);
if (!conOjos.conImagen) fallos.push("con un modelo que ve, la foto debería viajar");
if (!/llama-4|scout/.test(conOjos.modelo)) fallos.push(`debería haber elegido el que ve, y eligió ${conOjos.modelo}`);
// Antes se daba por hecho que no podía y no se mandaba. Ahora se manda
// igualmente: la lista de nombres caduca sola, y el que decide si puede es el
// proveedor, no una expresión regular escrita hace meses.
if (!sinOjos.conImagen)
  fallos.push("aunque el nombre no suene a modelo con vista, hay que intentarlo");

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
