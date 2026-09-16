// El agente del correo, de punta a punta y con la aplicación levantada.
//
// Esto es lo que Carlos pidió comprobar antes de que nadie pague: que el camino
// entero —dar permiso a Google, volver, quedar conectado y que el agente lea el
// correo de verdad— funciona, y que los frenos frenan.
//
//   1. Conectar Gmail exige Pro y cuenta, comprobado en el servidor.
//   2. De quién es la vuelta lo dice el `state` FIRMADO, no la cookie. Una
//      vuelta abierta en otro navegador no conecta el correo de otro.
//   3. ECLIPSE INBOX va incluido en Pro: se activa sin pasarela y sin cobrar.
//   4. Y se apaga si se deja de ser Pro.
//   5. Sin Gmail conectado, INBOX no trabaja y dice qué falta.
//   6. Con Gmail conectado, lee el correo DE VERDAD.
//   7. En solo lectura no envía, aunque el modelo lo pida.
//   8. Y el testigo renovado se GUARDA: no se renueva en cada llamada.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as unPuerto } from "node:net";
import { readFileSync, existsSync, unlinkSync, openSync } from "node:fs";
import { crear, ESPERADO } from "./google-falso.mjs";
import { RAIZ } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const { servidor: google, estado: g } = crear();
await new Promise((r) => google.listen(0, "127.0.0.1", r));
const baseGoogle = `http://127.0.0.1:${google.address().port}`;

/** Lo que va a pedir el modelo en su siguiente turno. */
let guion = [];
const recibido = [];
const motor = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    if (req.url.includes("/models")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ data: [{ id: "llama-3.3-70b-versatile" }] }));
    }
    recibido.push(JSON.parse(c || "{}"));
    const paso = guion.shift() ?? { texto: "Hecho." };
    res.writeHead(200, { "content-type": "text/event-stream" });
    if (paso.llamada) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", type: "function", function: { name: paso.llamada.nombre, arguments: JSON.stringify(paso.llamada.args) } }] } }] })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: paso.texto } }] })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  });
});
await new Promise((r) => motor.listen(0, "127.0.0.1", r));
const baseMotor = `http://127.0.0.1:${motor.address().port}`;

const puertoRedis = `${AQUI}redis-gmail.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-gmail.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true, stdio: ["ignore", salida, salida],
  env: {
    ...process.env,
    UPSTASH_REDIS_REST_URL: urlRedis, UPSTASH_REDIS_REST_TOKEN: "t",
    AUTH_SECRET: "secreto-gmail", PRO_ACCESS_CODE: "ECLIPSE-PRO",
    GROQ_API_KEY: "gsk_prueba", AI_PROVIDER: "groq", MOTOR_BASE_GROQ: baseMotor,
    GOOGLE_OAUTH_ID: ESPERADO.ID, GOOGLE_OAUTH_SECRET: ESPERADO.SECRETO,
    CONEXION_BASE_OAUTH_GOOGLE: `${baseGoogle}/oauth/auth`,
    CONEXION_BASE_OAUTH_GOOGLE_TOKEN: `${baseGoogle}/oauth/token`,
    CONEXION_BASE_GMAIL: `${baseGoogle}/gmail/v1/users/me`,
  },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

/** Una sesión con sus cookies, que NO sigue las redirecciones: hay que mirarlas. */
function sesion() {
  const galletas = new Map();
  return async (camino, opciones = {}) => {
    const r = await fetch(`${URL_APP}${camino}`, {
      ...opciones,
      redirect: "manual",
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
    return { estado: r.status, json, donde: r.headers.get("location") ?? "" };
  };
}

/** Qué avisa la vuelta: `/?conexion=esto`. */
const avisoDe = (donde) => new URL(donde, URL_APP).searchParams.get("conexion") ?? "";

try {
  /* --------------------- Las puertas, en el servidor -------------------- */
  console.log("\nConectar Gmail exige Pro y cuenta, y se comprueba aquí");
  const anon = sesion();
  const sinPro = await anon("/api/conexiones/oauth/gmail?empezar=1");
  ok(sinPro.estado === 303 && avisoDe(sinPro.donde) === "solo_pro",
     `sin Pro no se empieza siquiera (${sinPro.estado} → ${avisoDe(sinPro.donde)})`);

  await anon("/api/pro", { method: "POST", body: JSON.stringify({ code: "ECLIPSE-PRO" }) });
  const sinCuenta = await anon("/api/conexiones/oauth/gmail?empezar=1");
  ok(avisoDe(sinCuenta.donde) === "sin_cuenta", "con Pro pero sin cuenta, tampoco: las claves cuelgan de un correo");

  const yo = sesion();
  const correo = `correo${Date.now()}@ejemplo.com`;
  await yo("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: correo, password: "eclipse2026", nombre: "Carlos" }) });
  await yo("/api/pro", { method: "POST", body: JSON.stringify({ code: "ECLIPSE-PRO" }) });

  console.log("\nCon las dos cosas, se va a Google");
  const ida = await yo("/api/conexiones/oauth/gmail?empezar=1");
  ok(ida.estado === 303 && ida.donde.startsWith(`${baseGoogle}/oauth/auth`), `se manda a Google (${ida.estado})`);
  const aGoogle = new URL(ida.donde);
  ok(aGoogle.searchParams.get("access_type") === "offline", "pidiendo permiso de los que duran");
  /*
    La vuelta es la dirección que hay que dar de alta en el panel de Google,
    letra por letra. Se saca del origen de la petición —igual que el pago de
    Stripe, que lleva funcionando en producción— así que el dominio cambia con
    el servidor; lo que no puede cambiar es la ruta.
  */
  const vuelta = new URL(aGoogle.searchParams.get("redirect_uri") ?? "http://x/");
  ok(vuelta.pathname === "/api/conexiones/oauth/gmail" && vuelta.port === String(PUERTO),
     `y con la vuelta a esta misma ruta (${vuelta.href})`);
  const estadoFirmado = aGoogle.searchParams.get("state");
  ok(Boolean(estadoFirmado), "llevándose un estado firmado");

  console.log("\nLas vueltas que no valen no conectan nada");
  const cancelada = await yo(`/api/conexiones/oauth/gmail?error=access_denied&state=${encodeURIComponent(estadoFirmado)}`);
  ok(avisoDe(cancelada.donde) === "cancelada", "si la persona dice que no, se dice y no se guarda nada");

  const inventado = await yo(`/api/conexiones/oauth/gmail?code=${ESPERADO.CODIGO}&state=esto.esinventado`);
  ok(avisoDe(inventado.donde) === "caducada", "un estado inventado no conecta");
  ok(g.canjes === 0, "y ni siquiera se le pide el código a Google: se para antes");

  const malCodigo = await yo(`/api/conexiones/oauth/gmail?code=noesbueno&state=${encodeURIComponent(estadoFirmado)}`);
  ok(avisoDe(malCodigo.donde) === "fallo", "y un código que Google rechaza se cuenta, no se da por bueno");

  /*
    Lo que de verdad sostiene esto.

    La vuelta de OTRA persona, abierta en ESTE navegador, no conecta su correo a
    esta cuenta. Lo dice el estado firmado, no la sesión. Sin esta comprobación,
    mandarle a alguien un enlace bastaría para colarle un buzón ajeno.
  */
  console.log("\nDe quién es la vuelta lo dice la firma, no la cookie");
  const otra = sesion();
  const correoOtra = `otra${Date.now()}@ejemplo.com`;
  await otra("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: correoOtra, password: "eclipse2026" }) });
  await otra("/api/pro", { method: "POST", body: JSON.stringify({ code: "ECLIPSE-PRO" }) });
  const idaOtra = await otra("/api/conexiones/oauth/gmail?empezar=1");
  const estadoDeOtra = new URL(idaOtra.donde).searchParams.get("state");

  // Un testigo que nace caducado: obliga a renovarlo ya, que es el camino que
  // hay que probar y el que nunca se prueba solo.
  g.duracionCanje = 60;
  g.duracionRefresco = 60;
  const colada = await yo(`/api/conexiones/oauth/gmail?code=${ESPERADO.CODIGO}&state=${encodeURIComponent(estadoDeOtra)}`);
  ok(avisoDe(colada.donde) === "ok_gmail", "la vuelta se procesa…");
  const mias = await yo("/api/conexiones");
  const miGmail = (mias.json?.servicios ?? []).find((s) => s.id === "gmail");
  ok(miGmail?.conectado === false, "…pero el buzón NO se conecta a la cuenta del navegador");
  const suyas = await otra("/api/conexiones");
  ok((suyas.json?.servicios ?? []).find((s) => s.id === "gmail")?.conectado === true,
     "sino a la de quien empezó, que es de quien está firmado el estado");

  /* ---------------------- La conexión, ya de verdad --------------------- */
  console.log("\nConectar de verdad");
  const ida2 = await yo("/api/conexiones/oauth/gmail?empezar=1");
  const miEstado = new URL(ida2.donde).searchParams.get("state");
  const refrescosAntes = g.refrescos;
  const hecho = await yo(`/api/conexiones/oauth/gmail?code=${ESPERADO.CODIGO}&state=${encodeURIComponent(miEstado)}`);
  ok(avisoDe(hecho.donde) === "ok_gmail", "vuelve diciendo que sí");
  const ahora = (await yo("/api/conexiones")).json?.servicios?.find((s) => s.id === "gmail");
  ok(ahora?.conectado === true, "Gmail queda conectado");
  ok(ahora?.cuenta === "yo@miempresa.com", `y dice a qué buzón, que es lo que se mira (${ahora?.cuenta})`);
  ok(ahora?.permiso === "leer",
     "nace en SOLO LECTURA aunque Google haya concedido también el enviar: son dos permisos distintos");
  ok(ahora?.oauth === "google" && ahora?.oauthListo === true,
     "la pantalla sabe que esto va con botón, no con formulario");
  ok(g.refrescos > refrescosAntes, "el testigo caducado se ha renovado solo, sin molestar a nadie");
  ok(!JSON.stringify(mias.json).includes("ref-1"), "y ningún testigo viaja al navegador");

  /* ------------------------------ El agente ----------------------------- */
  console.log("\nECLIPSE INBOX va incluido en Pro");
  const catalogo = await yo("/api/agentes");
  const inbox = (catalogo.json?.agentes ?? []).find((a) => a.id === "inbox");
  ok(Boolean(inbox), "está en el catálogo");
  ok(inbox?.precio === 0, "y no cuesta nada aparte");
  ok(/listo/.test(inbox?.diagnostico?.estado ?? ""), `con Gmail conectado ya está listo (${inbox?.diagnostico?.dice})`);

  const sinProAgente = sesion();
  const correoPobre = `pobre${Date.now()}@ejemplo.com`;
  await sinProAgente("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: correoPobre, password: "eclipse2026" }) });
  const negado = await sinProAgente("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "contratar", id: "inbox" }) });
  ok(negado.estado === 402 && negado.json?.code === "solo_pro",
     `sin Pro no se activa, y se comprueba en el servidor (${negado.estado})`);

  const activado = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "contratar", id: "inbox" }) });
  ok(activado.json?.contrato?.estado === "activo", "con Pro se activa directo");
  ok(activado.json?.conPro === true && !activado.json?.url,
     "sin abrir ninguna pasarela: no hay nada que cobrar");
  ok(Boolean(activado.json?.contrato?.instancia), "y con su instancia, como cualquier otra contratación");

  console.log("\nY lee el correo DE VERDAD");
  g.duracionRefresco = 3600;
  const refrescos1 = g.refrescos;
  guion = [
    { llamada: { nombre: "conexion", args: { servicio: "gmail", accion: "sin_leer", datos: {} } } },
    { texto: "Tienes dos sin leer: el pedido 1043 de Ana y la reunión del martes." },
  ];
  const trabajo = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "inbox", encargo: "qué tengo sin leer" }) });
  ok(trabajo.estado === 200, `el agente trabaja (${trabajo.estado} ${trabajo.json?.error ?? ""})`);
  ok(trabajo.json?.acciones?.some((a) => a.ok), "ha ejecutado una acción contra Gmail de verdad");
  const loLeido = JSON.stringify(recibido.at(-1)?.messages ?? []);
  ok(/Pedido 1043 sin llegar/.test(loLeido), "y lo que ha leído del buzón vuelve al modelo, no una invención");

  /*
    Renovar y GUARDAR.

    Renovar sin guardar funciona: nadie ve un error. Lo que pasa es que se
    renueva en CADA llamada, un viaje de más siempre. Esto lo mide.
  */
  ok(g.refrescos === refrescos1 + 1, `se ha renovado una vez para esta acción (${g.refrescos - refrescos1})`);
  guion = [
    { llamada: { nombre: "conexion", args: { servicio: "gmail", accion: "buscar_correo", datos: { consulta: "from:ana@clienta.com" } } } },
    { texto: "Ana te ha escrito dos veces." },
  ];
  await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "inbox", encargo: "qué me ha escrito Ana" }) });
  ok(g.refrescos === refrescos1 + 1, "y en la siguiente ya no: el testigo renovado se había guardado");

  console.log("\nEn solo lectura no sale ni un correo");
  const enviadosAntes = g.enviados.length;
  guion = [
    { llamada: { nombre: "conexion", args: { servicio: "gmail", accion: "enviar_correo", datos: { para: "ana@clienta.com", asunto: "Ya sale", texto: "Mañana" } } } },
    { texto: "No tengo permiso para enviar." },
  ];
  const intento = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "inbox", encargo: "contéstale a Ana" }) });
  ok(g.enviados.length === enviadosAntes, "no se ha llamado a Gmail: el freno está antes, no en el prompt");
  ok(intento.json?.acciones?.some((a) => !a.ok), "y se cuenta como no hecha, que es lo que es");

  console.log("\nCon permiso y aprobación, para y espera");
  await yo("/api/conexiones", { method: "PATCH", body: JSON.stringify({ servicio: "gmail", permiso: "escribir" }) });
  await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "config", id: "inbox", puedeEscribir: true, apruebaAntes: true }) });
  guion = [
    { llamada: { nombre: "conexion", args: { servicio: "gmail", accion: "enviar_correo", datos: { para: "ana@clienta.com", asunto: "Pedido 1043", texto: "Sale mañana, Ana." } } } },
    { texto: "Te lo dejo preparado." },
  ];
  const parado = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "inbox", encargo: "contéstale a Ana" }) });
  ok(g.enviados.length === enviadosAntes, "sigue sin salir: la aprobación PARA el correo, no lo avisa después");
  ok(parado.json?.enEspera === 1, `y queda esperando tu visto bueno (${parado.json?.enEspera})`);

  const pendiente = (await yo("/api/agentes?id=inbox")).json?.pendientes?.[0];
  ok(pendiente?.accion === "enviar_correo", "con la acción exacta que quería hacer");
  const aprobado = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "aprobar", id: "inbox", pendiente: pendiente.id }) });
  ok(aprobado.estado === 200, `se aprueba (${aprobado.estado} ${aprobado.json?.error ?? ""})`);
  ok(g.enviados.length === enviadosAntes + 1, "AHORA sí sale el correo");
  ok(/Subject: Pedido 1043/.test(g.enviados.at(-1).crudo),
     "y con lo que se aprobó, no con lo que el modelo quiera devolver la segunda vez");

  console.log("\nSi se deja de ser Pro, el agente se apaga");
  await yo("/api/pro", { method: "DELETE" });
  const yaNo = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "inbox", encargo: "mira el correo" }) });
  ok(yaNo.estado === 402 && /Pro/.test(yaNo.json?.error ?? ""),
     `sin Pro deja de trabajar, y se dice por qué (${yaNo.estado})`);
  ok(/rescindir|Vuelve a Pro/i.test(yaNo.json?.error ?? ""), "diciendo cómo recuperarlo, no con un código");

  console.log("\nY sin Gmail conectado, INBOX no se inventa un buzón");
  const nuevo = sesion();
  const correoNuevo = `nuevo${Date.now()}@ejemplo.com`;
  await nuevo("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: correoNuevo, password: "eclipse2026" }) });
  await nuevo("/api/pro", { method: "POST", body: JSON.stringify({ code: "ECLIPSE-PRO" }) });
  await nuevo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "contratar", id: "inbox" }) });
  const aCiegas = await nuevo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "inbox", encargo: "qué tengo sin leer" }) });
  ok(aCiegas.estado === 422, "no trabaja sin el buzón");
  ok(/gmail/i.test(aCiegas.json?.error ?? ""), `y dice exactamente qué falta: ${aCiegas.json?.error}`);
} finally {
  google.close();
  motor.close();
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
  redis.kill();
  if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
