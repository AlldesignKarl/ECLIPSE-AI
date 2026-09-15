// El ritmo, en la aplicación de verdad: un motor que suelta 1.500 caracteres de
// un golpe, y se mide cuánto texto hay en pantalla a lo largo del tiempo.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as unPuerto } from "node:net";
import { openSync } from "node:fs";
import { RAIZ, abrirNavegador } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const PARRAFO =
  "Los rascacielos de la foto forman el conjunto conocido como Cuatro Torres Business Area, en el norte de Madrid. " +
  "Se levantaron sobre los antiguos terrenos de la Ciudad Deportiva del Real Madrid y se inauguraron entre 2007 y 2009. ".repeat(6);

// Un Groq de mentira que escupe todo el párrafo en un solo trozo.
const motor = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    if (req.url.includes("/models")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ data: [{ id: "llama-3.3-70b-versatile" }] }));
    }
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: PARRAFO } }] })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });
});
await new Promise((r) => motor.listen(0, "127.0.0.1", r));
const baseMotor = `http://127.0.0.1:${motor.address().port}`;

// El conector de Groq apunta a una dirección fija, así que para esta prueba se
// redirige desde el propio navegador no: se redirige en el servidor, con la
// variable que ya existe para las conexiones... que aquí no vale. Se usa el
// truco de siempre: un proxy que el servidor ve como Groq.
process.env.GROQ_BASE = baseMotor;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-ritmo.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true, stdio: ["ignore", salida, salida],
  env: { ...process.env, GROQ_API_KEY: "gsk_prueba" },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errores = [];
p.on("pageerror", (e) => errores.push(String(e)));

try {
  // El chat habla con /api/chat; se intercepta ahí y se sirve el SSE nuestro,
  // que es lo que de verdad hay que medir: el ritmo lo pone el navegador.
  await p.route("**/api/chat", async (ruta) => {
    const trozos = [
      `data: ${JSON.stringify({ t: "status", v: "escribiendo" })}\n\n`,
      `data: ${JSON.stringify({ t: "text", v: PARRAFO })}\n\n`,
      `data: ${JSON.stringify({ t: "done" })}\n\n`,
    ].join("");
    await ruta.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: trozos });
  });

  await p.goto(URL_APP, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /entrar|empezar|probar/i }).first().click().catch(() => {});
  await p.waitForTimeout(1500);
  const saltar = p.getByRole("button", { name: /Entrar sin cuenta/i });
  if (await saltar.count()) await saltar.click();
  await p.waitForTimeout(1200);

  const caja = p.getByPlaceholder(/Pregunta lo que quieras/i);
  await caja.fill("¿Dónde están estos rascacielos?");

  // Medir el texto en pantalla cada 100 ms desde que se envía.
  const medir = p.evaluate(async () => {
    const t0 = performance.now();
    const muestras = [];
    for (let i = 0; i < 80; i++) {
      const burbujas = [...document.querySelectorAll("article, [data-rol='assistant'], main div")]
        .map((e) => e.textContent || "");
      const largo = Math.max(0, ...burbujas.map((t) => (t.includes("rascacielos de la foto") ? t.length : 0)));
      muestras.push({ ms: Math.round(performance.now() - t0), largo });
      await new Promise((r) => setTimeout(r, 100));
    }
    return muestras;
  });

  await p.getByRole("button", { name: /enviar|send/i }).first().click().catch(async () => {
    await caja.press("Enter");
  });

  const muestras = await medir;
  const conTexto = muestras.filter((m) => m.largo > 0);
  const primera = conTexto[0];
  // Cuándo DEJA de crecer, no la última muestra de la ventana: la ventana dura
  // ocho segundos y medirla entera diría que tarda ocho segundos siempre.
  const maximo = Math.max(...conTexto.map((m) => m.largo));
  const ultima = conTexto.find((m) => m.largo >= maximo);
  const hasta = conTexto.indexOf(ultima);
  const crecimiento = conTexto
    .slice(0, hasta + 1)
    .filter((m, i) => i > 0 && m.largo > conTexto[i - 1].largo).length;

  console.log("\nComo se ve en pantalla");
  console.log(`  el texto crece: ${conTexto.slice(0, hasta + 1).map((m) => m.largo).join(" → ")}`);

  ok(Boolean(primera), "la respuesta aparece");
  ok(crecimiento >= 4, `no aparece de golpe: crece en ${crecimiento} medidas distintas`);
  const duracion = ultima.ms - primera.ms;
  ok(duracion > 700, `tarda en escribirse (${duracion} ms desde la primera letra)`);
  ok(duracion < 6000, `pero termina en un tiempo razonable (${Math.round((maximo / duracion) * 1000)} caracteres por segundo)`);
  ok(ultima.largo >= PARRAFO.length * 0.9, `acaba con el texto entero (${ultima.largo} de ${PARRAFO.length})`);
  ok(errores.length === 0, `sin errores de JavaScript (${errores.slice(0, 2).join(" | ")})`);
} finally {
  await navegador.close();
  motor.close();
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
