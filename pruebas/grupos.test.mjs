// Los grupos de punta a punta: crear, invitar, entrar con el enlace, hablar,
// que ECLIPSE conteste cuando le hablan y se calle cuando no, y que nadie vea
// el correo de nadie.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as unPuerto } from "node:net";
import { readFileSync, existsSync, unlinkSync, openSync } from "node:fs";
import { RAIZ, SRC, crearJiti, enSrc } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

/* ------------------- La regla de cuándo abre la boca ------------------- */
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { leHablanAEclipse, comoSeLeVe } = await jiti.import(enSrc("lib/grupos/tipos.ts"));

console.log("\n¿Le hablan a ECLIPSE o hablan entre ellos?");
ok(leHablanAEclipse("eclipse, ¿qué tiempo hará?"), "por su nombre, sí");
ok(leHablanAEclipse("@eclipse búscanos un sitio"), "con arroba también");
ok(leHablanAEclipse("ECLIPSE dinos algo"), "en mayúsculas igual");
ok(leHablanAEclipse("dinos tres planes para el sábado"), "una orden directa, sí");
ok(leHablanAEclipse("búscanos un hotel"), "«búscanos», sí");
ok(leHablanAEclipse("lo que sea", true), "y el primer mensaje del grupo siempre");
// De fábrica contesta a todo; el modo «nombrado» es el que se calla, y sigue
// ahí para quien lo prefiera. (Esto cambió a propósito: ver eclipse-grupo.)
ok(leHablanAEclipse("yo el sábado no puedo"), "de fábrica contesta también a lo suyo");
ok(!leHablanAEclipse("yo el sábado no puedo", false, "nombrado"), "y en «si le nombráis», hablando entre ellos NO");
ok(!leHablanAEclipse("jajaja qué bueno", false, "nombrado"), "una risa tampoco");
ok(!leHablanAEclipse("¿y tú puedes, Ana?", false, "nombrado"), "una pregunta a otra persona tampoco");

console.log("\nCómo se le ve a cada uno");
ok(comoSeLeVe("carlos@ejemplo.com", "Karl") === "Karl", "con nombre puesto, su nombre");
ok(comoSeLeVe("carlos@ejemplo.com") === "carlos", "sin nombre, lo de antes de la arroba");
ok(!comoSeLeVe("carlos@ejemplo.com").includes("@"), "y nunca el correo entero");

/* ---------------------------- Todo montado ----------------------------- */
const motor = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    if (req.url.includes("/models")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ data: [{ id: "llama-3.3-70b-versatile" }] }));
    }
    globalThis.__ultimo = JSON.parse(c || "{}");
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Os propongo el sábado por la mañana." } }] })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });
});
await new Promise((r) => motor.listen(0, "127.0.0.1", r));

const puertoRedis = `${AQUI}redis-grupos.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

const PUERTO = await new Promise((r) => { const s = unPuerto(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true,
  stdio: ["ignore", openSync(`${AQUI}app-grupos.log`, "w"), openSync(`${AQUI}app-grupos.log`, "a")],
  env: {
    ...process.env, UPSTASH_REDIS_REST_URL: urlRedis, UPSTASH_REDIS_REST_TOKEN: "t",
    AUTH_SECRET: "s-grupos", PRO_ACCESS_CODE: "ECLIPSE-PRO",
    GROQ_API_KEY: "gsk_p", AI_PROVIDER: "groq", MOTOR_BASE_GROQ: `http://127.0.0.1:${motor.address().port}`,
  },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

function sesion() {
  const g = new Map();
  return async (camino, opciones = {}) => {
    const r = await fetch(`${URL_APP}${camino}`, {
      ...opciones,
      headers: {
        ...(opciones.body ? { "Content-Type": "application/json" } : {}),
        ...(g.size ? { Cookie: [...g].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
      },
    });
    for (const c of r.headers.getSetCookie?.() ?? []) {
      const [par] = c.split(";"); const i = par.indexOf("=");
      const v = par.slice(i + 1);
      if (v) g.set(par.slice(0, i), v); else g.delete(par.slice(0, i));
    }
    const t = await r.text();
    let json = null; try { json = JSON.parse(t); } catch { /* */ }
    return { estado: r.status, json };
  };
}

try {
  console.log("\nCrear un grupo");
  const ana = sesion();
  const correoAna = `ana${Date.now()}@ejemplo.com`;
  await ana("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: correoAna, password: "eclipse2026", nombre: "Ana" }) });

  const sinPro = await ana("/api/grupos", { method: "POST", body: JSON.stringify({ nombre: "El viaje" }) });
  ok(sinPro.estado === 402, `crear sin Pro se rechaza (${sinPro.estado})`);

  await ana("/api/pro", { method: "POST", body: JSON.stringify({ code: "ECLIPSE-PRO" }) });
  const creado = await ana("/api/grupos", { method: "POST", body: JSON.stringify({ nombre: "El viaje" }) });
  ok(creado.estado === 200 && creado.json?.grupo?.id, "con Pro se crea");
  ok(creado.json?.grupo?.soyDueno === true, "y quien lo crea es el dueño");
  ok(Boolean(creado.json?.grupo?.invitacion), "con su invitación");
  const grupo = creado.json.grupo;

  console.log("\nEntrar con la invitación");
  const luis = sesion();
  const correoLuis = `luis${Date.now()}@ejemplo.com`;
  await luis("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: correoLuis, password: "eclipse2026", nombre: "Luis" }) });

  const ojeada = await luis(`/api/grupos?invitacion=${grupo.invitacion}`);
  ok(ojeada.json?.ojeada?.nombre === "El viaje", "antes de entrar se puede ver de qué grupo es");

  const entrada = await luis("/api/grupos", { method: "POST", body: JSON.stringify({ invitacion: grupo.invitacion }) });
  ok(entrada.estado === 200, `entra SIN tener Pro: paga quien monta la mesa (${entrada.estado})`);
  ok(entrada.json?.grupo?.miembros?.length === 2, "ya son dos");
  ok(entrada.json?.grupo?.soyDueno === false, "y el invitado no es dueño");
  ok(!entrada.json?.grupo?.invitacion, "al invitado no se le da la llave de invitar");

  console.log("\nNadie ve el correo de nadie");
  const visto = JSON.stringify(entrada.json);
  ok(!visto.includes(correoAna), "el correo de quien creó el grupo no viaja");
  ok(!visto.includes(correoLuis), "ni el suyo propio");
  ok(visto.includes("Ana") && visto.includes("Luis"), "solo los nombres");

  console.log("\nHablar en el grupo");
  // Mandar un mensaje NO espera a que conteste ECLIPSE: es lo que hace que el
  // grupo vaya rápido. Se comprueba con el reloj, que es donde se notaba.
  const empezo = Date.now();
  const entreEllos = await luis("/api/grupos/mensajes", { method: "POST", body: JSON.stringify({ id: grupo.id, texto: "¿y si vamos el finde?" }) });
  const tardo = Date.now() - empezo;
  ok(entreEllos.json?.ok === true, "el mensaje se guarda");
  ok(tardo < 1500, `y vuelve al momento, sin esperar al modelo (${tardo} ms)`);
  ok(entreEllos.json?.contesta === true, "y avisa de que ECLIPSE va a contestar");

  // De fábrica contesta a todo: es lo que espera cualquiera que mete una IA en
  // un grupo, y lo contrario —adivinar la palabra mágica— es lo que hacía que
  // pareciera que no estaba.
  const cualquiera = await ana("/api/grupos/mensajes", { method: "POST", body: JSON.stringify({ id: grupo.id, texto: "yo el sábado no puedo" }) });
  ok(cualquiera.json?.contesta === true, "contesta también a lo que no le nombra");

  await luis("/api/grupos/mensajes?responder=1", { method: "POST", body: JSON.stringify({ id: grupo.id }) });
  const conRespuesta = await luis(`/api/grupos/mensajes?id=${grupo.id}`);
  ok((conRespuesta.json?.mensajes ?? []).some((m) => m.deEclipse), "y al pedirle la respuesta, contesta de verdad");

  // Dos personas escribiendo a la vez piden la respuesta cada una por su
  // cuenta: no puede contestar dos veces a lo mismo.
  const repetida = await ana("/api/grupos/mensajes?responder=1", { method: "POST", body: JSON.stringify({ id: grupo.id }) });
  ok(repetida.json?.contesta === false, "y no contesta dos veces a lo mismo");

  console.log("\nY el modo de antes, para quien lo quiera");
  await ana("/api/grupos", { method: "PATCH", body: JSON.stringify({ id: grupo.id, accion: "eclipse", modo: "nombrado" }) });
  const callado = await luis("/api/grupos/mensajes", { method: "POST", body: JSON.stringify({ id: grupo.id, texto: "vale, pues el domingo" }) });
  ok(callado.json?.contesta === false, "puesto a «si le nombráis», hablando entre ellos se calla");

  const llamado = await ana("/api/grupos/mensajes", { method: "POST", body: JSON.stringify({ id: grupo.id, texto: "eclipse, ¿qué hacemos el domingo?" }) });
  ok(llamado.json?.contesta === true, "y cuando le nombran, contesta");
  await ana("/api/grupos/mensajes?responder=1", { method: "POST", body: JSON.stringify({ id: grupo.id }) });

  const mensajes = await luis(`/api/grupos/mensajes?id=${grupo.id}`);
  const lista = mensajes.json?.mensajes ?? [];
  ok(lista.length >= 5, `se ve todo lo dicho (${lista.length} mensajes)`);
  ok(lista.some((m) => m.deEclipse), "incluido lo de ECLIPSE");
  ok(lista.some((m) => m.nombre === "Ana") && lista.some((m) => m.nombre === "Luis"), "con quién dijo cada cosa");
  ok(!JSON.stringify(lista).includes("@ejemplo.com"), "y sin un solo correo");

  // Lo que ve el modelo: los nombres delante.
  const alModelo = JSON.stringify(globalThis.__ultimo ?? {});
  ok(/Ana:/.test(alModelo) && /Luis:/.test(alModelo), "al modelo le llega quién dijo qué");
  ok(/GRUPO/.test(alModelo), "y que esto es un grupo");

  console.log("\nQuien no está dentro, no entra");
  const ajeno = sesion();
  await ajeno("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: `x${Date.now()}@ejemplo.com`, password: "eclipse2026" }) });
  const fisgon = await ajeno(`/api/grupos/mensajes?id=${grupo.id}`);
  ok(fisgon.estado === 403, `leer un grupo ajeno se rechaza (${fisgon.estado})`);
  const colado = await ajeno("/api/grupos/mensajes", { method: "POST", body: JSON.stringify({ id: grupo.id, texto: "hola" }) });
  ok(colado.estado === 403, "y escribir en él, también");

  console.log("\nAdministrar");
  const renovada = await ana("/api/grupos", { method: "PATCH", body: JSON.stringify({ id: grupo.id, accion: "renovar" }) });
  ok(renovada.json?.invitacion && renovada.json.invitacion !== grupo.invitacion, "el dueño puede cambiar la invitación");
  const vieja = await ajeno("/api/grupos", { method: "POST", body: JSON.stringify({ invitacion: grupo.invitacion }) });
  ok(vieja.estado === 400, "y la anterior deja de valer al momento");

  const noDueno = await luis("/api/grupos", { method: "PATCH", body: JSON.stringify({ id: grupo.id, accion: "renovar" }) });
  ok(noDueno.estado === 403, "quien no es dueño no puede");

  const echado = await ana("/api/grupos", { method: "PATCH", body: JSON.stringify({ id: grupo.id, accion: "echar", aQuien: "Luis" }) });
  ok(echado.estado === 200, "el dueño puede echar a alguien");
  const tras = await luis(`/api/grupos/mensajes?id=${grupo.id}`);
  ok(tras.estado === 403, "y el echado deja de ver el grupo");

  console.log("\nBorrar");
  await ana(`/api/grupos?id=${grupo.id}&borrar=1`, { method: "DELETE" });
  const mios = await ana("/api/grupos");
  ok(!mios.json?.grupos?.some((g) => g.id === grupo.id), "el grupo desaparece");
} finally {
  motor.close();
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
  redis.kill();
  if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
