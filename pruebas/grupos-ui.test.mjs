// Los grupos en un navegador de verdad: que invitar esté a la vista, que el
// enlace lleve a una invitación que se entiende antes de aceptarla, y que el
// chat se lea cuando hablan varios.
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
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "El sábado por la mañana os viene bien a todos." } }] })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });
});
await new Promise((r) => motor.listen(0, "127.0.0.1", r));
const baseMotor = `http://127.0.0.1:${motor.address().port}`;

const puertoRedis = `${AQUI}redis-grupos-ui.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-grupos-ui.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true, stdio: ["ignore", salida, salida],
  env: {
    ...process.env,
    UPSTASH_REDIS_REST_URL: urlRedis, UPSTASH_REDIS_REST_TOKEN: "t",
    AUTH_SECRET: "secreto-grupos-ui", PRO_ACCESS_CODE: "ECLIPSE-PRO",
    GROQ_API_KEY: "gsk_prueba", MOTOR_BASE_GROQ: baseMotor,
  },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const navegador = await abrirNavegador();

/** Una persona: navegador propio, cuenta propia. */
async function persona(nombre, correo) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const p = await ctx.newPage();
  await p.goto(URL_APP, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /entrar|empezar|probar/i }).first().click().catch(() => {});
  await p.waitForTimeout(1200);
  await p.getByPlaceholder(/Tu nombre, o como prefieras/i).fill(nombre);
  await p.getByPlaceholder("tucorreo@ejemplo.com").fill(correo);
  await p.getByPlaceholder(/8 caracteres/i).fill("eclipse2026");
  await p.getByRole("button", { name: "Crear cuenta" }).click();
  await p.waitForTimeout(2500);
  const cartel = p.getByRole("button", { name: "Ahora no" });
  if (await cartel.count()) await cartel.first().click().catch(() => {});
  await p.waitForTimeout(400);
  return { ctx, p };
}

const abrirGrupos = async (p) => {
  await p.locator("header button, nav button").first().click();
  await p.waitForTimeout(700);
  const boton = p.getByRole("button", { name: /Grupos/ }).first();
  await boton.scrollIntoViewIfNeeded();
  await boton.click();
  await p.waitForTimeout(1200);
};

try {
  const sello = Date.now();
  const karl = await persona("Karl", `karl${sello}@ejemplo.com`);
  await karl.p.evaluate(() => fetch("/api/pro", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ code: "ECLIPSE-PRO" }) }));
  await karl.p.reload({ waitUntil: "networkidle" });
  await karl.p.waitForTimeout(1500);

  console.log("\nCrear el grupo");
  await abrirGrupos(karl.p);
  await karl.p.getByPlaceholder(/El viaje, Los del piso/i).fill("Quedadas");
  await karl.p.getByRole("button", { name: /^Crear/ }).first().click();
  await karl.p.waitForTimeout(1500);
  await karl.p.getByText("Quedadas", { exact: true }).first().click().catch(() => {});
  await karl.p.waitForTimeout(1200);

  console.log("\nInvitar está a la vista");
  const invitar = karl.p.getByRole("button", { name: /Invitar/ }).first();
  ok(await invitar.isVisible(), "hay un botón de Invitar sin tocar nada más");
  ok(
    await karl.p.getByText(/estás tú solo/i).isVisible(),
    "y estando solo se dice, con el botón grande al lado",
  );
  await karl.p.screenshot({ path: `${AQUI}gr1-solo.png` });

  // El enlace: se comparte por el móvil si se puede, y si no se copia.
  await invitar.click();
  await karl.p.waitForTimeout(800);
  const enlace = await karl.p.evaluate(() => navigator.clipboard.readText());
  ok(/\?grupo=/.test(enlace), `copia un enlace de invitación (${enlace.slice(0, 60)})`);

  console.log("\nA quien lo recibe se le dice a qué le invitan");
  const ana = await persona("Ana", `ana${sello}@ejemplo.com`);
  await ana.p.goto(enlace.replace(/^https?:\/\/[^/]+/, URL_APP), { waitUntil: "networkidle" });
  await ana.p.waitForTimeout(2500);
  ok(await ana.p.getByText("Te han invitado a un grupo").isVisible(), "el enlace abre la invitación solo");
  ok(await ana.p.getByText("Quedadas", { exact: true }).first().isVisible(), "con el nombre del grupo");
  ok(await ana.p.getByText(/1 persona/).isVisible(), "y cuánta gente hay dentro");
  // El correo de QUIEN INVITA no puede salir. El suyo propio, en su menú de
  // cuenta, es otra cosa: es el suyo.
  const enLaInvitacion = await ana.p.evaluate(() => document.body.innerText);
  ok(!enLaInvitacion.includes("karl"), "sin el correo de quien invita por ningún lado");
  await ana.p.screenshot({ path: `${AQUI}gr2-invitacion.png` });

  await ana.p.getByRole("button", { name: /Entrar en el grupo/ }).click();
  await ana.p.waitForTimeout(2500);
  ok(!(await ana.p.getByText("Te han invitado a un grupo").count()), "al aceptar, entra");
  ok(
    (await ana.p.url()).includes("?grupo=") === false,
    "y la invitación se quita de la dirección",
  );

  console.log("\nSe habla y se lee");
  await ana.p.getByPlaceholder(/Escribe al grupo/i).fill("Hola, ¿el sábado?");
  await ana.p.keyboard.press("Enter");
  await ana.p.waitForTimeout(2500);

  await karl.p.waitForTimeout(3500);
  ok(await karl.p.getByText("Hola, ¿el sábado?").isVisible(), "lo que escribe una le llega a la otra");
  ok(await karl.p.getByText("Ana", { exact: true }).first().isVisible(), "con su nombre");

  // Sin recargar nada: la cabecera se entera sola de que ha entrado alguien.
  const cabecera = await karl.p.locator("button").filter({ hasText: /^(AN|KA)+\s*\d$/ }).first().textContent().catch(() => "");
  ok(/2$/.test((cabecera ?? "").trim()), `la cabecera ya dice que son dos sin recargar ("${(cabecera ?? "").trim()}")`);

  await karl.p.getByPlaceholder(/Escribe al grupo/i).fill("ECLIPSE, ¿nos propones plan?");
  await karl.p.keyboard.press("Enter");
  await karl.p.waitForTimeout(4000);
  ok(await karl.p.getByText(/sábado por la mañana/).first().isVisible(), "y ECLIPSE contesta cuando le nombran");
  await karl.p.screenshot({ path: `${AQUI}gr3-chat.png` });

  // Las iniciales de cada uno, que es lo que hace legible un grupo.
  const iniciales = await karl.p.evaluate(() =>
    [...document.querySelectorAll("span")]
      .filter((e) => /^[A-ZÁÉÍÓÚÑ]{1,2}$/.test((e.textContent ?? "").trim()) && e.style.background)
      .map((e) => e.textContent.trim()),
  );
  ok(iniciales.length > 0, `cada persona tiene su inicial de color (${iniciales.join(", ")})`);

  await karl.ctx.close();
  await ana.ctx.close();
} finally {
  await navegador.close();
  motor.close();
  redis.kill("SIGKILL");
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
