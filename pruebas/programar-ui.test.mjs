// Programar en un navegador de verdad: que el plan lo monte ECLIPSE, que se vea
// antes de que exista nada, que se acepte de un toque y que el calendario pinte
// lo que va a pasar.
//
// La prueba de la API comprueba que el camino funciona; esta comprueba lo otro,
// que es lo que de verdad falla: que se vea, que se pueda tocar con el pulgar y
// que lo que sale en pantalla sea lo que se ha guardado.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as unPuerto } from "node:net";
import { readFileSync, existsSync, unlinkSync, openSync } from "node:fs";
import { RAIZ, abrirNavegador } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Un motor de mentira que sabe hacer las dos cosas: planificar (una respuesta
// de una pieza, con el JSON dentro) y hacer un encargo (en flujo).
const motor = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    if (req.url.includes("/models")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ data: [{ id: "llama-3.3-70b-versatile" }] }));
    }
    const b = JSON.parse(c || "{}");
    // Se distingue por la frase que mete la propia ruta al pedir un cambio, no
    // por la palabra "martes": el día de hoy va dentro del prompt, así que un
    // martes cualquiera la primera petición también la llevaría.
    const pidenCambio = JSON.stringify(b).includes("Y ahora te dice");

    if (!b.stream) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          nota: pidenCambio ? "Hecho: te lo he pasado todo a los martes." : "Te lo reparto para que no te caiga todo el lunes.",
          encargos: [
            { titulo: "Pedidos de ayer", instruccion: "Mira los pedidos de ayer y dime cuánto suman.", cuando: { tipo: "diario" } },
            { titulo: "Repaso del SEO", instruccion: "Audita la web y dime solo lo que haya que arreglar.", cuando: { tipo: "semanal", dia: 2 } },
            { titulo: "Lectura del finde", instruccion: "Búscame un artículo largo y bueno de esta semana.", cuando: { tipo: "semanal", dia: 6 } },
          ],
        }) } }],
      }));
    }

    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Ayer 3 pedidos, 74,20 € en total." } }] })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });
});
await new Promise((r) => motor.listen(0, "127.0.0.1", r));
const baseMotor = `http://127.0.0.1:${motor.address().port}`;

const puertoRedis = `${AQUI}redis-programar-ui.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-programar-ui.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true, stdio: ["ignore", salida, salida],
  env: {
    ...process.env,
    UPSTASH_REDIS_REST_URL: urlRedis, UPSTASH_REDIS_REST_TOKEN: "t",
    AUTH_SECRET: "secreto-programar-ui", PRO_ACCESS_CODE: "ECLIPSE-PRO",
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
  await p.getByPlaceholder("tucorreo@ejemplo.com").fill(`programar${Date.now()}@ejemplo.com`);
  await p.getByPlaceholder(/8 caracteres/i).fill("eclipse2026");
  await p.getByRole("button", { name: "Crear cuenta" }).click();
  await p.waitForTimeout(2500);
  const cartel = p.getByRole("button", { name: "Ahora no" });
  if (await cartel.count()) await cartel.first().click().catch(() => {});
  await p.evaluate(() => fetch("/api/pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "ECLIPSE-PRO" }) }));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);

  console.log("\nAbrir Programar");
  await p.locator("header button, nav button").first().click();
  await p.waitForTimeout(700);
  const entrada = p.getByRole("button", { name: /Programar/ }).first();
  await entrada.scrollIntoViewIfNeeded();
  await entrada.click();
  await p.waitForTimeout(1500);

  ok(await p.getByText("Que te lo planifique ECLIPSE").isVisible(),
     "lo primero que hay, sin nada puesto, es que te lo planifique él");
  await p.screenshot({ path: `${AQUI}pr1-vacio.png` });

  console.log("\nPedirle el plan");
  await p.getByPlaceholder(/Quiero llevar mi tienda al día/i).fill("Llevar la tienda al día sin mirarla cada mañana");
  await p.getByRole("button", { name: "Planifícamelo" }).click();
  await p.waitForTimeout(3000);

  ok(await p.getByText(/Te lo reparto/).isVisible(), "contesta con la nota de por qué lo ha repartido así");
  ok(await p.getByText("Repaso del SEO").isVisible(), "y con los encargos que propone");
  ok(await p.getByText("Cada día").first().isVisible(), "cada uno con el día que le ha puesto");
  // Lo que importa de verdad: todavía no existe nada.
  const antes = await p.evaluate(() => fetch("/api/tareas").then((r) => r.json()));
  ok((antes.tareas?.length ?? 0) === 0, "y no se ha guardado NADA todavía: el plan se mira antes de que exista");
  await p.screenshot({ path: `${AQUI}pr2-plan.png` });

  console.log("\nQuitar uno y pedirle un cambio con palabras");
  await p.getByText("Lectura del finde").click();
  await p.waitForTimeout(400);
  ok(await p.getByRole("button", { name: /Poner los 2/ }).isVisible(),
     "al quitar uno, el botón cuenta los que quedan");

  await p.getByPlaceholder(/Cámbiame algo/i).fill("mejor los martes");
  await p.getByRole("button", { name: "Pídeselo" }).click();
  await p.waitForTimeout(3000);
  ok(await p.getByText(/te lo he pasado todo a los martes/i).isVisible(),
     "se le pide el cambio con palabras y vuelve a repartirlo");
  ok(await p.getByRole("button", { name: /Poner los 3/ }).isVisible(),
     "y el plan nuevo viene entero otra vez, sin arrastrar lo que se quitó del anterior");

  console.log("\nAceptarlo de un toque");
  await p.getByRole("button", { name: /Poner los 3/ }).click();
  await p.waitForTimeout(3000);
  const guardadas = await p.evaluate(() => fetch("/api/tareas").then((r) => r.json()));
  ok((guardadas.tareas?.length ?? 0) === 3, `los tres encargos se guardan de una vez (${guardadas.tareas?.length})`);
  ok(await p.getByText("Lo que viene").isVisible(), "y al haber encargos aparece el calendario");

  console.log("\nEl calendario");
  const puntos = await p.locator(".grid.grid-cols-7 button").count();
  ok(puntos === 14, `se ven catorce días (${puntos})`);
  await p.locator(".grid.grid-cols-7 button").first().click();
  await p.waitForTimeout(500);
  ok(await p.getByText(/· Pedidos de ayer/).isVisible(), "al tocar hoy sale lo que le toca hoy");
  await p.screenshot({ path: `${AQUI}pr3-calendario.png` });

  console.log("\nHacerlo ahora, sin esperar a mañana");
  await p.getByRole("button", { name: "Hacerlo ahora" }).first().click();
  await p.waitForTimeout(6000);
  const conResultado = await p.evaluate(() => fetch("/api/tareas").then((r) => r.json()));
  ok((conResultado.resultados?.length ?? 0) >= 1, "el parte aparece en el momento");
  ok(await p.getByText("Lo que ha hecho").isVisible(), "y se ve en la pantalla, sin recargar");
  await p.screenshot({ path: `${AQUI}pr4-resultado.png` });
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
