// La pantalla de Conexiones en un navegador de verdad: que se vea, que se
// conecte una tienda de mentira desde el formulario, y que el interruptor de
// "dejar que haga cambios" haga lo que dice.
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

const puertoRedis = `${AQUI}redis-ui.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-ui.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true, stdio: ["ignore", salida, salida],
  env: {
    ...process.env,
    UPSTASH_REDIS_REST_URL: urlRedis, UPSTASH_REDIS_REST_TOKEN: "t",
    AUTH_SECRET: "secreto-ui", PRO_ACCESS_CODE: "ECLIPSE-PRO",
    CONEXION_BASE_SHOPIFY: baseApis, CONEXION_BASE_WOOCOMMERCE: baseApis,
    CONEXION_BASE_WIX: baseApis, CONEXION_BASE_IONOS: baseApis, CONEXION_BASE_MERCADOS: baseApis,
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
  // Entrar y crear cuenta.
  await p.goto(URL_APP, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /entrar|empezar|probar/i }).first().click().catch(() => {});
  await p.waitForTimeout(1200);
  await p.getByPlaceholder(/Tu nombre, o como prefieras/i).fill("Karl");
  await p.getByPlaceholder("tucorreo@ejemplo.com").fill(`ui${Date.now()}@ejemplo.com`);
  await p.getByPlaceholder(/8 caracteres/i).fill("eclipse2026");
  await p.getByRole("button", { name: "Crear cuenta" }).click();
  await p.waitForTimeout(2500);

  const abrirMenu = async () => {
    await p.locator("header button, nav button").first().click();
    await p.waitForTimeout(700);
  };
  const abrirConexiones = async () => {
    await abrirMenu();
    const boton = p.getByRole("button", { name: /Conexiones/ }).first();
    await boton.scrollIntoViewIfNeeded();
    await boton.click();
    await p.waitForTimeout(1200);
  };

  /* ----------------------------- Sin Pro ----------------------------- */
  console.log("\nSin Pro");
  await abrirConexiones();
  await p.screenshot({ path: AQUI + "cx1-sin-pro.png" });
  ok(await p.getByText(/Las conexiones son del plan Pro/i).count() > 0, "se ve que son del plan Pro");
  ok(await p.getByText(/Shopify/).count() > 0, "pero el catálogo se ve igual, para saber qué te pierdes");
  const campoBloqueado = p.locator('input[placeholder="mitienda.myshopify.com"]');
  await p.getByRole("button", { name: /Shopify/ }).first().click();
  await p.waitForTimeout(400);
  ok(await campoBloqueado.isDisabled().catch(() => true), "y el formulario está bloqueado");
  // El catálogo nuevo: buscador y categorías.
  ok(await p.getByPlaceholder("Buscar conexiones").count() > 0, "hay buscador");
  ok(await p.getByRole("button", { name: "Comercio" }).count() > 0, "y categorías");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);

  /* ------------------------------ Con Pro ----------------------------- */
  console.log("\nCon Pro");
  await p.evaluate(() => fetch("/api/pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "ECLIPSE-PRO" }) }));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  await abrirConexiones();
  ok(await p.getByText(/Las conexiones son del plan Pro/i).count() === 0, "ya no sale el aviso de Pro");
  await p.screenshot({ path: AQUI + "cx2-catalogo.png", fullPage: true });

  // Los logos de verdad, no unas iniciales.
  const logos = await p.evaluate(() => {
    const filas = [...document.querySelectorAll("svg[role='img']")];
    return filas.map((s) => ({
      marca: s.getAttribute("aria-label"),
      color: s.getAttribute("fill"),
      trazo: (s.querySelector("path")?.getAttribute("d") ?? "").length,
      alto: s.getBoundingClientRect().height,
    }));
  });
  const esperados = ["Shopify", "WooCommerce", "Wix", "IONOS", "Notion", "GitHub", "Stripe", "Telegram", "Binance"];
  for (const marca of esperados) {
    const l = logos.find((x) => x.marca === marca);
    ok(Boolean(l), `se dibuja el logo de ${marca}`);
    if (l) {
      ok(l.trazo > 100, `  con su trazo de verdad (${l.trazo} caracteres)`);
      ok(/^#[0-9A-Fa-f]{6}$/.test(l.color ?? ""), `  en su color de marca (${l.color})`);
      ok(l.alto > 10, `  y se ve en pantalla (${Math.round(l.alto)} px)`);
    }
  }
  ok(logos.every((l) => l.marca), "todos los logos dicen de quién son, para quien no los ve");

  // Nada se trae de la web de nadie: ni un logo enlazado desde fuera.
  const deFuera = await p.evaluate(() =>
    [...document.querySelectorAll("img, image, use")]
      .map((e) => e.getAttribute("src") || e.getAttribute("href") || e.getAttribute("xlink:href") || "")
      .filter((u) => /^https?:\/\//.test(u)),
  );
  ok(deFuera.length === 0, `ningún logo se enlaza desde fuera (${deFuera.slice(0, 2).join(", ")})`);
  await p.getByPlaceholder("Buscar conexiones").fill("stripe");
  await p.waitForTimeout(500);
  ok(await p.getByText("Stripe").count() > 0 && await p.getByText("IONOS").count() === 0, "el buscador filtra");
  await p.screenshot({ path: AQUI + "cx7-buscando.png", fullPage: true });
  await p.getByPlaceholder("Buscar conexiones").fill("");
  await p.waitForTimeout(400);

  // Abrir Shopify y conectar.
  await p.getByRole("button", { name: /Shopify/ }).first().click();
  await p.waitForTimeout(500);
  ok(await p.getByText(/Configuración → Aplicaciones/).count() > 0, "explica paso a paso de dónde sale el token");
  await p.screenshot({ path: AQUI + "cx3-shopify-pasos.png" });

  await p.locator('input[placeholder="mitienda.myshopify.com"]').fill("mitienda.myshopify.com");
  await p.locator('input[placeholder="shpat_…"]').fill(ESPERADO.TOKEN_SHOPIFY);
  await p.getByRole("button", { name: /Conectar Shopify/ }).click();
  await p.waitForTimeout(2500);
  await p.screenshot({ path: AQUI + "cx4-conectado.png", fullPage: true });

  ok(await p.getByText(/Mi Tienda · EUR/).count() > 0, "conecta y enseña a qué tienda");
  ok(await p.getByText(/solo lectura/i).count() > 0, "y que está en solo lectura");

  // El interruptor de escritura.
  const estadoAntes = await p.evaluate(() => fetch("/api/conexiones").then((r) => r.json()));
  ok(estadoAntes.servicios.find((s) => s.id === "shopify").permiso === "leer", "el servidor también lo tiene en lectura");

  // Tras conectar, la tarjeta sigue abierta: solo hay que llegar hasta ella.
  const interruptor = p.getByText(/Dejar que haga cambios/).first();
  if (!(await interruptor.count())) {
    const cab = p.getByRole("button", { name: /Shopify/ }).first();
    await cab.scrollIntoViewIfNeeded();
    await cab.click();
    await p.waitForTimeout(500);
  }
  await interruptor.scrollIntoViewIfNeeded();
  await interruptor.click();
  await p.waitForTimeout(1800);
  const estadoDespues = await p.evaluate(() => fetch("/api/conexiones").then((r) => r.json()));
  ok(estadoDespues.servicios.find((s) => s.id === "shopify").permiso === "escribir", "el interruptor cambia el permiso de verdad, en el servidor");
  await p.screenshot({ path: AQUI + "cx5-escritura.png", fullPage: true });

  // Una clave mala, que es lo que va a pasar de verdad la primera vez.
  const cabIonos = p.getByRole("button", { name: /IONOS/ }).first();
  await cabIonos.scrollIntoViewIfNeeded();
  await cabIonos.click();
  await p.waitForTimeout(500);
  await p.locator('input[placeholder="a1b2c3d4…"]').fill("mal");
  await p.locator('input[type="password"]').last().fill("tambien-mal");
  await p.getByRole("button", { name: /Conectar IONOS/ }).click();
  await p.waitForTimeout(2500);
  ok(await p.getByText(/ha rechazado la clave/i).count() > 0, "una clave mala se explica en la pantalla, en cristiano");
  await p.screenshot({ path: AQUI + "cx6-clave-mala.png", fullPage: true });

  ok(errores.length === 0, `sin errores de JavaScript (${errores.slice(0, 2).join(" | ")})`);
} finally {
  await navegador.close();
  apis.close();
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
  redis.kill();
  if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
