// ECLIPSE CODE tiene que poder buscar, y sin comerse el sitio de escribir.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
process.env.TAVILY_API_KEY = "fake";

const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
const { herramientasPara } = await jiti.import(enSrc("lib/tools/registro.ts"));
const { buscarEnLaWeb } = await jiti.import(enSrc("lib/tools/buscar.ts"));

const enCodigo = (await herramientasPara("code", "pro")).map((h) => h.nombre);
const enChat = (await herramientasPara("chat", "pro")).map((h) => h.nombre);
console.log("herramientas en código:", enCodigo.join(", ") || "(ninguna)");
console.log("herramientas en chat:  ", enChat.join(", "));

// Un buscador de mentira con extractos largos, para ver cuánto recorta.
const LARGO = "La Gran Pirámide de Guiza mide 230 metros de lado. ".repeat(40);
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({
      results: Array.from({ length: 8 }, (_, i) => ({
        title: `Resultado ${i}`,
        url: `https://es.wikipedia.org/wiki/p${i}`,
        content: LARGO,
      })),
    }),
    { status: 200 },
  );

const normal = await buscarEnLaWeb("pirámide de Guiza proporciones", 6, undefined, false);
const breve = await buscarEnLaWeb("pirámide de Guiza proporciones", 6, undefined, true);

const tk = (t) => Math.ceil(t.length / 3.5);
console.log(`\nbúsqueda normal: ${tk(normal.texto)} tokens, ${(normal.fuentes ?? []).length} fuentes`);
console.log(`búsqueda breve:  ${tk(breve.texto)} tokens, ${(breve.fuentes ?? []).length} fuentes`);

const fallos = [];
if (!enCodigo.includes("buscar_web")) fallos.push("ECLIPSE CODE debería poder buscar");
if (enCodigo.includes("crear_imagen")) fallos.push("en código no pinta nada crear imágenes sueltas");
if (!enChat.includes("crear_imagen")) fallos.push("el chat sí debe poder crear imágenes");
if ((breve.fuentes ?? []).length > 3) fallos.push("la versión breve debería traer 3 resultados como mucho");
if (tk(breve.texto) > 450) fallos.push(`la versión breve ocupa demasiado: ${tk(breve.texto)} tokens`);
if (tk(breve.texto) >= tk(normal.texto)) fallos.push("la breve debería ocupar bastante menos");

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
