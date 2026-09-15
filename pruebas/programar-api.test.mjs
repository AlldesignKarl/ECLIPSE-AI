// Programar, de punta a punta: crear un encargo, que el reloj de la noche lo
// dispare sin nadie delante, y que el resultado aparezca. Con un motor de
// mentira, para no gastar cuota ni depender de que nadie conteste.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as unPuerto } from "node:net";
import { readFileSync, existsSync, unlinkSync, openSync } from "node:fs";
import { RAIZ } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Un Groq de mentira. Devuelve un parte creíble, y apunta qué se le pidió.
const pedidos = [];
const motor = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    if (req.url.includes("/models")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ data: [{ id: "llama-3.3-70b-versatile" }] }));
    }
    const b = JSON.parse(c || "{}");
    pedidos.push(b);

    /*
      Planificar no va en flujo: es una sola respuesta con un JSON dentro. Se
      distingue por eso, que es justo como lo distingue el proveedor de verdad.
    */
    if (!b.stream) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        choices: [{ message: { content: "```json\n" + JSON.stringify({
          nota: "Te lo reparto para que no te caiga todo el lunes.",
          encargos: [
            { titulo: "Pedidos de ayer", instruccion: "Mira los pedidos de ayer y dime cuánto suman.", cuando: { tipo: "diario" } },
            { titulo: "Repaso del SEO", instruccion: "Audita la web y dime solo lo que haya que arreglar.", cuando: { tipo: "semanal", dia: 2 } },
          ],
        }) + "\n```" } }],
      }));
    }

    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Hoy 3 pedidos, 74,20 € en total. Sin roturas de stock." } }] })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });
});
await new Promise((r) => motor.listen(0, "127.0.0.1", r));
const baseMotor = `http://127.0.0.1:${motor.address().port}`;

const puertoRedis = `${AQUI}redis-tareas.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-tareas.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true, stdio: ["ignore", salida, salida],
  env: {
    ...process.env,
    UPSTASH_REDIS_REST_URL: urlRedis, UPSTASH_REDIS_REST_TOKEN: "t",
    AUTH_SECRET: "secreto-tareas", PRO_ACCESS_CODE: "ECLIPSE-PRO",
    CRON_SECRET: "reloj-secreto",
    // El motor de mentira, puesto como si fuera Groq del servidor.
    GROQ_API_KEY: "gsk_prueba", AI_PROVIDER: "groq",
    MOTOR_BASE_GROQ: baseMotor,
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
        ...opciones.headers,
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

try {
  console.log("\nLas puertas");
  const anon = sesion();
  const sinNada = await anon("/api/tareas", { method: "POST", body: JSON.stringify({ instruccion: "x", cuando: { tipo: "diario" } }) });
  ok(sinNada.estado === 402, `sin Pro no se puede programar (${sinNada.estado})`);

  const yo = sesion();
  const correo = `tareas${Date.now()}@ejemplo.com`;
  await yo("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: correo, password: "eclipse2026" }) });
  await yo("/api/pro", { method: "POST", body: JSON.stringify({ code: "ECLIPSE-PRO" }) });

  console.log("\nCrear un encargo");
  const hoy = new Date().getUTCDay();
  const creado = await yo("/api/tareas", {
    method: "POST",
    body: JSON.stringify({ titulo: "Cómo va la tienda", instruccion: "Mira los pedidos de hoy y dime cuántos hay.", cuando: { tipo: "semanal", dia: hoy } }),
  });
  ok(creado.estado === 200 && creado.json?.tarea?.id, `se crea (${creado.json?.error ?? "ok"})`);
  ok(creado.json?.tarea?.activa === true, "y nace activo");

  const sinTitulo = await yo("/api/tareas", { method: "POST", body: JSON.stringify({ instruccion: "Dime algo interesante cada mañana sobre el mundo", cuando: { tipo: "diario" } }) });
  ok(/Dime algo interesante/.test(sinTitulo.json?.tarea?.titulo ?? ""), "sin título, se usa el principio del encargo");

  const malo = await yo("/api/tareas", { method: "POST", body: JSON.stringify({ instruccion: "x", cuando: { tipo: "cuando me apetezca" } }) });
  ok(malo.estado === 400, "un «cada cuánto» inventado se rechaza");

  console.log("\nAbrir la pantalla NO ejecuta nada");
  pedidos.length = 0;
  const empezo = Date.now();
  const abrir = await yo("/api/tareas");
  const tardo = Date.now() - empezo;
  ok(abrir.estado === 200, "la lista carga");
  ok(pedidos.length === 0, "y NO llama al motor: abrir es mirar, no trabajar");
  ok(tardo < 3000, `contesta al momento (${tardo} ms), no en minutos`);
  ok(abrir.json?.pendientes === 2, `pero dice cuántos quedan por hacer (${abrir.json?.pendientes})`);

  console.log("\nPonerse al día, de uno en uno");
  pedidos.length = 0;
  const uno = await yo("/api/tareas?hacer=1", { method: "POST" });
  ok(uno.json?.hecha?.ok === true, "una petición hace UN encargo");
  ok(pedidos.length === 1, `y una sola llamada al motor (${pedidos.length})`);
  ok(uno.json?.quedan === 1, `diciendo cuántos quedan (${uno.json?.quedan})`);
  ok(uno.json?.resultados?.length === 1, "el parte ya está listo para verse");

  const dos = await yo("/api/tareas?hacer=1", { method: "POST" });
  ok(dos.json?.quedan === 0, "a la siguiente ya no queda ninguno");
  ok(dos.json?.resultados?.length === 2, "y están los dos partes");

  const tres = await yo("/api/tareas?hacer=1", { method: "POST" });
  ok(tres.json?.hecha === null, "pedirlo de más no hace nada, ni falla");

  // Copia, no referencia: lo de abajo vacía `pedidos` a propósito.
  const pedidosDelDia = [...pedidos];

  console.log("\nEl reloj de la noche, sin nadie delante");
  const sinClave = await fetch(`${URL_APP}/api/tareas/ejecutar`);
  ok(sinClave.status === 401, "sin el secreto, no se puede disparar");

  // Lo que estaba roto de verdad: sin CRON_SECRET puesto, el reloj de Vercel
  // se comía un 401 cada noche y no se hacía nada nunca.
  const comoVercel = await fetch(`${URL_APP}/api/tareas/ejecutar`, {
    headers: { "x-vercel-cron": "0 6 * * *" },
  });
  ok(comoVercel.status === 200, "pero el reloj de Vercel SÍ entra, aunque no haya secreto puesto");
  const porAgente = await fetch(`${URL_APP}/api/tareas/ejecutar`, {
    headers: { "user-agent": "vercel-cron/1.0" },
  });
  ok(porAgente.status === 200, "y también si se identifica por su agente");

  pedidos.length = 0;
  const reloj = await fetch(`${URL_APP}/api/tareas/ejecutar?clave=reloj-secreto`);
  const resumen = await reloj.json();
  ok(reloj.status === 200, "con el secreto, corre");
  // Los dos de hoy ya se hicieron al ponerse al día, así que aquí no queda
  // nada: justo la prueba de que no se duplica el trabajo.
  ok(resumen.hechas === 0, `no repite lo que ya está hecho (${resumen.hechas} hechas)`);
  ok(pedidos.length === 0, "ni vuelve a llamar al motor");

  const primero = pedidosDelDia[0];
  const sistema = primero?.messages?.find((m) => m.role === "system")?.content ?? "";
  ok(/Nada de preguntas/.test(sistema), "se le dice que no pregunte: no hay quien conteste");
  ok(!JSON.stringify(resumen).includes(correo), "el resumen NO lleva el correo de nadie");

  console.log("\nEl resultado llega");
  const tras = await yo("/api/tareas");
  ok(tras.json?.resultados?.length === 2, `hay dos resultados (${tras.json?.resultados?.length})`);
  ok(/3 pedidos/.test(tras.json?.resultados?.[0]?.texto ?? ""), "con lo que escribió el motor");
  ok(tras.json?.resultados?.every((r) => r.nueva), "y marcados como nuevos, para encender el punto");

  console.log("\nNo se repite el mismo día");
  pedidos.length = 0;
  const segunda = await (await fetch(`${URL_APP}/api/tareas/ejecutar?clave=reloj-secreto`)).json();
  ok(segunda.hechas === 0, `disparar el reloj otra vez no repite nada (${segunda.hechas})`);
  ok(pedidos.length === 0, "y no vuelve a llamar al motor");
  const alAbrir = await yo("/api/tareas");
  ok(alAbrir.json?.pendientes === 0, "y al abrir ya no queda ninguno pendiente");

  console.log("\nDar por leídos y pausar");
  await yo("/api/tareas", { method: "PATCH", body: JSON.stringify({ leidos: true }) });
  const leidos = await yo("/api/tareas");
  ok(leidos.json?.resultados?.every((r) => !r.nueva), "se apagan los puntos");

  const id = creado.json.tarea.id;
  await yo("/api/tareas", { method: "PATCH", body: JSON.stringify({ id, activa: false }) });
  const pausada = await yo("/api/tareas");
  ok(pausada.json?.tareas?.find((t) => t.id === id)?.activa === false, "se puede pausar");

  console.log("\nBorrar");
  await yo(`/api/tareas?id=${id}`, { method: "DELETE" });
  const borrada = await yo("/api/tareas");
  ok(!borrada.json?.tareas?.some((t) => t.id === id), "el encargo desaparece");
  ok(!borrada.json?.resultados?.some((r) => r.tareaId === id), "y sus resultados con él, sin dejar huérfanos");

  console.log("\nQue lo planifique él");
  const plan = await yo("/api/tareas?planear=1", { method: "POST", body: JSON.stringify({ deseo: "Llevar mi tienda al día sin mirarla cada mañana" }) });
  ok(plan.estado === 200 && plan.json?.plan?.encargos?.length === 2, `devuelve un plan con lo que ha repartido (${plan.json?.error ?? "ok"})`);
  ok(/reparto/.test(plan.json?.plan?.nota ?? ""), "y la nota que dice por qué lo ha repartido así");
  const antesDelPlan = (await yo("/api/tareas")).json?.tareas?.length ?? 0;
  ok(!(await yo("/api/tareas")).json?.tareas?.some((t) => t.titulo === "Pedidos de ayer"),
     "planificar NO guarda nada todavía: se mira antes de que exista");
  ok(!(await yo("/api/tareas?planear=1", { method: "POST", body: JSON.stringify({}) })).json?.plan,
     "y sin decir qué quieres no hay plan");

  console.log("\nAceptar el plan entero de un toque");
  const puestos = await yo("/api/tareas", { method: "POST", body: JSON.stringify({ encargos: plan.json.plan.encargos }) });
  ok(puestos.estado === 200 && puestos.json?.tareas?.length === 2, "los dos encargos se guardan en una sola petición");
  const conPlan = await yo("/api/tareas");
  ok((conPlan.json?.tareas?.length ?? 0) === antesDelPlan + 2, "y aparecen en la lista");
  ok(conPlan.json?.tareas?.some((t) => t.cuando?.tipo === "semanal" && t.cuando?.dia === 2), "cada uno con el día que le puso");

  console.log("\nUn encargo de un día concreto");
  const hoyISO = new Date().toISOString().slice(0, 10);
  const unDia = await yo("/api/tareas", { method: "POST", body: JSON.stringify({ titulo: "Lo del viaje", instruccion: "Prepárame lo del viaje.", cuando: { tipo: "unavez", fecha: hoyISO } }) });
  ok(unDia.json?.tarea?.cuando?.tipo === "unavez", "se puede programar para un día suelto");
  await yo(`/api/tareas?hacer=1&id=${unDia.json.tarea.id}`, { method: "POST" });
  const despues = await yo("/api/tareas");
  const yaFue = despues.json?.tareas?.find((t) => t.id === unDia.json.tarea.id);
  ok(despues.json?.resultados?.some((r) => r.tareaId === unDia.json.tarea.id), "«hacerlo ahora» entrega el parte sin esperar a mañana");
  ok(yaFue?.activa === false, "y un encargo de un día concreto se apaga solo al hacerse: si no, se repetiría cada día para siempre");

  console.log("\nCada uno los suyos");
  const otro = sesion();
  await otro("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: `otro${Date.now()}@ejemplo.com`, password: "eclipse2026" }) });
  await otro("/api/pro", { method: "POST", body: JSON.stringify({ code: "ECLIPSE-PRO" }) });
  const suyo = await otro("/api/tareas");
  ok((suyo.json?.tareas?.length ?? 0) === 0, "otra persona no ve los encargos de la primera");
  ok((suyo.json?.resultados?.length ?? 0) === 0, "ni sus resultados");
} finally {
  motor.close();
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
  redis.kill();
  if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
