// El Modo Examen entero, de punta a punta y con la aplicación levantada:
// crear un examen, subir apuntes, que los lea, el resumen, el test, el examen
// de desarrollo con su corrección, y que el progreso siga ahí al volver.
//
// El motor es de mentira y contesta lo que le digamos, que es justo lo que hace
// falta para lo importante: comprobar que una pregunta que NO sale de los
// apuntes no llega nunca a la pantalla, por mucho que el modelo la escriba.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as unPuerto } from "node:net";
import { readFileSync, existsSync, unlinkSync, openSync } from "node:fs";
import { RAIZ } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lo que va a contestar el motor en la siguiente llamada. */
let siguiente = "";
/** Lo que ha recibido, para poder mirar qué se le manda. */
const recibido = [];

const motor = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    if (req.url.includes("/models")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ data: [{ id: "llama-3.3-70b-versatile" }] }));
    }
    const cuerpo = JSON.parse(c || "{}");
    recibido.push(cuerpo);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: siguiente } }] }));
  });
});
await new Promise((r) => motor.listen(0, "127.0.0.1", r));
const baseMotor = `http://127.0.0.1:${motor.address().port}`;

const puertoRedis = `${AQUI}redis-examen.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-examen.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true, stdio: ["ignore", salida, salida],
  env: {
    ...process.env,
    UPSTASH_REDIS_REST_URL: urlRedis, UPSTASH_REDIS_REST_TOKEN: "t",
    AUTH_SECRET: "secreto-examen", PRO_ACCESS_CODE: "ECLIPSE-PRO",
    GROQ_API_KEY: "gsk_prueba", AI_PROVIDER: "groq", MOTOR_BASE_GROQ: baseMotor,
  },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

function sesion() {
  const galletas = new Map();
  return async (camino, opciones = {}) => {
    const r = await fetch(`${URL_APP}${camino}`, {
      ...opciones,
      headers: {
        ...(opciones.body ? { "Content-Type": "application/json" } : {}),
        ...(galletas.size ? { Cookie: [...galletas].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
      },
    });
    for (const c of r.headers.getSetCookie?.() ?? []) {
      const [par] = c.split(";");
      const i = par.indexOf("=");
      const v = par.slice(i + 1);
      if (v) galletas.set(par.slice(0, i), v); else galletas.delete(par.slice(0, i));
    }
    const t = await r.text();
    let json = null;
    try { json = JSON.parse(t); } catch { /* no era json */ }
    return { estado: r.status, json };
  };
}

// Un PNG mínimo de verdad, para que viaje como una foto de apuntes.
const FOTO = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let examenId = "";

try {
  console.log("\nLas puertas");
  const anon = sesion();
  const sinCuenta = await anon("/api/examen", { method: "POST", body: JSON.stringify({ accion: "crear", asignatura: "Biología" }) });
  ok(sinCuenta.estado === 401, `sin cuenta no se puede: los apuntes van en ella (${sinCuenta.estado})`);

  const yo = sesion();
  await yo("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: `est${Date.now()}@ejemplo.com`, password: "eclipse2026", nombre: "Karl" }) });
  await yo("/api/pro", { method: "POST", body: JSON.stringify({ code: "ECLIPSE-PRO" }) });

  console.log("\nCrear el examen");
  const creado = await yo("/api/examen", { method: "POST", body: JSON.stringify({
    accion: "crear", asignatura: "Biología", titulo: "Tema 4: la célula",
    fecha: "2026-10-21", temas: ["la célula", "mitosis"], extra: "El profe dijo que la meiosis no entra.",
  }) });
  examenId = creado.json?.examen?.id;
  ok(Boolean(examenId), "se crea y vuelve al instante, sin esperar a ningún modelo");
  ok(creado.json?.examen?.fecha === "2026-10-21", "con su fecha");
  ok(creado.json?.examen?.temas?.length === 2, "y con lo que ha dicho que entra");

  console.log("\nSubir apuntes y que los lea");
  siguiente = JSON.stringify({
    temas: [{ nombre: "Célula", emoji: "🧬", cobertura: 90 }, { nombre: "Mitosis", emoji: "🔬", cobertura: 60 }],
    trozos: [
      { tema: "Célula", texto: "La mitocondria es el orgánulo encargado de producir la energía de la célula en forma de ATP mediante la respiración celular.", archivo: "apuntes1.png", pagina: 1 },
      { tema: "Mitosis", texto: "La mitosis tiene cuatro fases: profase, metafase, anafase y telofase. En la metafase los cromosomas se alinean en el centro.", archivo: "apuntes1.png", pagina: 2 },
    ],
  });
  const analizado = await yo("/api/examen", { method: "POST", body: JSON.stringify({
    accion: "analizar", id: examenId,
    materiales: [{ nombre: "apuntes1.png", kind: "image", mime: "image/png", datos: FOTO }],
  }) });
  ok(analizado.json?.examen?.mapa?.length === 2, "sale el mapa del examen con sus temas");
  ok(analizado.json?.examen?.mapa?.[0]?.cobertura === 90, "con la cobertura de cada uno");
  ok(analizado.json?.examen?.extracto?.length === 2, "y el extracto de lo que pone de verdad");
  ok(analizado.json?.examen?.extracto?.[0]?.fuente?.pagina === 1, "cada trozo con su página, para poder ir a mirarlo");
  const mandado = JSON.stringify(recibido[recibido.length - 1] ?? {});
  ok(/image_url|image\//.test(mandado), "la foto se le manda de verdad al motor, no solo el nombre");
  ok(/no existe|Solo existe lo que está en los materiales/i.test(mandado), "con la orden de no inventarse nada por delante");

  console.log("\nUna foto que no se lee se dice, no se calla");
  siguiente = JSON.stringify({ temas: [], trozos: [] });
  const borrosa = await yo("/api/examen", { method: "POST", body: JSON.stringify({
    accion: "analizar", id: examenId,
    materiales: [{ nombre: "movida.png", kind: "image", mime: "image/png", datos: FOTO }],
  }) });
  ok((borrosa.json?.ilegibles ?? []).includes("movida.png"), "se avisa de la foto de la que no ha salido nada");
  const conAviso = borrosa.json?.examen?.materiales?.find((m) => m.nombre === "movida.png");
  ok(conAviso?.legible === false && /luz|mover/i.test(conAviso?.aviso ?? ""), "y se dice qué hacer: más luz y sin mover");
  ok(borrosa.json?.examen?.extracto?.length === 2, "y lo que ya había leído NO se pierde por subir una foto mala");

  console.log("\nEl resumen, solo de lo que hay");
  siguiente = "## 📚 De qué va\nLa célula y su división.\n\n## 🔑 Definiciones\n- Mitocondria: produce el ATP.";
  const resumen = await yo("/api/examen", { method: "POST", body: JSON.stringify({ accion: "resumen", id: examenId, largo: "rapido" }) });
  ok(/Mitocondria/.test(resumen.json?.texto ?? ""), "se escribe el resumen");
  const paraResumir = JSON.stringify(recibido[recibido.length - 1] ?? {});
  ok(/respiración celular/.test(paraResumir), "y se le pasa el contenido REAL de sus apuntes, no el título del examen");

  const otraVez = await yo("/api/examen", { method: "POST", body: JSON.stringify({ accion: "resumen", id: examenId, largo: "rapido" }) });
  ok(otraVez.json?.texto === resumen.json?.texto, "y se guarda: pedirlo otra vez no gasta otra llamada al modelo");

  console.log("\nEl test: lo inventado no llega a la pantalla");
  siguiente = JSON.stringify({ preguntas: [
    { enunciado: "¿Qué orgánulo produce la energía de la célula en forma de ATP?", opciones: ["La mitocondria", "El núcleo", "El ribosoma", "La vacuola"], correcta: 0, explicacion: "Lo pone en tus apuntes.", trozo: "t0" },
    { enunciado: "¿Quién formuló la teoría de la evolución?", opciones: ["Darwin", "Mendel", "Pasteur", "Linneo"], correcta: 0, explicacion: "Cultura general.", trozo: "t0" },
    { enunciado: "¿En qué fase de la mitosis se alinean los cromosomas en el centro?", opciones: ["Metafase", "Profase", "Anafase", "Telofase"], correcta: 0, explicacion: "Lo pone.", trozo: "t1" },
  ]});
  const quiz = await yo("/api/examen", { method: "POST", body: JSON.stringify({ accion: "quiz", id: examenId, tipo: "rapido" }) });
  const preguntas = quiz.json?.preguntas ?? [];
  ok(preguntas.length === 2, `de tres preguntas llegan las dos que salen de sus apuntes (${preguntas.length})`);
  ok(!preguntas.some((p) => /Darwin|evolución/i.test(p.enunciado)), "la de Darwin no llega: no está en sus apuntes aunque sea verdad");
  ok(preguntas[0]?.fuente?.archivo === "apuntes1.png", "y cada una viene con el archivo del que sale");

  console.log("\nSi NADA se puede respaldar, se dice en vez de inventar");
  siguiente = JSON.stringify({ preguntas: [
    { enunciado: "¿Cuál es la capital de Francia?", opciones: ["París", "Roma", "Berlín", "Madrid"], correcta: 0, explicacion: "x", trozo: "t0" },
  ]});
  const nada = await yo("/api/examen", { method: "POST", body: JSON.stringify({ accion: "quiz", id: examenId, tipo: "rapido" }) });
  ok(nada.estado === 502 && /no he podido sacar ni una pregunta/i.test(nada.json?.error ?? ""),
     "se dice claramente que no hay material, en vez de preguntar cualquier cosa");

  console.log("\nGuardar el resultado del test");
  const guardado = await yo("/api/examen", { method: "POST", body: JSON.stringify({
    accion: "resultado", id: examenId, tipo: "quiz", aciertos: 1, total: 2, nota: 5,
    porTema: { Célula: { bien: 1, total: 1 }, Mitosis: { bien: 0, total: 1 } }, falladas: ["Mitosis"],
  }) });
  ok(guardado.json?.examen?.intentos?.length === 1, "el intento queda guardado");
  ok(guardado.json?.examen?.intentos?.[0]?.nota === 5, "con su nota");

  console.log("\nEl examen de desarrollo, y su corrección");
  siguiente = JSON.stringify({ preguntas: [
    { enunciado: "Explica qué hace la mitocondria en la célula.", puntos: 2, espera: ["produce la energía de la célula", "en forma de ATP"], trozo: "t0" },
    { enunciado: "Explica el ciclo de Krebs paso por paso.", puntos: 3, espera: ["el acetil-CoA entra en el ciclo", "se generan NADH y FADH2"], trozo: "t0" },
  ]});
  const desarrollo = await yo("/api/examen", { method: "POST", body: JSON.stringify({ accion: "desarrollo", id: examenId }) });
  const largas = desarrollo.json?.preguntas ?? [];
  ok(largas.length === 1, "la que pide algo que no está en sus apuntes no se pone");
  ok(largas[0]?.puntos === 2, "y la buena viene con lo que vale");

  siguiente = JSON.stringify({ puntos: 1.5, bien: ["dices que produce energía"], falta: ["no mencionas el ATP"], errores: [], mejorar: ["nombra el ATP"], esperada: "La mitocondria produce ATP." });
  const corregido = await yo("/api/examen", { method: "POST", body: JSON.stringify({
    accion: "corregir", id: examenId, pregunta: largas[0], respuesta: "La mitocondria da energía a la célula.",
  }) });
  ok(corregido.json?.correccion?.puntos === 1.5, "la corrección da los puntos con medios puntos incluidos");
  ok(corregido.json?.correccion?.falta?.length === 1, "dice lo que falta");
  const paraCorregir = JSON.stringify(recibido[recibido.length - 1] ?? {});
  ok(/respiración celular/.test(paraCorregir), "y corrige contra SU material, no contra lo que el modelo se imagine");

  console.log("\nAl volver, todo sigue ahí");
  const lista = await yo("/api/examen");
  ok(lista.json?.examenes?.length === 1, "el examen está en la lista");
  ok(lista.json?.examenes?.[0]?.trozos === 2, "con lo que aprendió de los apuntes");
  ok(lista.json?.examenes?.[0]?.extracto === undefined, "pero la lista NO se trae los apuntes enteros: solo cuántos hay");
  const entero = await yo(`/api/examen?id=${examenId}`);
  ok(entero.json?.examen?.extracto?.length === 2, "y al abrirlo sí vienen enteros");
  ok(entero.json?.examen?.intentos?.length === 1, "con el progreso de antes");

  console.log("\nLo de cada uno es de cada uno");
  const otra = sesion();
  await otra("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: `otra${Date.now()}@ejemplo.com`, password: "eclipse2026" }) });
  await otra("/api/pro", { method: "POST", body: JSON.stringify({ code: "ECLIPSE-PRO" }) });
  const suyos = await otra("/api/examen");
  ok((suyos.json?.examenes ?? []).length === 0, "otra persona no ve los exámenes de la primera");
  const colado = await otra(`/api/examen?id=${examenId}`);
  ok(colado.estado === 404, "ni entrando por el identificador");

  console.log("\nY se puede borrar");
  await yo(`/api/examen?id=${examenId}`, { method: "DELETE" });
  const vacio = await yo("/api/examen");
  ok((vacio.json?.examenes ?? []).length === 0, "borrar borra de verdad");
} finally {
  motor.close();
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
  redis.kill();
  if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
