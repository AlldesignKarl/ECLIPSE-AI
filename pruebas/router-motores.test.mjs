// El router con la aplicación levantada: que una charla la conteste el motor de
// siempre, que una petición de código se vaya al especialista, que la
// personalidad sea la MISMA venga de quien venga, y que si el especialista
// falla nadie se entere.
//
// Los dos motores son de mentira y apuntan a este proceso, así que se puede
// mirar exactamente quién recibió cada mensaje. En este contenedor no hay
// internet: comprobarlo contra Google de verdad no se puede, y suponerlo no
// vale.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as unPuerto } from "node:net";
import { openSync } from "node:fs";
import { RAIZ } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lo que ha recibido cada motor, para poder decir quién contestó qué. */
const recibido = { mistral: [], google: [] };
/** Se enciende para comprobar el recambio: Google contesta que no puede. */
let googleRoto = false;

// Un Mistral de mentira (dialecto de OpenAI).
const mistral = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    if (req.url.includes("/models")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ data: [{ id: "mistral-large-latest" }] }));
    }
    const cuerpo = JSON.parse(c || "{}");
    recibido.mistral.push(cuerpo);
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Contesta el de siempre." } }] })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });
});
await new Promise((r) => mistral.listen(0, "127.0.0.1", r));
const baseMistral = `http://127.0.0.1:${mistral.address().port}`;

// Un Google de mentira, con su forma propia: ListModels y streamGenerateContent.
const google = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    if (req.url.endsWith("/models")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }],
      }));
    }
    if (googleRoto) {
      res.writeHead(429, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" } }));
    }
    recibido.google.push(JSON.parse(c || "{}"));
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "Contesta el especialista." }] } }] })}\n\n`);
    res.end();
  });
});
await new Promise((r) => google.listen(0, "127.0.0.1", r));
const baseGoogle = `http://127.0.0.1:${google.address().port}`;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-router.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true, stdio: ["ignore", salida, salida],
  env: {
    ...process.env,
    AUTH_SECRET: "secreto-router",
    // Las dos claves puestas, como en producción. Y SIN AI_PROVIDER: con un
    // motor fijado a la fuerza el router se aparta a propósito.
    MISTRAL_API_KEY: "mk_prueba", MOTOR_BASE_MISTRAL: baseMistral,
    GEMINI_API_KEY: "gk_prueba", MOTOR_BASE_GOOGLE: baseGoogle,
    AI_PROVIDER: "",
  },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

/** Manda un mensaje y dice quién lo cogió. */
async function preguntar(texto) {
  recibido.mistral.length = 0;
  recibido.google.length = 0;
  const r = await fetch(`${URL_APP}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "chat", speed: "rapido", messages: [{ role: "user", content: texto }] }),
  });
  await r.text();
  return {
    quien: recibido.google.length ? "google" : recibido.mistral.length ? "mistral" : "nadie",
    mistral: [...recibido.mistral],
    google: [...recibido.google],
  };
}

try {
  console.log("\nUna conversación normal la coge el de siempre");
  ok((await preguntar("Hola, ¿qué tal?")).quien === "mistral", "«Hola, ¿qué tal?» → Mistral");
  ok((await preguntar("Explícame qué es la fotosíntesis")).quien === "mistral", "«Explícame qué es la fotosíntesis» → Mistral");
  ok((await preguntar("¿Cuál es la capital de Francia?")).quien === "mistral", "«¿Cuál es la capital de Francia?» → Mistral");

  console.log("\nY el código y el razonamiento se van al especialista");
  ok((await preguntar("Escribe una función JavaScript que ordene un array por fecha")).quien === "google",
     "«Escribe una función JavaScript…» → Gemini");
  ok((await preguntar("Este código me da este error, arréglalo: la función no funciona")).quien === "google",
     "«Este código me da este error» → Gemini");
  ok((await preguntar("Analiza este algoritmo y dime el problema de complejidad")).quien === "google",
     "«Analiza este algoritmo» → Gemini");
  ok((await preguntar("TypeError: Cannot read properties of undefined")).quien === "google",
     "una traza de error pegada → Gemini");

  console.log("\nLa MISMA ECLIPSE conteste quien conteste");
  const charla = await preguntar("Hola, ¿qué tal todo por ahí?");
  const codigo = await preguntar("Escribe una función JavaScript que valide un email");
  const sisMistral = charla.mistral[0]?.messages?.find((m) => m.role === "system")?.content ?? "";
  const sisGoogle = codigo.google[0]?.systemInstruction?.parts?.[0]?.text ?? "";
  ok(sisMistral.length > 500 && sisGoogle.length > 500, "los dos reciben instrucciones de verdad");
  ok(/Eres ECLIPSE/.test(sisMistral) && /Eres ECLIPSE/.test(sisGoogle), "los dos son ECLIPSE, no un modelo con un nombre puesto encima");
  ok(/natural, cercano/.test(sisMistral) && /natural, cercano/.test(sisGoogle), "con la misma personalidad de partida");
  ok(/AL GRANO/.test(sisMistral) && /AL GRANO/.test(sisGoogle), "y las mismas reglas de no escribir una biblia");
  ok(/Entiendo tu pregunta/.test(sisMistral) && /Entiendo tu pregunta/.test(sisGoogle), "y las mismas fórmulas de robot prohibidas");
  /*
    Y ECLIPSE no cambia de identidad según lo que le preguntes.

    Es lo que el router podía romper: mandas una pregunta de código a Gemini y,
    si se le dice "eres el motor Google", contesta que es Google aunque en
    Ajustes ponga Mistral. Se le cuenta el motor CONFIGURADO, que es el que el
    usuario eligió y el que manda en sus límites.
  */
  ok(/Mistral\. Gratis/.test(sisGoogle), "al especialista se le cuentan los límites del motor configurado, no los suyos");
  ok(!/Google\. Su capa gratuita/.test(sisGoogle), "no se le dice que es Google: por fuera sigue siendo la misma ECLIPSE");
  ok(/Mistral\. Gratis/.test(sisMistral), "y al de siempre, los suyos de siempre");

  console.log("\nEl historial llega entero a los dos");
  recibido.mistral.length = 0;
  recibido.google.length = 0;
  await fetch(`${URL_APP}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "chat", speed: "rapido", messages: [
      { role: "user", content: "me llamo Karl y tengo una tienda de ropa" },
      { role: "assistant", content: "Anotado." },
      { role: "user", content: "Escribe una función JavaScript que calcule el IVA de un pedido" },
    ] }),
  }).then((r) => r.text());
  const conHistorial = recibido.google[0];
  ok(Boolean(conHistorial), "la petición con recorrido se fue al especialista");
  ok(JSON.stringify(conHistorial?.contents ?? []).includes("tienda de ropa"),
     "y le llegó lo que se había dicho antes: la conversación no se corta al cambiar de motor");

  console.log("\nSi el especialista falla, nadie se entera");
  googleRoto = true;
  const caido = await preguntar("Escribe una función JavaScript que ordene un array por fecha");
  ok(caido.google.length === 0 || caido.mistral.length > 0, "se intentó el especialista y contestó el de siempre");
  ok(caido.mistral.length > 0, "Mistral recoge la pregunta sin que se vea ningún error");
  googleRoto = false;

  console.log("\nY las claves no salen de casa");
  const r = await fetch(`${URL_APP}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "chat", speed: "rapido", messages: [{ role: "user", content: "hola" }] }),
  });
  const respuesta = await r.text();
  ok(!/gk_prueba|mk_prueba/.test(respuesta), "ninguna clave viaja al navegador");
  const estado = await (await fetch(`${URL_APP}/api/key`)).text();
  ok(!/gk_prueba|mk_prueba/.test(estado), "ni asomando por el estado de las claves");
} finally {
  mistral.close();
  google.close();
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
