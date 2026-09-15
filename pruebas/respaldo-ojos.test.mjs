// Lo de la captura de Carlos: Pixtral se queda sin cupo y el respaldo se va a
// Codestral, que no ve nada. La foto se cae por el camino y la disculpa llega
// firmada por un modelo que nunca debió tocar ese mensaje.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const FOTO = { kind: "image", name: "15481.jpg", mime: "image/jpeg", data: "/9j/4AAQ" };

// El catálogo tal y como lo devuelve Mistral: Codestral el primero.
const CATALOGO = [
  "codestral-2508",
  "codestral-latest",
  "open-mistral-nemo",
  "mistral-small-latest",
  "mistral-large-latest",
  "pixtral-12b-2409",
  "pixtral-large-latest",
];

const correr = async ({ sinCupo = [], rotos = [], conFoto = true, modo = "chat", catalogo = CATALOGO }) => {
  const jiti = await crearJiti(import.meta.url, {
    alias: { "@": SRC }, moduleCache: false,
  });
  const { streamCompat } = await jiti.import(enSrc("lib/openai-compat.ts"));

  const intentos = [];
  let sinVista = false;

  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/models"))
      return new Response(JSON.stringify({ data: catalogo.map((id) => ({ id })) }), { status: 200 });

    const b = JSON.parse(init.body);
    const user = b.messages.find((m) => m.role === "user");
    const llevaFoto = Array.isArray(user?.content) && user.content.some((p) => p.type === "image_url");
    intentos.push({ modelo: b.model, llevaFoto });

    // Ese modelo ya no existe en el proveedor (retirado, renombrado).
    if (rotos.includes(b.model))
      return new Response(JSON.stringify({ message: "model_not_found" }), { status: 404 });

    // Ese modelo está sin cupo ahora mismo.
    if (sinCupo.includes(b.model))
      return new Response(JSON.stringify({ message: "Requests rate limit exceeded" }), { status: 429 });

    // Un modelo ciego con una foto delante: 400, como hace el proveedor.
    if (llevaFoto && !/pixtral/.test(b.model))
      return new Response(
        JSON.stringify({ message: "This model does not support image input" }),
        { status: 400 },
      );

    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { status: 200 });
  };

  let error = null;
  try {
    for await (const e of streamCompat({
      provider: "mistral", key: "k", system: "s",
      turns: [{ role: "user", content: "Y esta imagen de dónde es", attachments: conFoto ? [FOTO] : undefined }],
      speed: "equilibrado", modo,
    })) {
      if (e.sinVista) sinVista = true;
    }
  } catch (err) {
    error = err?.message ?? String(err);
  }
  return { intentos, sinVista, error };
};

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

console.log("\nTodo bien: contesta el que mira");
const normal = await correr({});
ok(/pixtral/.test(normal.intentos[0]?.modelo), `el primero en probarse es Pixtral (${normal.intentos[0]?.modelo})`);
ok(normal.intentos[0]?.llevaFoto === true, "y la foto va dentro");
ok(!normal.sinVista, "la foto no se cae");

console.log("\nEl Pixtral grande sin cupo");
const unoCaido = await correr({ sinCupo: ["pixtral-large-latest"] });
const usados = unoCaido.intentos.map((i) => i.modelo);
ok(usados.every((m) => /pixtral/.test(m)), `solo se prueban modelos que ven (${usados.join(" → ")})`);
ok(!usados.some((m) => /codestral/.test(m)), "NUNCA se cae en Codestral, que fue lo que pasó");
ok(!unoCaido.sinVista, "y la foto llega igual, con el otro Pixtral");

console.log("\nLos dos Pixtral sin cupo: no hay con qué mirar");
const ciego = await correr({ sinCupo: ["pixtral-large-latest", "pixtral-12b-2409"] });
const conLaFoto = ciego.intentos.filter((i) => i.llevaFoto).map((i) => i.modelo);
ok(conLaFoto.every((m) => /pixtral/.test(m)), `la foto solo se le enseña a los que ven (${conLaFoto.join(" → ")})`);
// Y cuando ya no queda ninguno, se suelta la foto y se contesta igual: el aviso
// `sinVista` es lo que hace que la ruta se vaya a otro motor con ojos.
ok(!ciego.error, `no se queda muerto (${ciego.error ?? "sin error"})`);
ok(ciego.sinVista, "avisa de que la foto se quedó fuera");
ok(!ciego.intentos.some((i) => /codestral/.test(i.modelo)), "y Codestral no aparece por ningún lado");

console.log("\nSin foto, el respaldo sigue funcionando");
const sinFoto = await correr({ conFoto: false, sinCupo: ["mistral-large-latest"] });
const usados3 = sinFoto.intentos.map((i) => i.modelo);
ok(usados3.length > 1, `hay respaldo (${usados3.join(" → ")})`);
ok(!/codestral/.test(usados3[1] ?? ""), "y el respaldo de una conversación tampoco es Codestral");
ok(!sinFoto.error, "y acaba contestando");

console.log("\nEn ECLIPSE CODE con una foto, igual: manda ver");
const codigo = await correr({ modo: "code", sinCupo: ["pixtral-large-latest"] });
const usados4 = codigo.intentos.map((i) => i.modelo);
ok(usados4.every((m) => /pixtral/.test(m)), `solo modelos con ojos (${usados4.join(" → ")})`);

console.log("\nUn motor cuyos modelos con ojos están retirados (lo de Groq)");
// Como la cuenta de Groq de la captura: los que ven, rotos; los demás, bien.
const GROQ = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "meta-llama/llama-4-scout-17b-16e-instruct"];
const groqRoto = await correr({
  catalogo: GROQ,
  rotos: ["meta-llama/llama-4-scout-17b-16e-instruct"],
});
const usados5 = groqRoto.intentos.map((i) => i.modelo);
ok(!groqRoto.error, `no acaba en un error rojo (${groqRoto.error ?? "sin error"})`);
ok(groqRoto.sinVista, "avisa de que la foto se ha quedado fuera, para que se pruebe otro motor");
ok(usados5.length > 1, `hay segunda ronda sin la foto (${usados5.join(" → ")})`);
ok(usados5[0].includes("llama-4"), "pero lo primero que prueba es el que ve");

console.log("\nY si NO hay ninguno que vea, tampoco se queda muerto");
const ningunoVe = await correr({
  catalogo: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"],
  rotos: ["llama-3.3-70b-versatile"],
});
ok(!ningunoVe.error, `contesta igual (${ningunoVe.error ?? "sin error"})`);
ok(ningunoVe.sinVista, "y avisa de que no pudo con la foto");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
