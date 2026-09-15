// Las quedadas en un móvil de verdad: elegir día en el calendario, poner de qué
// va, caer dentro del chat, mandar una foto y borrar lo que sobre.
//
// Una quedada es un grupo con fecha, así que esta prueba comprueba de paso lo
// que se le ha añadido a los grupos: fotos, borrar mensajes y borrar el grupo.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as unPuerto } from "node:net";
import { readFileSync, existsSync, unlinkSync, openSync } from "node:fs";
import { RAIZ, abrirNavegador } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const motor = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    if (req.url.includes("/models")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ data: [{ id: "llama-3.3-70b-versatile" }] }));
    }
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Os propongo quedar a las ocho." } }] })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });
});
await new Promise((r) => motor.listen(0, "127.0.0.1", r));
const baseMotor = `http://127.0.0.1:${motor.address().port}`;

const puertoRedis = `${AQUI}redis-quedadas.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-quedadas.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true, stdio: ["ignore", salida, salida],
  env: {
    ...process.env,
    UPSTASH_REDIS_REST_URL: urlRedis, UPSTASH_REDIS_REST_TOKEN: "t",
    AUTH_SECRET: "secreto-quedadas", PRO_ACCESS_CODE: "ECLIPSE-PRO",
    GROQ_API_KEY: "gsk_prueba", AI_PROVIDER: "groq", MOTOR_BASE_GROQ: baseMotor,
  },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();

try {
  await p.goto(URL_APP, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /entrar|empezar|probar/i }).first().click().catch(() => {});
  await p.waitForTimeout(1200);
  await p.getByPlaceholder(/Tu nombre, o como prefieras/i).fill("Karl");
  await p.getByPlaceholder("tucorreo@ejemplo.com").fill(`quedada${Date.now()}@ejemplo.com`);
  await p.getByPlaceholder(/8 caracteres/i).fill("eclipse2026");
  await p.getByRole("button", { name: "Crear cuenta" }).click();
  await p.waitForTimeout(2500);
  const cartel = p.getByRole("button", { name: "Ahora no" });
  if (await cartel.count()) await cartel.first().click().catch(() => {});
  await p.evaluate(() => fetch("/api/pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "ECLIPSE-PRO" }) }));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);

  console.log("\nProgramar abre en Quedadas, con su calendario");
  await p.locator("header button, nav button").first().click();
  await p.waitForTimeout(700);
  const entrada = p.getByRole("button", { name: /Programar/ }).first();
  await entrada.scrollIntoViewIfNeeded();
  await entrada.click();
  await p.waitForTimeout(1500);

  ok(await p.getByRole("button", { name: "Quedadas" }).isVisible(), "hay una pestaña de quedadas");
  ok(await p.getByRole("button", { name: "Encargos" }).isVisible(), "y los encargos siguen ahí, no se han perdido");
  const dias = await p.locator(".grid.grid-cols-7 button").count();
  ok(dias >= 28, `el calendario del mes se ve entero (${dias} días)`);
  await p.screenshot({ path: `${AQUI}qu1-calendario.png` });

  console.log("\nElegir día y quedar");
  // Un día del mes que no sea el 1: se busca por su número.
  await p.locator(".grid.grid-cols-7 button").nth(20).click();
  await p.waitForTimeout(500);
  await p.getByPlaceholder(/Cena en casa de Ana/i).fill("Cena en casa de Ana, traed postre");
  await p.getByRole("button", { name: "Quedar" }).click();
  await p.waitForTimeout(3000);

  ok(await p.getByText("Cena en casa de Ana, traed postre").first().isVisible(),
     "al crearla entra directo en su chat, con la nota arriba");
  const conFecha = await p.evaluate(() => document.body.innerText);
  ok(/lunes|martes|miércoles|jueves|viernes|sábado|domingo/i.test(conFecha),
     "y con el día escrito en cristiano, que es la mitad de una quedada");
  ok(await p.getByRole("button", { name: /Invitar/ }).first().isVisible(), "se puede compartir para que entren los demás");
  await p.screenshot({ path: `${AQUI}qu2-chat.png` });

  console.log("\nUna foto en la quedada");
  await p.locator('input[type="file"]').last().setInputFiles(`${AQUI}origen.png`);
  await p.waitForTimeout(4000);
  const fotos = await p.locator("img[alt='']").count();
  ok(fotos >= 1, `la foto se ve en el chat (${fotos})`);
  const guardado = await p.evaluate(() => fetch("/api/grupos").then((r) => r.json()));
  ok((guardado.grupos ?? []).some((g) => g.fecha), "y la quedada está guardada con su día");
  await p.screenshot({ path: `${AQUI}qu3-foto.png` });

  console.log("\nBorrar lo que sobra");
  // La foto es el único mensaje que hay: se toca y tiene que salir el «Borrar».
  await p.locator("img[alt='']").last().click().catch(() => {});
  await p.waitForTimeout(600);
  const hayBorrar = await p.getByRole("button", { name: "Borrar" }).count();
  ok(hayBorrar > 0, "tocando tu propio mensaje sale «Borrar»");
  if (hayBorrar) {
    await p.getByRole("button", { name: "Borrar" }).first().click();
    await p.waitForTimeout(2500);
    ok((await p.locator("img[alt='']").count()) === 0, "y al borrarlo desaparece, no se queda de adorno");
  }

  console.log("\nY borrar la quedada entera");
  await p.getByRole("button", { name: "Quién está" }).first().click();
  await p.waitForTimeout(700);
  ok(await p.getByRole("button", { name: /Borrar el grupo/ }).isVisible(),
     "quien la creó puede borrarla: un sitio del que no se puede salir no es un sitio");
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: /Borrar el grupo/ }).click();
  await p.waitForTimeout(3000);
  const despues = await p.evaluate(() => fetch("/api/grupos").then((r) => r.json()));
  ok((despues.grupos ?? []).length === 0, "y desaparece de verdad, con sus mensajes y sus fotos");
} finally {
  await ctx.close().catch(() => {});
  await navegador.close().catch(() => {});
  motor.close();
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
  redis.kill();
  if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
