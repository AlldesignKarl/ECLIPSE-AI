// El eclipse de fondo: que se vea DENTRO del chat de grupo y en ningún otro
// sitio, que es como lo pidió Carlos.
//
// Esta prueba no mira el CSS: hace una foto de la pantalla y cuenta píxeles. La
// primera vez el fondo estaba bien escrito y no se veía en ninguna parte —lo
// tapaba el negro de la aplicación, que va encima—, y eso en el código no se
// nota. En la pantalla sí, y la pantalla es la que cuenta.
import { spawn } from "node:child_process";
import { createServer as unPuerto } from "node:net";
import { readFileSync, existsSync, unlinkSync, openSync } from "node:fs";
import { RAIZ, abrirNavegador } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const puertoRedis = `${AQUI}redis-fondo.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-fondo.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true, stdio: ["ignore", salida, salida],
  env: {
    ...process.env,
    UPSTASH_REDIS_REST_URL: urlRedis, UPSTASH_REDIS_REST_TOKEN: "t",
    AUTH_SECRET: "secreto-fondo", PRO_ACCESS_CODE: "ECLIPSE-PRO",
  },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const navegador = await abrirNavegador();
// En oscuro, que es donde va el fondo y como lo tiene Carlos en el móvil.
const ctx = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
});
const p = await ctx.newPage();

/**
 * El brillo medio de un cuadradito de la pantalla.
 *
 * Es lo único que hace falta para saber si un fondo está puesto: el eclipse es
 * claro en el centro y negro en los bordes. Si no está, todo es el mismo negro.
 */
const brillo = async (x, y) => {
  const b = await p.screenshot({ clip: { x, y, width: 24, height: 24 } });
  return await p.evaluate(async (datos) => {
    const img = new Image();
    img.src = "data:image/png;base64," + datos;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let suma = 0;
    for (let i = 0; i < d.length; i += 4) suma += (d[i] + d[i + 1] + d[i + 2]) / 3;
    return suma / (d.length / 4);
  }, b.toString("base64"));
};

try {
  console.log("\nLa imagen existe y pesa poco");
  const r = await fetch(`${URL_APP}/fondo.webp`);
  const bytes = (await r.arrayBuffer()).byteLength;
  ok(r.ok, "el fondo se sirve");
  ok(bytes < 60_000, `y pesa poco: ${(bytes / 1024).toFixed(1)} KB (un móvil con datos no espera por un fondo)`);

  console.log("\nEn el chat normal NO va: ahí manda la conversación");
  await p.goto(URL_APP, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /entrar|empezar|probar/i }).first().click().catch(() => {});
  await p.waitForTimeout(1200);
  await p.getByPlaceholder(/Tu nombre, o como prefieras/i).fill("Karl");
  await p.getByPlaceholder("tucorreo@ejemplo.com").fill(`fondo${Date.now()}@ejemplo.com`);
  await p.getByPlaceholder(/8 caracteres/i).fill("eclipse2026");
  await p.getByRole("button", { name: "Crear cuenta" }).click();
  await p.waitForTimeout(2500);
  const cartel = p.getByRole("button", { name: "Ahora no" });
  if (await cartel.count()) await cartel.first().click().catch(() => {});
  await p.evaluate(() => fetch("/api/pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "ECLIPSE-PRO" }) }));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);

  // Abajo del todo, lejos del logo de bienvenida, que ese sí brilla solo.
  const chatCentro = await brillo(183, 600);
  const chatBorde = await brillo(2, 600);
  ok(Math.abs(chatCentro - chatBorde) < 3,
     `el chat de uno sigue negro y liso (centro ${chatCentro.toFixed(1)}, borde ${chatBorde.toFixed(1)})`);
  await p.screenshot({ path: `${AQUI}fo1-chat-sin-fondo.png` });

  console.log("\nY en el grupo SÍ");
  await p.locator("header button, nav button").first().click();
  await p.waitForTimeout(700);
  const entrada = p.getByRole("button", { name: /Grupos/ }).first();
  await entrada.scrollIntoViewIfNeeded();
  await entrada.click();
  await p.waitForTimeout(1200);
  await p.getByPlaceholder(/El viaje, Los del piso/i).fill("La cuadrilla");
  await p.getByRole("button", { name: "Crear", exact: true }).click();
  await p.waitForTimeout(2000);
  await p.getByText("La cuadrilla").first().click();
  await p.waitForTimeout(2000);

  // Dentro del panel del grupo: el centro del eclipse contra una esquina suya.
  const caja = await p.locator('[role="dialog"]').first().boundingBox();
  ok(!!caja, "el chat del grupo está abierto");
  // El anillo del eclipse cae en el medio del panel. Se compara esa franja con
  // un trozo del mismo alto pero pegado al lado derecho, que ahí es negro.
  const cx = Math.round(caja.x + caja.width / 2) - 12;
  const cy = Math.round(caja.y + caja.height / 2) - 12;
  const grupoCentro = await brillo(cx - 45, cy);
  const grupoBorde = await brillo(Math.round(caja.x + caja.width) - 40, cy);
  ok(grupoCentro > grupoBorde + 4,
     `el eclipse se ve en el grupo: el anillo (${grupoCentro.toFixed(1)}) contra el fondo de al lado (${grupoBorde.toFixed(1)})`);
  await p.screenshot({ path: `${AQUI}fo2-grupo.png` });

  console.log("\nY en tema claro no, que sería texto oscuro sobre negro");
  await p.evaluate(() => document.documentElement.setAttribute("data-tema", "claro"));
  await p.waitForTimeout(600);
  const claro = await brillo(cx, cy);
  ok(claro > 180, `en tema claro el panel del grupo sigue claro (${claro.toFixed(1)})`);
  await p.screenshot({ path: `${AQUI}fo3-claro.png` });
} finally {
  await ctx.close().catch(() => {});
  await navegador.close().catch(() => {});
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
  redis.kill();
  if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
