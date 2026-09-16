/**
 * Las capturas del anuncio, sacadas de la aplicación DE VERDAD.
 *
 * El anuncio no dibuja ninguna pantalla: arranca ECLIPSE en local, lo abre en
 * un Chromium a tamaño de móvil y fotografía lo que sale. Lo único que se
 * sustituye son las respuestas del servidor —aquí no hay ni claves de modelo ni
 * base de datos—, y se sustituyen por las formas exactas que la aplicación
 * espera, así que quien pinta sigue siendo el código de ECLIPSE.
 *
 * Es más trabajo que maquetar una pantalla falsa, y es la única forma de que lo
 * que se anuncia sea lo que hay.
 *
 *   npx next dev -p 3100        (en otra terminal)
 *   node promo/src/capturar.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EXAMEN, FUENTES_CHAT, PREGUNTAS, RESPUESTA_CHAT, RESUMEN } from "./datos-demo.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CAPTURAS = resolve(AQUI, "..", "capturas");
const MATERIAL = resolve(AQUI, "..", "material");
const CHROME = process.env.CHROME_BIN || "/opt/pw-browsers/chromium";
const BASE = process.env.ECLIPSE_URL || "http://127.0.0.1:3100";

/* El móvil de referencia. A x3 salen 1170×2532: de sobra para un vídeo de
   1080 de ancho donde el teléfono nunca ocupa la pantalla entera. */
const MOVIL = { width: 390, height: 844 };
const NITIDEZ = 3;

const sse = (eventos) =>
  eventos.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");

/** Todo lo que el servidor contestaría si hubiera servidor. */
async function fingirServidor(ctx) {
  await ctx.route("**/api/pro", (r) =>
    r.fulfill({ json: { plan: "pro" } }),
  );

  // Sin esto, la bienvenida enseña el aviso de "conecta tu tienda", que en un
  // anuncio de estudiar no pinta nada.
  await ctx.route("**/api/conexiones**", (r) =>
    r.fulfill({ json: { servicios: [{ conectado: true }] } }),
  );

  await ctx.route("**/api/examen**", async (route) => {
    const req = route.request();
    if (req.method() === "GET") {
      const id = new URL(req.url()).searchParams.get("id");
      return route.fulfill({ json: id ? { examen: EXAMEN } : { examenes: [EXAMEN], pro: true } });
    }
    const cuerpo = req.postDataJSON() ?? {};
    if (cuerpo.accion === "quiz") return route.fulfill({ json: { preguntas: PREGUNTAS } });
    if (cuerpo.accion === "resumen") return route.fulfill({ json: { texto: RESUMEN } });
    if (cuerpo.accion === "resultado") return route.fulfill({ json: { ok: true } });
    return route.fulfill({ json: {} });
  });

  await ctx.route("**/api/chat", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
      body: sse([
        { t: "status", v: "Buscando en la web…" },
        { t: "sources", v: FUENTES_CHAT },
        { t: "text", v: RESPUESTA_CHAT },
        { t: "meta", v: { modelo: "eclipse" } },
        { t: "done", v: {} },
      ]),
    }),
  );
}

/** Entrar en la aplicación saltándose la portada. */
async function entrar(p) {
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.evaluate(() => window.localStorage.setItem("eclipse.entered", "1"));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector("textarea", { timeout: 20000 });
  await p.evaluate(() => document.fonts.ready);
}

const foto = async (p, nombre, opciones = {}) => {
  await p.waitForTimeout(350);
  await p.screenshot({ path: resolve(CAPTURAS, `${nombre}.png`), ...opciones });
  console.log("·", nombre);
};

const main = async () => {
  mkdirSync(CAPTURAS, { recursive: true });
  const navegador = await chromium.launch({ executablePath: CHROME });
  const ctx = await navegador.newContext({
    viewport: MOVIL,
    deviceScaleFactor: NITIDEZ,
    locale: "es-ES",
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark", // El anuncio es oscuro, y el tema lo decide el navegador.
    reducedMotion: "reduce", // Una captura no puede salir a mitad de una animación.
  });
  await fingirServidor(ctx);
  // El indicador de desarrollo de Next se cuela en la esquina de todas las
  // capturas. No es de ECLIPSE: fuera.
  await ctx.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = "nextjs-portal,[data-nextjs-toast]{display:none !important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  const p = await ctx.newPage();

  /* ------------------------------------------------------------- Portada */
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);
  await foto(p, "portada");

  /* ------------------------ Chat: apuntes adjuntos y respuesta con fuentes */
  await entrar(p);
  await p.setInputFiles('input[type="file"][accept^="image/*,video"]', [
    resolve(MATERIAL, "apuntes-tema4.png"),
    resolve(MATERIAL, "pizarra-clase.png"),
  ]);
  await p.waitForTimeout(500);
  await p.fill("textarea", "Explícame la diferencia entre mitosis y meiosis con mis apuntes");
  await p.waitForTimeout(300);
  await foto(p, "chat-adjuntos");

  await p.keyboard.press("Enter");
  // El texto sale a ritmo de lectura (~210 caracteres/s): hay que dejarle acabar.
  await p.waitForTimeout(6000);
  await p.evaluate(() => window.scrollTo(0, 0));
  await foto(p, "chat-respuesta");

  /* ------------------------------------------------------- Modo Examen */
  await p.getByRole("button", { name: "Abrir menú" }).click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Modo Examen" }).first().click();
  await p.waitForTimeout(900);
  await foto(p, "examen-lista");

  await p.getByText("Tema 4 · Genética").first().click();
  await p.waitForTimeout(900);
  await foto(p, "examen-mapa");

  await p.getByText("Resumen", { exact: true }).first().click();
  await p.waitForTimeout(1200);
  await foto(p, "examen-resumen");

  await p.getByText("Progreso", { exact: true }).first().click();
  await p.waitForTimeout(600);
  await foto(p, "examen-progreso");

  await p.getByRole("button", { name: /Ponme un test/ }).click();
  await p.waitForTimeout(700);
  await foto(p, "examen-tipos");

  await p.getByRole("button", { name: /Quiz rápido/ }).click();
  await p.waitForTimeout(900);
  await foto(p, "examen-pregunta");

  // Acertar la primera: la pantalla del acierto es la que cuenta la historia.
  // 300 ms: la pantalla del acierto dura 900 antes de pasar a la siguiente.
  await p.getByRole("button", { name: "Profase I" }).click();
  await p.waitForTimeout(300);
  await foto(p, "examen-acierto");

  await navegador.close();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
