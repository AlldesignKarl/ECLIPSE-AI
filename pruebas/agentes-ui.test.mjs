// La ficha de un agente en un móvil de verdad: que DIGA cómo se conecta lo que
// le falta, y que el botón lleve a donde se hace.
//
// Esto nace de un fallo que Carlos encontró en cinco minutos: la ficha decía
// «no está conectado a Google» y no había por ninguna parte cómo conectarlo.
// Una pantalla que te dice lo que te falta y no te dice cómo conseguirlo es
// peor que no decir nada: te deja mirando.
import { spawn } from "node:child_process";
import { readFileSync, existsSync, unlinkSync, openSync } from "node:fs";
import { createServer as unPuerto } from "node:net";
import { crear, ESPERADO } from "./apis-falsas.mjs";
import { RAIZ, abrirNavegador } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const apis = crear();
await new Promise((r) => apis.listen(0, "127.0.0.1", r));
const baseApis = `http://127.0.0.1:${apis.address().port}`;

const puertoRedis = `${AQUI}redis-agentes-ui.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-agentes-ui.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true, stdio: ["ignore", salida, salida],
  env: {
    ...process.env,
    UPSTASH_REDIS_REST_URL: urlRedis, UPSTASH_REDIS_REST_TOKEN: "t",
    AUTH_SECRET: "secreto-agentes-ui", PRO_ACCESS_CODE: "ECLIPSE-PRO",
    CONEXION_BASE_NOTION: baseApis,
    // Google configurado: así la ficha de Gmail ofrece el botón de permiso en
    // vez de decir que este servidor no lo tiene puesto.
    GOOGLE_OAUTH_ID: "id-de-mentira", GOOGLE_OAUTH_SECRET: "secreto-de-mentira",
  },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errores = [];
p.on("pageerror", (e) => errores.push(String(e)));

try {
  await p.goto(URL_APP, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /entrar|empezar|probar/i }).first().click().catch(() => {});
  await p.waitForTimeout(1200);
  await p.getByPlaceholder(/Tu nombre, o como prefieras/i).fill("Karl");
  await p.getByPlaceholder("tucorreo@ejemplo.com").fill(`ag${Date.now()}@ejemplo.com`);
  await p.getByPlaceholder(/8 caracteres/i).fill("eclipse2026");
  await p.getByRole("button", { name: "Crear cuenta" }).click();
  await p.waitForTimeout(2500);
  const cartel = p.getByRole("button", { name: "Ahora no" });
  if (await cartel.count()) await cartel.first().click().catch(() => {});
  await p.evaluate(() => fetch("/api/pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "ECLIPSE-PRO" }) }));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);

  const abrirAgentes = async () => {
    // El menú lateral se queda abierto al cerrar un modal, y entonces el botón
    // de la hamburguesa está tapado por el propio menú. Se mira si ya está.
    const entrada = p.getByRole("button", { name: /Agentes/ }).first();
    // El menú lateral está SIEMPRE en el árbol: cerrado se aparta fuera de la
    // pantalla. Por eso no vale preguntar si se ve, hay que mirar dónde está.
    const donde = await entrada.boundingBox().catch(() => null);
    if (!donde || donde.x < 0) {
      await p.locator("header button, nav button").first().click();
      await p.waitForTimeout(700);
    }
    await entrada.scrollIntoViewIfNeeded();
    await entrada.click();
    await p.waitForTimeout(1600);
  };

  console.log("\nLa ficha del agente del correo");
  await abrirAgentes();
  await p.getByText("ECLIPSE INBOX").first().click();
  await p.waitForTimeout(1500);

  ok(await p.getByText("Qué hay que conectarle").isVisible(),
     "la ficha tiene un apartado de qué hay que conectarle, no solo un punto rojo");
  const texto = await p.evaluate(() => document.body.innerText);
  ok(/con tu cuenta de Google/i.test(texto),
     "y dice CÓMO se conecta Gmail, que era justo lo que no aparecía por ninguna parte");
  ok(/Incluido/i.test(texto), "el agente incluido en Pro no se anuncia como «0 €»");
  await p.screenshot({ path: `${AQUI}ag1-inbox.png` });

  const botonGmail = p.getByRole("button", { name: /Conectar Gmail con Google/ }).first();
  ok(await botonGmail.isVisible(), "y hay un botón para conectarlo, ahí mismo");

  console.log("\nY el botón lleva a donde se hace");
  await botonGmail.click();
  await p.waitForTimeout(1800);
  ok(await p.getByRole("heading", { name: "Conexiones" }).first().isVisible().catch(() => false)
     || /Conexiones/.test(await p.evaluate(() => document.body.innerText)),
     "se abre Conexiones");
  const enConexiones = await p.evaluate(() => document.body.innerText);
  ok(/cómo se conecta/i.test(enConexiones),
     "con la ficha de Gmail ya ABIERTA: sus pasos delante, sin buscarla entre veintidós");
  ok(/Pulsa «Conectar con Google»/.test(enConexiones), "y con los pasos de Gmail, no los de otro");
  ok(await p.getByRole("link", { name: "Conectar con Google" }).first().isVisible(),
     "y el botón de permiso de Google, que es todo lo que hay que hacer");
  await p.screenshot({ path: `${AQUI}ag2-gmail.png` });

  console.log("\nUn agente de los de clave dice otra cosa distinta");
  // Se recarga en vez de ir cerrando a mano: así cada tramo empieza limpio y un
  // modal que se quedó abierto no se cuela como un fallo de lo que se prueba.
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await abrirAgentes();
  await p.getByText("ECLIPSE SUPPORT").first().click();
  await p.waitForTimeout(1500);
  const soporte = await p.evaluate(() => document.body.innerText);
  ok(/Te va a pedir:/i.test(soporte),
     "a los de clave les dice qué te van a pedir, que no es lo mismo que un permiso de Google");
  ok(/secreto de la integración/i.test(soporte),
     "y con las palabras de ESE servicio: Notion pide su secreto de integración");
  ok(await p.getByRole("button", { name: /^Conectar Notion$/ }).first().isVisible(),
     "con su botón, sin «con Google» donde no toca");
  await p.screenshot({ path: `${AQUI}ag3-support.png` });

  console.log("\nLo ya conectado deja de pedir nada");
  await p.evaluate((token) => fetch("/api/conexiones", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ servicio: "notion", campos: { token } }),
  }), ESPERADO.TOKEN_NOTION);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await abrirAgentes();
  await p.getByText("ECLIPSE SUPPORT").first().click();
  await p.waitForTimeout(1600);
  const yaEsta = await p.evaluate(() => document.body.innerText);
  ok(/Conectada a/.test(yaEsta), "una cuenta conectada dice a cuál, no «requiere conexión»");
  ok(/solo mirar/.test(yaEsta), "y con qué permiso, que es lo que decide si puede tocar algo");
  ok((await p.getByRole("button", { name: /^Conectar Notion$/ }).count()) === 0,
     "y ya no ofrece conectar lo que está conectado");

  ok(errores.length === 0, `sin errores de JavaScript (${errores.slice(0, 2).join(" · ")})`);
} finally {
  await ctx.close().catch(() => {});
  await navegador.close().catch(() => {});
  apis.close();
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
  redis.kill();
  if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
