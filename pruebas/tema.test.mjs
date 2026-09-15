// El tema claro: que se lea de verdad, que se recuerde y que no dé el fogonazo
// blanco al cargar.
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
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true,
  stdio: ["ignore", openSync(`${AQUI}app-tema.log`, "w"), openSync(`${AQUI}app-tema.log`, "a")],
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

// Luminancia relativa y contraste, como manda la norma de accesibilidad.
const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const rgb = (s) => (s.match(/\d+/g) ?? []).slice(0, 3).map(Number);

const navegador = await abrirNavegador();
const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errores = [];
p.on("pageerror", (e) => errores.push(e.message.slice(0, 160)));

const sembrar = async (tema) => {
  await p.goto(URL_APP, { waitUntil: "domcontentloaded" });
  await p.evaluate((t) => {
    localStorage.setItem("eclipse.entered", "1");
    if (t) localStorage.setItem("eclipse.tema", t); else localStorage.removeItem("eclipse.tema");
    localStorage.setItem("eclipse.conversations.v1", JSON.stringify([{
      id: "c1", title: "Prueba", createdAt: Date.now(), updatedAt: Date.now(), mode: "chat",
      messages: [
        { id: "m1", role: "user", content: "Hola, ¿qué tal?", createdAt: Date.now() },
        { id: "m2", role: "assistant", content: "Bien.\n\n```js a.js\nconst x = 1;\n```", createdAt: Date.now() },
      ],
    }]));
  }, tema);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  await p.locator("header button").first().click().catch(() => {});
  await p.waitForTimeout(500);
  await p.getByText("Prueba", { exact: true }).first().click().catch(() => {});
  await p.waitForTimeout(1000);
};

try {
  console.log("\nSe aplica antes de pintar (sin fogonazo)");
  await sembrar("claro");
  await p.goto(URL_APP, { waitUntil: "commit" });
  const alInstante = await p.evaluate(() => document.documentElement.getAttribute("data-tema"));
  ok(alInstante === "claro", `nada más empezar a cargar ya está puesto (${alInstante})`);

  console.log("\nTema claro: se lee");
  await sembrar("claro");
  const claro = await p.evaluate(() => {
    const v = (el, prop) => getComputedStyle(el).getPropertyValue(prop);
    const cuerpo = document.body;
    const burbuja = [...document.querySelectorAll("div")].find((d) => /Hola, ¿qué tal\?/.test(d.textContent ?? "") && d.className.includes("bg-tuyo"));
    const pre = document.querySelector(".prose-eclipse pre");
    return {
      fondo: v(cuerpo, "background-color"),
      texto: v(cuerpo, "color"),
      burbujaFondo: burbuja ? v(burbuja, "background-color") : null,
      burbujaTexto: burbuja ? v(burbuja, "color") : null,
      codigoFondo: pre ? v(pre, "background-color") : null,
      codigoTexto: pre ? v(pre, "color") : null,
      esquema: v(document.documentElement, "color-scheme"),
    };
  });
  ok(lum(rgb(claro.fondo)) > 0.7, `el fondo es claro de verdad (${claro.fondo})`);
  ok(claro.esquema.includes("light"), "y el navegador lo sabe (color-scheme)");
  const cTexto = contraste(rgb(claro.texto), rgb(claro.fondo));
  ok(cTexto >= 7, `texto sobre fondo: contraste ${cTexto.toFixed(1)} (la norma exige 4,5)`);
  if (claro.burbujaFondo) {
    const cBurbuja = contraste(rgb(claro.burbujaTexto), rgb(claro.burbujaFondo));
    ok(cBurbuja >= 4.5, `tu bocadillo: contraste ${cBurbuja.toFixed(1)}`);
  }
  if (claro.codigoFondo) {
    const cCodigo = contraste(rgb(claro.codigoTexto), rgb(claro.codigoFondo));
    ok(lum(rgb(claro.codigoFondo)) < 0.1, "el bloque de código se queda oscuro");
    ok(cCodigo >= 4.5, `y su texto se lee encima: contraste ${cCodigo.toFixed(1)}`);
  }

  console.log("\nTema oscuro: como estaba");
  await sembrar("oscuro");
  const oscuro = await p.evaluate(() => ({
    fondo: getComputedStyle(document.body).backgroundColor,
    texto: getComputedStyle(document.body).color,
    marca: document.documentElement.getAttribute("data-tema"),
  }));
  ok(lum(rgb(oscuro.fondo)) < 0.05, `sigue siendo oscuro (${oscuro.fondo})`);
  ok(oscuro.marca === null, "y sin marca de tema en el html");
  ok(contraste(rgb(oscuro.texto), rgb(oscuro.fondo)) >= 7, "con el contraste de siempre");

  console.log("\nSin elegir nada, manda el móvil");
  await ctx.close();
  const claroDeSistema = await navegador.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
  const p2 = await claroDeSistema.newPage();
  await p2.goto(URL_APP, { waitUntil: "domcontentloaded" });
  await p2.evaluate(() => localStorage.setItem("eclipse.entered", "1"));
  await p2.reload({ waitUntil: "networkidle" });
  await p2.waitForTimeout(1200);
  const conSistemaClaro = await p2.evaluate(() => document.documentElement.getAttribute("data-tema"));
  ok(conSistemaClaro === "claro", `con el móvil en claro, la app en claro (${conSistemaClaro})`);
  await claroDeSistema.close();

  ok(errores.length === 0, `sin errores de JavaScript (${errores.slice(0, 2).join(" | ")})`);
} finally {
  await navegador.close();
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
