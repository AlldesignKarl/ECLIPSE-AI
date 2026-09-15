// Preguntarle al catálogo si el motor puede ver, antes de mandarle la foto.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const probar = async (catalogo, etiqueta, falla = false) => {
  const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  const { tieneVista } = await jiti.import(enSrc("lib/openai-compat.ts"));
  let llamadas = 0;
  globalThis.fetch = async () => {
    llamadas++;
    if (falla) return new Response("no", { status: 500 });
    return new Response(JSON.stringify({ data: catalogo.map((id) => ({ id })) }), { status: 200 });
  };
  const r = await tieneVista("mistral", "k");
  // Segunda llamada: el catálogo se guarda, no se vuelve a pedir.
  await tieneVista("mistral", "k");
  console.log(`  ${({ si: "ve   ", no: "ciego", "no-se": "¿?   " })[r]}  ${etiqueta.padEnd(44)} (${llamadas} consulta${llamadas === 1 ? "" : "s"} al catálogo)`);
  return { r, llamadas };
};

const fallos = [];
const a = await probar(["codestral-2508", "mistral-small-latest", "ministral-3b"], "catálogo sin ningún modelo con vista");
const b = await probar(["codestral-2508", "pixtral-large-latest"], "catálogo con Pixtral");
const c = await probar([], "el catálogo no se puede consultar", true);
const d = await probar(["mistral-medium-2508", "pixtral-12b-2409"], "Pixtral con otro nombre");

if (a.r !== "no") fallos.push("sin modelos con vista debería decir que no ve");
if (b.r !== "si") fallos.push("con Pixtral debería decir que sí ve");
if (c.r !== "no-se") fallos.push("si no se puede consultar, la respuesta es que no se sabe");
if (d.r !== "si") fallos.push("pixtral-12b también es Pixtral");
if (a.llamadas !== 1 || b.llamadas !== 1) fallos.push("el catálogo debería preguntarse una sola vez");

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
