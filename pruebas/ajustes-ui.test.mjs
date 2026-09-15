// Los Ajustes nuevos, en un móvil de verdad: la foto de perfil, el interruptor
// de la memoria, cambiar la contraseña y borrar la cuenta entera.
//
// Lo último es lo que más importa comprobar así: "borrar mi cuenta" tiene que
// borrar de verdad, y eso no se ve mirando el código, se ve preguntando después
// si sigue ahí.
import { spawn } from "node:child_process";
import { createServer as unPuerto } from "node:net";
import { readFileSync, existsSync, unlinkSync, openSync } from "node:fs";
import { RAIZ, abrirNavegador } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const puertoRedis = `${AQUI}redis-ajustes.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-ajustes.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true, stdio: ["ignore", salida, salida],
  env: {
    ...process.env,
    UPSTASH_REDIS_REST_URL: urlRedis, UPSTASH_REDIS_REST_TOKEN: "t",
    AUTH_SECRET: "secreto-ajustes",
  },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const correo = `ajustes${Date.now()}@ejemplo.com`;

const abrirAjustes = async () => {
  await p.locator("header button, nav button").first().click();
  await p.waitForTimeout(600);
  const b = p.getByRole("button", { name: /Ajustes/ }).first();
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await p.waitForTimeout(1200);
};

try {
  await p.goto(URL_APP, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /entrar|empezar|probar/i }).first().click().catch(() => {});
  await p.waitForTimeout(1200);
  await p.getByPlaceholder(/Tu nombre, o como prefieras/i).fill("Karl");
  await p.getByPlaceholder("tucorreo@ejemplo.com").fill(correo);
  await p.getByPlaceholder(/8 caracteres/i).fill("eclipse2026");
  await p.getByRole("button", { name: "Crear cuenta" }).click();
  await p.waitForTimeout(2500);
  const cartel = p.getByRole("button", { name: "Ahora no" });
  if (await cartel.count()) await cartel.first().click().catch(() => {});

  console.log("\nEl perfil, lo primero de Ajustes");
  await abrirAjustes();
  ok(await p.getByText("Tu perfil").isVisible(), "hay un sitio para tu perfil, y está arriba del todo");

  await p.getByRole("dialog", { name: "Ajustes" }).locator('input[type="file"]').setInputFiles(`${AQUI}origen.png`);
  await p.waitForTimeout(2500);
  const guardada = await p.evaluate(() => fetch("/api/auth").then((r) => r.json()));
  ok(typeof guardada.foto === "string" && guardada.foto.startsWith("data:image/jpeg"),
     "la foto se guarda en la cuenta, ya recortada y en JPEG");
  ok(guardada.foto.length < 300_000,
     `y encogida antes de subirla: ${Math.round(guardada.foto.length / 1024)} KB en vez de la foto entera`);
  ok(await p.locator("img[alt='']").first().isVisible(), "y se ve puesta");
  await p.screenshot({ path: `${AQUI}aj1-perfil.png` });

  console.log("\nLa memoria, con interruptor");
  ok(await p.getByText("Que se acuerde de mí").isVisible(), "se puede encender y apagar");
  ok((await p.evaluate(() => fetch("/api/memoria").then((r) => r.json()))).activa === true,
     "de fábrica viene encendida, como pidió Carlos");

  await p.getByText("Que se acuerde de mí").click();
  await p.waitForTimeout(1500);
  const apagada = await p.evaluate(() => fetch("/api/memoria").then((r) => r.json()));
  ok(apagada.activa === false, "al apagarla, queda apagada de verdad en el servidor");
  ok(await p.getByText(/no usa nada de lo que sabía ni aprende nada nuevo/).isVisible(),
     "y se dice qué significa eso, que es lo que nadie explica nunca");

  console.log("\nSeguridad");
  ok(await p.getByRole("button", { name: "Cambiar la contraseña" }).isVisible(), "se puede cambiar la contraseña");
  await p.getByRole("button", { name: "Cambiar la contraseña" }).click();
  await p.waitForTimeout(400);
  await p.getByPlaceholder("La contraseña de ahora").fill("la-que-no-es-2026");
  await p.getByPlaceholder(/La nueva/).fill("eclipse2027nuevo");
  await p.getByRole("button", { name: /Cambiar la contraseña/ }).last().click();
  await p.waitForTimeout(1500);
  ok(await p.getByText("La contraseña de ahora no es esa.").isVisible(),
     "con la contraseña vieja equivocada no se cambia: si no, un móvil desbloqueado es la cuenta de alguien");

  await p.getByPlaceholder("La contraseña de ahora").fill("eclipse2026");
  await p.getByRole("button", { name: /Cambiar la contraseña/ }).last().click();
  await p.waitForTimeout(2000);
  const conNueva = await p.evaluate((c) =>
    fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signin", email: c, password: "eclipse2027nuevo" }) }).then((r) => r.status), correo);
  ok(conNueva === 200, "y con la buena, la nueva contraseña entra");
  await p.screenshot({ path: `${AQUI}aj2-seguridad.png` });

  console.log("\nIrse del todo");
  await p.getByRole("button", { name: "Borrar mi cuenta" }).click();
  await p.waitForTimeout(400);
  ok(await p.getByText(/No se puede deshacer/).isVisible(), "se avisa de que no tiene vuelta atrás");
  ok(await p.getByText(/nunca han salido de este móvil/).isVisible(),
     "y se recuerda que las conversaciones nunca estuvieron en el servidor");

  await p.getByPlaceholder(/Escribe tu contraseña/).fill("eclipse2027nuevo");
  await p.getByRole("button", { name: /Borrar mi cuenta y todo lo mío/ }).click();
  await p.waitForTimeout(3000);

  const despues = await fetch(`${URL_APP}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "signin", email: correo, password: "eclipse2027nuevo" }),
  });
  ok(despues.status !== 200, `la cuenta ya no existe: entrar con ella se rechaza (${despues.status})`);
} finally {
  await ctx.close().catch(() => {});
  await navegador.close().catch(() => {});
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
  redis.kill();
  if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
