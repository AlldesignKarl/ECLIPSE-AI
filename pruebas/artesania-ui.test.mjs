// La web corporativa levantada de verdad, en un navegador de verdad.
//
// Lo que se comprueba es lo que le prometimos a quien la va a usar: que NO hay
// botones falsos. Que "Solicitar catálogo" lleva al formulario con el asunto ya
// puesto, que el botón de una ficha se lleva el producto dentro, que el envío
// llega al buzón configurado y que un robot que rellena el campo trampa no
// llega a ninguna parte.
//
// Y una que no se ve y cuesta cara: que la página no se sale por los lados en
// un móvil. Con animaciones y parallax es el fallo más fácil de colar.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { openSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { RAIZ, abrirNavegador, puertoLibre } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

/* El buzón de mentira: hace de Zapier, de CRM o de lo que se configure. */
const recibidas = [];
const buzon = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    try { recibidas.push(JSON.parse(c || "{}")); } catch { recibidas.push({}); }
    res.writeHead(200, { "content-type": "application/json" }).end("{}");
  });
});
await new Promise((r) => buzon.listen(0, "127.0.0.1", r));
const URL_BUZON = `http://127.0.0.1:${buzon.address().port}/solicitudes`;

/* Redis de mentira, para que el freno anti-spam tenga dónde apoyarse. */
const puertoRedis = `${AQUI}redis-artesania.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

const PUERTO = await puertoLibre();
const salida = openSync(`${AQUI}app-artesania.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ,
  detached: true,
  stdio: ["ignore", salida, salida],
  env: {
    ...process.env,
    ARTESANIA_WEBHOOK_URL: URL_BUZON,
    UPSTASH_REDIS_REST_URL: urlRedis,
    UPSTASH_REDIS_REST_TOKEN: "t",
    AUTH_SECRET: "secreto-artesania",
  },
});
const BASE = `http://127.0.0.1:${PUERTO}`;
/*
  Un minuto para que arranque, no veinte segundos.
  Corriendo la prueba sola arranca en dos, pero dentro de la tanda entera va
  detrás de tres pruebas que levantan la aplicación y abren navegador, y con la
  máquina cargada el arranque se estira. Quedarse corto aquí no prueba nada: da
  un fallo que no tiene que ver con lo que se está comprobando.
*/
let enPie = false;
for (let i = 0; i < 240 && !enPie; i++) {
  try { const r = await fetch(`${BASE}/artesania`); enPie = r.ok; } catch { /* todavía no */ }
  if (!enPie) await esperar(250);
}
ok(enPie, "la aplicación arranca");

const navegador = await abrirNavegador();

try {
  /* ------------------------------ La página ------------------------------ */
  console.log("\nLa página se pinta entera y sin errores");
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  const pagina = await ctx.newPage();
  const errores = [];
  pagina.on("pageerror", (e) => errores.push(String(e)));
  await pagina.goto(`${BASE}/artesania`, { waitUntil: "networkidle" });

  ok(errores.length === 0, "ni un error de JavaScript al cargar");
  ok((await pagina.title()).includes("Zaragoza"), "el título dice de qué va");
  ok(await pagina.locator("h1").first().isVisible(), "el titular de la portada está");
  for (const id of ["historia", "ciudad", "productos", "mayoristas", "proceso", "contacto"]) {
    ok(await pagina.locator(`#${id}`).count() === 1, `la sección "${id}" existe`);
  }

  console.log("\nLo que aparece al bajar, aparece");
  const antes = await pagina.locator("#historia .arte-revelar").first().evaluate((e) => e.className);
  await pagina.evaluate(() => document.getElementById("historia")?.scrollIntoView());
  await esperar(1500);
  const despues = await pagina.locator("#historia .arte-revelar").first().evaluate((e) => e.className);
  ok(!antes.includes("es-visible") && despues.includes("es-visible"), "el texto de la historia entra al llegar a él");

  /* ---------------------------- Botones de verdad ------------------------- */
  console.log("\nLos botones hacen lo que dicen");
  await pagina.evaluate(() => window.scrollTo(0, 0));
  await esperar(400);
  await pagina.getByRole("button", { name: "Solicitar catálogo" }).first().click();
  await esperar(1600);
  const enContacto = await pagina.evaluate(() => {
    const r = document.getElementById("contacto").getBoundingClientRect();
    return r.top < window.innerHeight * 0.6;
  });
  ok(enContacto, "«Solicitar catálogo» baja hasta el formulario");
  ok(
    await pagina.getByRole("button", { name: "Solicitud de catálogo" }).getAttribute("aria-pressed") === "true",
    "y llega con el asunto ya elegido",
  );

  await pagina.evaluate(() => document.getElementById("productos")?.scrollIntoView());
  await esperar(900);
  await pagina.getByRole("button", { name: "Solicitar información" }).first().click();
  await esperar(1600);
  ok(
    (await pagina.locator("#contacto").innerText()).includes("Sobre:"),
    "el botón de una ficha se lleva el producto al formulario",
  );

  /* ------------------------------ El formulario --------------------------- */
  console.log("\nEl formulario avisa antes de enviar");
  await pagina.getByRole("button", { name: "Enviar solicitud" }).click();
  await esperar(500);
  const textoFormulario = await pagina.locator("#contacto").innerText();
  ok(textoFormulario.includes("Dinos cómo te llamas"), "un formulario vacío no se envía, y dice por qué");
  ok(recibidas.length === 0, "y no se manda nada al buzón");

  console.log("\nY cuando está bien, llega");
  await pagina.fill("#nombre", "Ana Pérez");
  await pagina.fill("#empresa", "Tienda del Museo");
  await pagina.fill("#email", "ana@tiendadelmuseo.es");
  await pagina.fill("#telefono", "976000000");
  await pagina.fill("#mensaje", "Nos interesa la cerámica para la tienda. ¿Qué mínimos tenéis?");
  await pagina.getByRole("button", { name: "Enviar solicitud" }).click();
  await esperar(2500);

  ok((await pagina.locator("#contacto").innerText()).includes("Mensaje enviado"), "se confirma en pantalla");
  ok(recibidas.length === 1, "y ha llegado UNA solicitud al buzón");
  ok(recibidas[0]?.empresa === "Tienda del Museo", "con la empresa dentro");
  ok(recibidas[0]?.email === "ana@tiendadelmuseo.es", "y con el correo para contestar");

  /* ------------------------------ Los enlaces ----------------------------- */
  console.log("\nNi un enlace roto");
  const rotos = await pagina.$$eval("a[href]", (as) =>
    as.map((a) => a.getAttribute("href")).filter((h) => !h || h === "#" || h === "javascript:void(0)"),
  );
  ok(rotos.length === 0, "no hay ningún enlace que no lleve a ninguna parte");
  for (const ruta of ["/artesania/aviso-legal", "/artesania/privacidad", "/artesania/cookies"]) {
    const r = await fetch(`${BASE}${ruta}`);
    ok(r.status === 200, `${ruta} existe`);
  }
  await ctx.close();

  /* -------------------------------- El móvil ------------------------------ */
  console.log("\nEn el móvil");
  const movil = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const chico = await movil.newPage();
  await chico.goto(`${BASE}/artesania`, { waitUntil: "networkidle" });
  await esperar(800);
  const desborde = await chico.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!desborde, "la página no se sale por los lados");

  await chico.evaluate(() => window.scrollTo(0, 1200));
  await esperar(900);
  await chico.getByRole("button", { name: "Abrir el menú" }).click();
  await esperar(600);
  const enElMenu = chico.getByRole("button", { name: "Productos", exact: true });
  ok(await enElMenu.isVisible(), "el menú se abre");
  await enElMenu.click();
  await esperar(1600);
  const enProductos = await chico.evaluate(() => {
    const r = document.getElementById("productos").getBoundingClientRect();
    return r.top < window.innerHeight * 0.6 && r.bottom > 0;
  });
  ok(enProductos, "y lleva a la sección que se toca");
  await movil.close();

  /* ------------------------- Lo que no se ve en pantalla ------------------ */
  console.log("\nContra los robots y contra el spam");
  const trampa = await fetch(`${BASE}/api/artesania/contacto`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nombre: "Robot", empresa: "Robots SL", email: "robot@spam.com",
      mensaje: "compra seguidores baratos ahora mismo", asunto: "informacion", web: "http://spam",
    }),
  });
  ok(trampa.status === 200, "al que cae en la trampa se le contesta que sí");
  ok(recibidas.length === 1, "pero su mensaje NO llega a la empresa");

  const malo = await fetch(`${BASE}/api/artesania/contacto`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nombre: "A", empresa: "", email: "no", mensaje: "x" }),
  });
  ok(malo.status === 400, "una solicitud inválida se rechaza también desde fuera del navegador");
  ok(Boolean((await malo.json()).campos?.email), "y dice qué campo está mal");

  const seguido = await fetch(`${BASE}/api/artesania/contacto`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nombre: "Ana Pérez", empresa: "Tienda del Museo", email: "ana@tiendadelmuseo.es",
      mensaje: "Otra consulta distinta sobre los mínimos de cerámica.", asunto: "informacion",
    }),
  });
  ok(seguido.status === 429, "dos envíos seguidos desde el mismo sitio: el segundo espera");
} finally {
  await navegador.close();
  try { process.kill(-app.pid); } catch { /* ya estaba muerto */ }
  redis.kill();
  buzon.close();
  if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
}

console.log(fallos.length ? `\n${fallos.length} fallos\n` : "\nTodo bien\n");
process.exit(fallos.length ? 1 : 0);
