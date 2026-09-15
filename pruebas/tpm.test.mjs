// Proveedor de mentira que impone un cupo por minuto como el de Groq:
// cuenta el tamaño de la conversación MÁS el hueco reservado para la respuesta.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { streamCompat } = await jiti.import(enSrc("lib/openai-compat.ts"));
const { aligerarHistorial } = await jiti.import(enSrc("lib/project.ts"));

const LIMITE = 8000;
const LIMITE_VISTO = 8000;
const PALABRA = 4; // caracteres por token, a ojo, como cuentan los proveedores

const llamadas = [];

globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.endsWith("/models"))
    return new Response(JSON.stringify({ data: [{ id: "gpt-oss-120b" }, { id: "kimi-k2" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const body = JSON.parse(init.body);
  const tope = body.max_tokens ?? body.max_completion_tokens;
  const prompt = Math.ceil(JSON.stringify(body.messages).length / PALABRA);
  const pedido = prompt + tope;
  llamadas.push({ model: body.model, tope, prompt, pedido });

  if (pedido > LIMITE)
    return new Response(
      JSON.stringify({
        error: {
          message: `Request too large for model \`${body.model}\` in organization org_x service tier \`on_demand\` on tokens per minute (TPM): Limit ${LIMITE}, Requested ${pedido}, please reduce your message size and try again.`,
          type: "tokens",
          code: "rate_limit_exceeded",
        },
      }),
      { status: 413, headers: { "content-type": "application/json", "x-ratelimit-limit-tokens": String(LIMITE) } },
    );

  const sse =
    'data: {"choices":[{"delta":{"content":"listo"}}]}\n\n' + "data: [DONE]\n\n";
  return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream", "x-ratelimit-limit-tokens": String(LIMITE) } });
};

// ── Una conversación de código como la del usuario: varios cubos de Rubik,
//    cada respuesta con su archivo entero dentro.
const CUBO = "```html\n" + "<div class='cubo'></div>\n".repeat(220) + "```";
const history = [];
for (let i = 0; i < 4; i++) {
  history.push({ role: "user", content: `Hazme un cubo de Rubik en 3D, versión ${i + 1}.` });
  history.push({ role: "assistant", content: `Aquí lo tienes.\n\n${CUBO}` });
}
history.push({ role: "user", content: "Ahora hazlo con los colores cambiados." });

const correr = async (turns, etiqueta) => {
  llamadas.length = 0;
  let texto = "";
  let error = null;
  try {
    for await (const ev of streamCompat({
      provider: "groq",
      key: "test",
      system: "eres eclipse",
      turns,
      speed: "equilibrado",
      modo: "code",
    }))
      if (ev.text) texto += ev.text;
  } catch (e) {
    error = e;
  }
  console.log(`\n── ${etiqueta}`);
  for (const l of llamadas)
    console.log(`   intento: modelo=${l.model} tope=${l.tope} conversación≈${l.prompt} total=${l.pedido} ${l.pedido > LIMITE ? "RECHAZADO" : "OK"}`);
  console.log(`   resultado: ${error ? "ERROR → " + error.message : "respuesta → " + JSON.stringify(texto)}`);
  return { texto, error, llamadas: [...llamadas] };
};

// 1) Sin adelgazar el historial: la conversación sola ya no cabe.
const sinAdelgazar = await correr(history, "historial completo (lo que pasaba antes)");

// 2) Con `aligerarHistorial`: solo sobrevive el último archivo.
const ligero = aligerarHistorial(history);
const conAdelgazar = await correr(ligero, "historial adelgazado (lo nuevo)");

// 3) Una conversación que no cabe ni dejándole el mínimo para escribir.
const imposible = [
  { role: "user", content: "Hazme esto.\n\n" + "x".repeat(34000) },
];
const aplastada = await correr(imposible, "un solo mensaje que ya no cabe de ninguna manera");

// 4) Una conversación larguísima pero de mensajes normales: debe soltar lo
//    viejo y contestar, no mandar al usuario a abrir una conversación nueva.
const larga = [];
for (let i = 0; i < 14; i++) {
  larga.push({ role: "user", content: `Mensaje ${i} del usuario.\n\n` + "bla ".repeat(420) });
  larga.push({ role: "assistant", content: `Respuesta ${i}.\n\n` + "bla ".repeat(420) });
}
larga.push({ role: "user", content: "Y ahora hazme el cubo." });
const recortada = await correr(larga, "conversación muy larga (debe recortar sola)");

// 5) Y con el cupo ya aprendido, una conversación normal tiene que salir a la
//    primera, sin gastar un viaje en descubrir lo que ya se sabía.
const normal = await correr(
  [{ role: "user", content: "Hazme una calculadora de hipotecas." }],
  "conversación normal, con el cupo ya aprendido",
);

// ── Comprobaciones
const fallos = [];

if (!conAdelgazar.texto || conAdelgazar.error)
  fallos.push("con el historial adelgazado la respuesta debería salir sin error");

if (conAdelgazar.llamadas.some((l) => l.pedido > LIMITE_VISTO))
  fallos.push("ninguna petición debería pasarse del cupo una vez conocido");

// Lo que de verdad arregla adelgazar: al no arrastrar los archivos viejos, le
// queda muchísimo más sitio para escribir el archivo nuevo entero.
const antes = sinAdelgazar.llamadas.at(-1).tope;
const ahora = conAdelgazar.llamadas.at(-1).tope;
if (!(ahora > antes * 2))
  fallos.push(`adelgazar debería dejarle mucho más sitio para escribir (antes ${antes}, ahora ${ahora})`);

if (!aplastada.error || aplastada.error.status !== 413)
  fallos.push("con la conversación imposible debería avisar de que ya no cabe (413)");

if (aplastada.error && /Request too large|TPM|tokens per minute/i.test(aplastada.error.message))
  fallos.push("el aviso no puede ser el texto en inglés del proveedor");


if (!aplastada.error || !/demasiado largo/i.test(aplastada.error.message))
  fallos.push("el aviso debería hablar del mensaje, no de la conversación");

if (recortada.error)
  fallos.push(`una conversación larga debería recortarse sola, no fallar: ${recortada.error.message}`);
if (!recortada.texto)
  fallos.push("una conversación larga debería acabar respondiendo");

if (normal.llamadas.length !== 1)
  fallos.push(`sabiendo el cupo debería acertar a la primera, y ha hecho ${normal.llamadas.length} intentos`);

console.log(`\nHueco para escribir: sin adelgazar ${antes} tokens, adelgazado ${ahora}.`);
console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
