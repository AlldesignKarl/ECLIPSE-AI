// El aviso de "conecta tu tienda" al empezar una conversación: que salga, que
// lleve al catálogo, que se pueda apartar para siempre y que no salga a quien
// ya tiene algo conectado.
import { spawn } from "node:child_process";
import { createServer as unPuerto } from "node:net";
import { openSync } from "node:fs";
import { RAIZ, abrirNavegador } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-bienvenida.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true, stdio: ["ignore", salida, salida],
  env: { ...process.env, GROQ_API_KEY: "gsk_prueba", AUTH_SECRET: "secreto-bienvenida" },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const navegador = await abrirNavegador();

const CATALOGO = {
  pro: true,
  conCuenta: true,
  almacen: true,
  servicios: [
    {
      id: "shopify", nombre: "Shopify", color: "#5E8E3E", marca: "Sh", familia: "tienda",
      resumen: "Pedidos, productos y stock de tu tienda.", pasos: ["Entra en tu panel"],
      enlace: "https://admin.shopify.com", campos: [{ id: "tienda", etiqueta: "Tienda", ayuda: "" }],
      conectado: false, admiteEscritura: true, acciones: [],
    },
  ],
};

async function abrir({ conectado }) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.route("**/api/conexiones", async (ruta) => {
    if (ruta.request().method() !== "GET") return ruta.continue();
    await ruta.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...CATALOGO,
        servicios: CATALOGO.servicios.map((s) => ({ ...s, conectado })),
      }),
    });
  });
  await p.goto(URL_APP, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /entrar|empezar|probar/i }).first().click().catch(() => {});
  await p.waitForTimeout(1200);
  const saltar = p.getByRole("button", { name: /Entrar sin cuenta/i });
  if (await saltar.count()) await saltar.click();
  await p.waitForTimeout(1800);
  const cartel = p.getByRole("button", { name: "Ahora no" }).first();
  // El de instalar la app, que también se llama así, se quita antes de mirar.
  const instalar = p.getByText(/Instálala y se abre como un programa/);
  if (await instalar.count()) await cartel.click().catch(() => {});
  await p.waitForTimeout(500);
  return { ctx, p };
}

try {
  console.log("\nSin nada conectado, se ofrece");
  const { ctx, p } = await abrir({ conectado: false });
  const aviso = p.getByText(/¿Tienes una tienda online/);
  ok(await aviso.isVisible(), "al empezar una conversación se le dice que puede conectar su tienda");
  const texto = await p.getByText(/Conéctala a ECLIPSE/).first().textContent();
  ok(/ventas|stock|dominio|Google/.test(texto ?? ""), "y para qué sirve, con ejemplos suyos");
  ok(/solo lectura/.test(texto ?? ""), "diciendo que empieza sin poder tocar nada");

  console.log("\nLleva al catálogo");
  await p.getByRole("button", { name: /Ver cómo se conecta/ }).click();
  await p.waitForTimeout(1200);
  ok(await p.getByPlaceholder(/Buscar conexiones/i).isVisible(), "el botón abre el catálogo de Conexiones");
  ok(await p.getByText("Shopify").first().isVisible(), "con los servicios dentro");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(600);

  console.log("\nApartarlo es para siempre");
  await p.getByRole("button", { name: "Ahora no" }).last().click();
  await p.waitForTimeout(400);
  ok((await p.getByText(/¿Tienes una tienda online/).count()) === 0, "se va al decir 'ahora no'");
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  ok((await p.getByText(/¿Tienes una tienda online/).count()) === 0, "y no vuelve al recargar");
  await ctx.close();

  console.log("\nA quien ya tiene tienda conectada no se le dice nada");
  const segundo = await abrir({ conectado: true });
  await segundo.p.waitForTimeout(1200);
  ok(
    (await segundo.p.getByText(/¿Tienes una tienda online/).count()) === 0,
    "con una conexión puesta, el aviso no aparece",
  );
  await segundo.ctx.close();
} finally {
  await navegador.close();
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
