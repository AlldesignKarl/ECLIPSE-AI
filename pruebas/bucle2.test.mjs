// El corte del bucle, por el camino de verdad: un proveedor que se engancha.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
const { streamCompat } = await jiti.import(enSrc("lib/openai-compat.ts"));

const correr = async (trozos, etiqueta) => {
  globalThis.fetch = async (u) => {
    if (String(u).endsWith("/models"))
      return new Response(JSON.stringify({ data: [{ id: "mistral-large-2512" }] }), { status: 200 });
    const sse = trozos
      .map((t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`)
      .join("") + "data: [DONE]\n\n";
    return new Response(sse, { status: 200 });
  };
  let texto = "";
  for await (const e of streamCompat({
    provider: "mistral", key: "k", system: "s",
    turns: [{ role: "user", content: "una iglesia en 3D" }], speed: "equilibrado", modo: "code",
  })) if (e.text) texto += e.text;
  console.log(`\n── ${etiqueta}`);
  console.log(`   ha escrito ${texto.length} de ${trozos.join("").length} caracteres`);
  console.log(`   termina en: ${JSON.stringify(texto.slice(-60))}`);
  return texto;
};

const enBucle = await correr(
  ["Vale. "].concat(Array.from({ length: 40 }, () => "¿Qué forma de altar? ")),
  "el modelo se engancha",
);
const normal = await correr(
  ["Aquí tienes la iglesia.\n\n", "```html index.html\n", "<!doctype html>\n", "<h1>Iglesia</h1>\n", "```"],
  "una respuesta normal",
);

const fallos = [];
if (!/repiti[ée]ndome/i.test(enBucle)) fallos.push("debería avisar de que se ha quedado repitiéndose");
if (enBucle.length > 400) fallos.push(`ha dejado escribir demasiado antes de cortar (${enBucle.length})`);
if (/repiti[ée]ndome/i.test(normal)) fallos.push("no debería cortar una respuesta normal");
if (!normal.includes("<h1>Iglesia</h1>")) fallos.push("la respuesta normal debe llegar entera");

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
