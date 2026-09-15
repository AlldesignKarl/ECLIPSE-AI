// Los dos casos que antes fallaban en silencio:
//  a) el catálogo no tiene ningún nombre conocido de modelo con vista
//  b) el proveedor rechaza la imagen de verdad
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const FOTO = { kind: "image", name: "cartel.jpg", mime: "image/jpeg", data: "/9j/4AAQSkZJRg" };

const correr = async ({ catalogo, rechaza, etiqueta }) => {
  const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  const { streamCompat } = await jiti.import(enSrc("lib/openai-compat.ts"));

  const intentos = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/models"))
      return new Response(JSON.stringify({ data: catalogo.map((id) => ({ id })) }), { status: 200 });
    const b = JSON.parse(init.body);
    const user = b.messages.find((m) => m.role === "user");
    const conImagen = Array.isArray(user?.content) && user.content.some((p) => p.type === "image_url");
    const texto = Array.isArray(user?.content)
      ? user.content.find((p) => p.type === "text")?.text ?? ""
      : String(user?.content ?? "");
    intentos.push({ modelo: b.model, conImagen, texto });

    if (conImagen && rechaza)
      return new Response(
        JSON.stringify({ error: { message: "This model does not support image input (image_url is not supported)." } }),
        { status: 400 },
      );
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { status: 200 });
  };

  for await (const _ of streamCompat({
    provider: "groq", key: "t", system: "s",
    turns: [{ role: "user", content: "¿Me lo traduces?", attachments: [FOTO] }],
    speed: "equilibrado", modo: "chat",
  }));

  console.log(`\n── ${etiqueta}`);
  for (const i of intentos)
    console.log(`   ${i.modelo}  ¿foto?=${i.conImagen ? "SÍ" : "no"}`);
  return intentos;
};

// a) Groq ha cambiado los nombres y ninguno suena a modelo con vista.
const aCiegas = await correr({
  catalogo: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"],
  rechaza: false,
  etiqueta: "ningún nombre conocido, pero el modelo SÍ acepta la foto",
});

// b) El proveedor la rechaza de verdad.
const rechazada = await correr({
  catalogo: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"],
  rechaza: true,
  etiqueta: "el proveedor rechaza la foto",
});

const fallos = [];
if (!aCiegas[0]?.conImagen)
  fallos.push("debería intentar mandar la foto aunque el nombre no suene a modelo con vista");
if (aCiegas.length !== 1) fallos.push("si la acepta, no debería reintentar nada");

if (!rechazada[0]?.conImagen) fallos.push("el primer intento debería llevar la foto");
if (rechazada.length < 2) fallos.push("tras el rechazo debería reintentar sin la foto");
if (rechazada.at(-1)?.conImagen) fallos.push("el reintento no debería llevar la foto");
if (!/no ha podido con ellas|NO las tienes/i.test(rechazada.at(-1)?.texto ?? ""))
  fallos.push("el reintento debería decir que no tiene la imagen");
if (/p[íi]dele que te las? describa/i.test(rechazada.at(-1)?.texto ?? ""))
  fallos.push("no debería pedirle al usuario que describa su propia imagen");
// La orden que sobraba: mandarle a Ajustes a cambiar de motor.
if (/dile que en Ajustes|cambiar el motor a/i.test(rechazada.at(-1)?.texto ?? ""))
  fallos.push("no debería mandarle a configurar nada");
if (!/No le mandes cambiar ajustes/i.test(rechazada.at(-1)?.texto ?? ""))
  fallos.push("debería prohibirle expresamente mandar al usuario a Ajustes");

console.log("\ntexto del reintento:\n   " + (rechazada.at(-1)?.texto ?? "").split("\n").filter(Boolean).pop());
console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
