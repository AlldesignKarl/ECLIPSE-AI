// Mistral entra por el mismo camino que los demás, y para código elige
// Codestral o Devstral, que es lo que hay que elegir.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const CATALOGO = [
  "mistral-small-latest",
  "open-mistral-nemo",
  "codestral-latest",
  "devstral-medium-latest",
  "mistral-large-latest",
  "pixtral-large-latest",
];

const probar = async (modo, conFoto = false) => {
  const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  const { streamCompat } = await jiti.import(enSrc("lib/openai-compat.ts"));
  let peticion = null, url = null;
  globalThis.fetch = async (u, init) => {
    if (String(u).endsWith("/models")) {
      url = String(u);
      return new Response(JSON.stringify({ data: CATALOGO.map((id) => ({ id })) }), {
        status: 200,
        headers: { "x-ratelimit-limit-tokens": "500000" },
      });
    }
    peticion = JSON.parse(init.body);
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', {
      status: 200,
      headers: { "x-ratelimit-limit-tokens": "500000" },
    });
  };
  for await (const _ of streamCompat({
    provider: "mistral", key: "k", system: "s",
    turns: [{ role: "user", content: "hazme una web", attachments: conFoto ? [{ kind: "image", name: "a.jpg", mime: "image/jpeg", data: "x" }] : undefined }],
    speed: "equilibrado", modo,
  }));
  return { modelo: peticion.model, tope: peticion.max_tokens ?? peticion.max_completion_tokens, url };
};

const codigo = await probar("code");
// Y sin Devstral en la cuenta, el siguiente mejor, que no es Codestral.
const CATALOGO_SIN_DEVSTRAL = CATALOGO.filter((m) => !/devstral/.test(m));
const chat = await probar("chat");
const foto = await probar("chat", true);

console.log("catálogo de Mistral:", CATALOGO.join(", "));
console.log(`\n  la clave se comprueba en: ${codigo.url}`);
console.log(`  para CÓDIGO elige: ${codigo.modelo}  (pide ${codigo.tope} tokens de respuesta)`);
console.log(`  para CHAT   elige: ${chat.modelo}`);
console.log(`  con foto    elige: ${foto.modelo}`);

const fallos = [];
if (!codigo.url?.startsWith("https://api.mistral.ai/v1")) fallos.push("la dirección de Mistral no es la suya");
if (!/devstral/.test(codigo.modelo))
  fallos.push(`para escribir archivos enteros debería coger Devstral, cogió ${codigo.modelo}`);
if (!/pixtral/.test(foto.modelo)) fallos.push(`con foto debería coger uno que vea, cogió ${foto.modelo}`);
// Con medio millón por minuto, el tope debe ser el máximo de código, no un recorte.
if (codigo.tope < 32000) fallos.push(`con tanto margen debería pedir el máximo, y pide ${codigo.tope}`);

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
