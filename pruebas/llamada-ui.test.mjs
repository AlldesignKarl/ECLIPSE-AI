// La llamada en un navegador de verdad: que se abra, que pida el micrófono,
// que hable en alto lo que contesta el modelo, y que al colgar quede guardada.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as unPuerto } from "node:net";
import { openSync } from "node:fs";
import { RAIZ, abrirNavegador } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Un motor de mentira que contesta como en una llamada.
let ultimoCuerpo = null;
const motor = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    if (req.url.includes("/models")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ data: [{ id: "llama-3.3-70b-versatile" }] }));
    }
    ultimoCuerpo = JSON.parse(c || "{}");
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Son las Cuatro Torres, en Madrid." } }] })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });
});
await new Promise((r) => motor.listen(0, "127.0.0.1", r));

const PUERTO = await new Promise((r) => { const s = unPuerto(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true,
  stdio: ["ignore", openSync(`${AQUI}app-llamada.log`, "w"), openSync(`${AQUI}app-llamada.log`, "a")],
  env: { ...process.env, GROQ_API_KEY: "gsk_prueba", AI_PROVIDER: "groq", MOTOR_BASE_GROQ: `http://127.0.0.1:${motor.address().port}` },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const b = await abrirNavegador();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ["microphone"] });
const p = await ctx.newPage();
const errores = [];
p.on("pageerror", (e) => errores.push(e.message.slice(0, 160)));

try {
  // El navegador sin cabeza no trae reconocimiento de voz ni voz: se ponen de
  // mentira ANTES de cargar nada, que es lo que hace la prueba posible.
  await p.addInitScript(() => {
    window.__dicho = [];
    class Rec {
      constructor() { window.__rec = this; this.continuous = true; this.interimResults = true; }
      start() { window.__escuchando = true; }
      stop() { window.__escuchando = false; this.onend?.(); }
      abort() { window.__escuchando = false; }
    }
    window.SpeechRecognition = Rec;
    const voz = window.speechSynthesis;
    voz.speak = (u) => { window.__dicho.push(u.text); setTimeout(() => u.onend?.(), 5); };
    voz.cancel = () => { window.__cancelado = (window.__cancelado ?? 0) + 1; };
    voz.getVoices = () => [];
  });

  await p.goto(URL_APP, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /entrar|empezar|probar/i }).first().click().catch(() => {});
  await p.waitForTimeout(1500);
  const saltar = p.getByRole("button", { name: /Entrar sin cuenta/i });
  if (await saltar.count()) await saltar.click();
  await p.waitForTimeout(1200);

  console.log("\nDescolgar");
  await p.getByRole("button", { name: "Llamar a ECLIPSE" }).click();
  await p.waitForTimeout(1200);
  ok(await p.getByText("Te escucho").count() > 0, "se abre la llamada y dice que te escucha");
  ok(await p.evaluate(() => window.__escuchando === true), "y el micrófono está abierto de verdad");
  await p.screenshot({ path: AQUI + "ll1-escuchando.png" });

  console.log("\nHablar");
  await p.evaluate(() => {
    window.__rec.onresult({ resultIndex: 0, results: Object.assign([[{ transcript: "¿dónde están estos rascacielos?" }]], { length: 1, 0: Object.assign([{ transcript: "¿dónde están estos rascacielos?" }], { isFinal: true, length: 1 }) }) });
  });
  await p.waitForTimeout(600);
  await p.screenshot({ path: AQUI + "ll2-oyendo.png" });
  // Pasa el silencio y se cierra el turno.
  await p.waitForTimeout(2500);
  ok(await p.evaluate(() => (window.__dicho ?? []).length > 0), `contesta en alto (${JSON.stringify(await p.evaluate(() => window.__dicho))})`);
  ok(/Cuatro Torres/.test((await p.evaluate(() => (window.__dicho ?? []).join(" "))) ?? ""), "y dice lo que contestó el motor");
  await p.screenshot({ path: AQUI + "ll3-hablando.png" });
  await p.getByRole("button", { name: "Ajustes de voz" }).click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: AQUI + "ll5-ajustes-voz.png" });
  await p.getByRole("button", { name: "Cerrar" }).last().click().catch(() => {});
  await p.waitForTimeout(400);

  console.log("\nLo que se le pide al motor");
  ok(ultimoCuerpo?.messages?.some((m) => m.role === "system" && /LLAMADA DE VOZ/.test(m.content)), "se le dice que es una llamada");
  ok(ultimoCuerpo?.messages?.some((m) => m.role === "system" && /sin listas/.test(m.content)), "y que no use listas ni títulos");

  console.log("\nColgar");
  await p.getByRole("button", { name: "Colgar" }).click();
  await p.waitForTimeout(1200);
  ok(await p.getByText("Te escucho").count() === 0, "la pantalla se cierra");
  ok(await p.evaluate(() => window.__escuchando === false), "y el micrófono se apaga");
  const guardada = await p.evaluate(() => {
    const c = JSON.parse(localStorage.getItem("eclipse.conversations.v1") ?? "[]");
    return c.find((x) => x.title === "Llamada")?.messages?.length ?? 0;
  });
  ok(guardada >= 2, `lo hablado queda guardado como conversación (${guardada} mensajes)`);
  await p.screenshot({ path: AQUI + "ll4-colgado.png" });

  ok(errores.length === 0, `sin errores de JavaScript (${errores.slice(0, 2).join(" | ")})`);
} finally {
  await b.close();
  motor.close();
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
