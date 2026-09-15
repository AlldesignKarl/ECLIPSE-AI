// Google escribe a veces su llamada como si fuera texto. Que no llegue, y que
// no deje al usuario con una burbuja en blanco.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const sse = (partes) =>
  partes.map((t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`).join("");

const correr = async ({ respuestas, conBusqueda, etiqueta }) => {
  const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
  const { streamChat } = await jiti.import(enSrc("lib/gemini.ts"));

  const vueltas = [];
  globalThis.fetch = async (url, init) => {
    const b = JSON.parse(init.body);
    vueltas.push({ conBusqueda: Boolean(b.tools) });
    return new Response(sse(respuestas[vueltas.length - 1] ?? ["..."]), { status: 200 });
  };

  let visible = "", oculto = "";
  for await (const e of streamChat({
    system: "s", turns: [{ role: "user", content: "¿de qué ciudad son estos rascacielos?" }],
    speed: "equilibrado", webSearch: conBusqueda, key: "k",
  })) {
    if (e.text) visible += e.text;
    if (e.pensando) oculto += e.pensando;
  }

  console.log(`\n── ${etiqueta}`);
  console.log(`   vueltas: ${vueltas.length} (${vueltas.map((v) => (v.conBusqueda ? "con búsqueda" : "sin búsqueda")).join(" → ")})`);
  console.log(`   en pantalla: ${JSON.stringify(visible)}`);
  console.log(`   al panel:    ${JSON.stringify(oculto.slice(0, 60))}`);
  return { visible, oculto, vueltas };
};

const soloLlamada = await correr({
  conBusqueda: true,
  respuestas: [
    ['<tool_code> search.query("Spain total household net worth 2024") </tool_code>'],
    ["Son las Cuatro Torres, en Madrid (España)."],
  ],
  etiqueta: "escribe solo la llamada: debe reintentar sin búsqueda",
});

const mezclado = await correr({
  conBusqueda: true,
  respuestas: [['<tool_code>search.query("x")</tool_code>Son las Cuatro Torres, en Madrid.']],
  etiqueta: "llamada + respuesta: se queda con la respuesta y no reintenta",
});

const normal = await correr({
  conBusqueda: true,
  respuestas: [["Son las Cuatro Torres, en Madrid."]],
  etiqueta: "respuesta normal",
});

const fallos = [];
if (soloLlamada.vueltas.length !== 2) fallos.push("debería haber reintentado");
if (soloLlamada.vueltas[1]?.conBusqueda) fallos.push("el reintento debe ir sin búsqueda");
if (!soloLlamada.visible.includes("Madrid")) fallos.push("el reintento debería dar la respuesta");
if (soloLlamada.visible.includes("tool_code")) fallos.push("la llamada no puede salir en pantalla");
if (!soloLlamada.oculto.includes("search.query")) fallos.push("la llamada debería ir al panel");

if (mezclado.vueltas.length !== 1) fallos.push("con respuesta no hay que reintentar");
if (mezclado.visible !== "Son las Cuatro Torres, en Madrid.") fallos.push("ha tocado la respuesta buena");

if (normal.vueltas.length !== 1) fallos.push("una respuesta normal no se reintenta");

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
