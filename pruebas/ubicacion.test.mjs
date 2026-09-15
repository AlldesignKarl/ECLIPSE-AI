// La ubicación, en un navegador de verdad: que no se pida sola, que se pueda
// encender y apagar, que lo que sale del móvil vaya redondeado, y que al
// apagarla no quede nada guardado.
import { spawn } from "node:child_process";
import { createServer as unPuerto } from "node:net";
import { createServer } from "node:http";
import { openSync } from "node:fs";
import { RAIZ, abrirNavegador } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Un Nominatim de mentira, para no llamar al de verdad desde una prueba.
const mapas = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      address: { city: "Zaragoza", state: "Aragón", country: "España", road: "Calle Falsa" },
      display_name: "Calle Falsa 123, Zaragoza",
    }),
  );
});
await new Promise((r) => mapas.listen(0, "127.0.0.1", r));
const BASE_MAPAS = `http://127.0.0.1:${mapas.address().port}`;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-ubicacion.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ,
  detached: true,
  stdio: ["ignore", salida, salida],
  env: { ...process.env, MAPA_BASE_OSM: BASE_MAPAS, AUTH_SECRET: "secreto-ubicacion", GROQ_API_KEY: "gsk_prueba" },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const navegador = await abrirNavegador();

// El navegador cree estar en un punto con muchos decimales: así se ve si lo
// que sale de aquí va recortado o va entero.
const LAT = 41.6488123456;
const LON = -0.8891345678;

const ctx = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  permissions: ["geolocation"],
  geolocation: { latitude: LAT, longitude: LON },
});
const p = await ctx.newPage();
const errores = [];
p.on("pageerror", (e) => errores.push(e.message.slice(0, 160)));

// Lo que el navegador manda al servidor, para poder mirarlo.
const enviados = [];
await p.route("**/api/lugar", async (ruta) => {
  enviados.push({ url: "/api/lugar", cuerpo: JSON.parse(ruta.request().postData() ?? "{}") });
  await ruta.continue();
});
await p.route("**/api/chat", async (ruta) => {
  enviados.push({ url: "/api/chat", cuerpo: JSON.parse(ruta.request().postData() ?? "{}") });
  // No hace falta un motor de verdad: lo que se comprueba es lo que se manda.
  await ruta.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream" },
    body: `data: ${JSON.stringify({ t: "text", v: "Vale." })}\n\ndata: ${JSON.stringify({ t: "done" })}\n\n`,
  });
});

// Contar cuántas veces le pregunta al GPS, para saber si molesta sin motivo.
await p.addInitScript(() => {
  window.__gps = 0;
  const de_verdad = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  navigator.geolocation.getCurrentPosition = (...args) => {
    window.__gps++;
    return de_verdad(...args);
  };
});

const entrar = async () => {
  await p.goto(URL_APP, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /entrar|empezar|probar/i }).first().click().catch(() => {});
  await p.waitForTimeout(1500);
  const saltar = p.getByRole("button", { name: /Entrar sin cuenta/i });
  if (await saltar.count()) await saltar.click();
  await p.waitForTimeout(1500);
};

const escribir = async (texto) => {
  const caja = p.getByPlaceholder(/Pregunta lo que quieras/i);
  await caja.fill(texto);
  await p.getByRole("button", { name: /enviar|send/i }).first().click().catch(async () => {
    await caja.press("Enter");
  });
};

const abrirAjustes = async () => {
  // El cartel de "instala la aplicación" tapa el menú si sigue abierto.
  const cerrarCartel = p.getByRole("button", { name: "Ahora no" });
  if (await cerrarCartel.count()) await cerrarCartel.first().click().catch(() => {});
  await p.waitForTimeout(300);
  await p.locator("header button").first().click().catch(() => {});
  await p.waitForTimeout(400);
  await p.getByText("Ajustes", { exact: true }).first().click();
  await p.waitForTimeout(700);
};

try {
  console.log("\nDe fábrica está apagada");
  await entrar();
  ok((await p.evaluate(() => window.__gps)) === 0, "al abrir la aplicación no se le pregunta al GPS");
  ok(
    (await p.evaluate(() => localStorage.getItem("eclipse.ubicacion"))) === null,
    "y no hay ningún permiso guardado",
  );

  await escribir("Hola");
  await p.waitForTimeout(1500);
  const primerChat = enviados.find((e) => e.url === "/api/chat");
  ok(Boolean(primerChat), "el mensaje sale igual");
  ok(primerChat?.cuerpo.ubicacion === undefined, "pero sin ubicación ninguna");
  ok((await p.evaluate(() => window.__gps)) === 0, "y escribir no dispara el permiso del navegador");

  console.log("\nSe enciende en Ajustes");
  await abrirAjustes();
  const interruptor = p.locator('input[type="checkbox"]').first();
  const etiqueta = p.getByText("Dejar que ECLIPSE sepa dónde estás");
  ok(await etiqueta.isVisible(), "hay un interruptor de ubicación en Ajustes");
  const explicacion = await p.getByText(/redondeada a un kilómetro/).first().textContent();
  ok(/no para tu calle/i.test(explicacion ?? ""), "que explica qué se manda antes de encenderlo");
  ok(/No se guarda/i.test(explicacion ?? ""), "y que no se guarda en ningún sitio");

  await etiqueta.click();
  await p.waitForTimeout(2500);
  ok((await p.evaluate(() => window.__gps)) >= 1, "al encenderlo, ahí sí se pregunta");
  ok(
    (await p.evaluate(() => localStorage.getItem("eclipse.ubicacion"))) === "si",
    "y queda encendido",
  );

  const alLugar = enviados.find((e) => e.url === "/api/lugar");
  ok(Boolean(alLugar), "se traducen las coordenadas a un nombre");
  ok(alLugar?.cuerpo.lat === 41.649 && alLugar?.cuerpo.lon === -0.889, `y van redondeadas (${alLugar?.cuerpo.lat}, ${alLugar?.cuerpo.lon})`);
  ok(
    String(alLugar?.cuerpo.lat).split(".")[1].length <= 3,
    "nunca con los decimales exactos del GPS",
  );
  ok(await p.getByText(/Ahora mismo: .*Zaragoza/).first().isVisible(), "y en Ajustes se ve dónde cree que estás");

  console.log("\nCon ella puesta, viaja con el mensaje");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(500);
  enviados.length = 0;
  await escribir("¿Qué hago este finde?");
  await p.waitForTimeout(2000);
  const conChat = enviados.find((e) => e.url === "/api/chat");
  ok(Boolean(conChat?.cuerpo.ubicacion), "el mensaje lleva la ubicación");
  ok(conChat?.cuerpo.ubicacion?.lat === 41.649, "redondeada también aquí");
  ok(/Zaragoza/.test(conChat?.cuerpo.ubicacion?.lugar ?? ""), "y con el nombre del sitio ya resuelto");
  ok(!/Calle Falsa/.test(JSON.stringify(conChat?.cuerpo.ubicacion)), "sin la calle, aunque el mapa la diera");

  const gpsAntes = await p.evaluate(() => window.__gps);
  enviados.length = 0;
  await escribir("¿Y el domingo?");
  await p.waitForTimeout(1500);
  ok((await p.evaluate(() => window.__gps)) === gpsAntes, "en el mensaje siguiente no se vuelve a molestar al GPS");
  ok(Boolean(enviados.find((e) => e.url === "/api/chat")?.cuerpo.ubicacion), "pero la ubicación sigue yendo");

  console.log("\nApagarla la borra");
  await abrirAjustes();
  await p.getByText("Dejar que ECLIPSE sepa dónde estás").click();
  await p.waitForTimeout(800);
  const despues = await p.evaluate(() => ({
    permiso: localStorage.getItem("eclipse.ubicacion"),
    guardada: localStorage.getItem("eclipse.ubicacion.ultima"),
  }));
  ok(despues.permiso === "no", "queda apagada");
  ok(despues.guardada === null, "y no queda guardado dónde estabas");

  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  enviados.length = 0;
  await escribir("¿Y ahora?");
  await p.waitForTimeout(1500);
  ok(
    enviados.find((e) => e.url === "/api/chat")?.cuerpo.ubicacion === undefined,
    "y el siguiente mensaje ya no la lleva",
  );

  ok(errores.length === 0, `sin errores de JavaScript (${errores.slice(0, 2).join(" | ")})`);
} finally {
  await navegador.close();
  mapas.close();
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
