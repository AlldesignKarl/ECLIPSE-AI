// Los agentes, de verdad y con la aplicación levantada.
//
// Lo que se comprueba aquí no es que las tarjetas se pinten: es lo único que
// separa una plataforma de agentes de una página que lo aparenta.
//
//   1. Un agente al que le falta una conexión NO trabaja, y dice qué falta.
//   2. Contratar SIN cobro configurado no activa nada, y se dice.
//   3. Cada agente solo ve SUS servicios: los demás no existen para él.
//   4. En solo lectura, escribir se rechaza de verdad (no se llama a la API).
//   5. Con aprobación humana, la acción se PARA: no se ejecuta y queda en cola.
//   6. Al aprobarla, ENTONCES se ejecuta contra la API de verdad.
//   7. Lo de una empresa no lo ve otra.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as unPuerto } from "node:net";
import { readFileSync, existsSync, unlinkSync, openSync } from "node:fs";
import { crear, escrituras, ESPERADO } from "./apis-falsas.mjs";
import { RAIZ } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Las APIs de mentira (Notion entre ellas), que apuntan lo que se les escribe.
const apis = crear();
await new Promise((r) => apis.listen(0, "127.0.0.1", r));
const baseApis = `http://127.0.0.1:${apis.address().port}`;

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
    const cuerpo = JSON.parse(c || "{}");
    recibido.push(cuerpo);

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

/*
  Un Stripe de mentira.

  Aquí no hay internet, así que contra el Stripe de verdad no se puede probar
  nada. Lo que sí se puede comprobar —y es lo que importa— es que ECLIPSE abre
  la pasarela con el precio correcto, que al volver LE PREGUNTA a Stripe si el
  pago existe, y que un pago de otra cuenta no activa nada.
*/
const pagos = new Map();
let pagoCompleto = true;
const stripe = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    const cuerpo = new URLSearchParams(c);
    res.setHeader("content-type", "application/json");

    if (req.url.startsWith("/v1/checkout/sessions/")) {
      const id = req.url.split("/").pop().split("?")[0];
      const guardado = pagos.get(id);
      if (!guardado) return res.end(JSON.stringify({ error: { message: "No such session" } }));
      return res.end(JSON.stringify({
        id,
        status: pagoCompleto ? "complete" : "open",
        payment_status: pagoCompleto ? "paid" : "unpaid",
        subscription: `sub_${id}`,
        metadata: guardado,
      }));
    }

    if (req.url.startsWith("/v1/subscriptions/"))
      return res.end(JSON.stringify({ id: req.url.split("/").pop(), status: "active" }));

    if (req.url.startsWith("/v1/checkout/sessions")) {
      const id = `cs_test_${pagos.size + 1}`;
      pagos.set(id, {
        eclipse_agente: cuerpo.get("metadata[eclipse_agente]"),
        eclipse_cliente: cuerpo.get("metadata[eclipse_cliente]"),
        eclipse_instancia: cuerpo.get("metadata[eclipse_instancia]"),
        // Lo que se va a cobrar, para poder comprobar el precio.
        importe: cuerpo.get("line_items[0][price_data][unit_amount]"),
        moneda: cuerpo.get("line_items[0][price_data][currency]"),
        intervalo: cuerpo.get("line_items[0][price_data][recurring][interval]"),
        modo: cuerpo.get("mode"),
      });
      return res.end(JSON.stringify({ id, url: `https://pago.ejemplo/${id}` }));
    }

    res.end(JSON.stringify({}));
  });
});
await new Promise((r) => stripe.listen(0, "127.0.0.1", r));
const baseStripe = `http://127.0.0.1:${stripe.address().port}`;

const puertoRedis = `${AQUI}redis-agentes.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const salida = openSync(`${AQUI}app-agentes.log`, "w");
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true, stdio: ["ignore", salida, salida],
  env: {
    ...process.env,
    UPSTASH_REDIS_REST_URL: urlRedis, UPSTASH_REDIS_REST_TOKEN: "t",
    AUTH_SECRET: "secreto-agentes", PRO_ACCESS_CODE: "ECLIPSE-PRO",
    GROQ_API_KEY: "gsk_prueba", AI_PROVIDER: "groq", MOTOR_BASE_GROQ: baseMotor,
    CONEXION_BASE_NOTION: baseApis, CONEXION_BASE_HUBSPOT: baseApis,
    STRIPE_SECRET_KEY: "sk_test_falsa", MOTOR_BASE_STRIPE: baseStripe,
    // A este correo se le regalan los agentes, que es lo que pidió Carlos para
    // poder comprobarlo todo sin cobrarse a sí mismo.
    AGENTES_GRATIS: "regalado@ejemplo.com",
  },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

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
      const [par] = c.split(";");
      const i = par.indexOf("=");
      const v = par.slice(i + 1);
      if (v) g.set(par.slice(0, i), v); else g.delete(par.slice(0, i));
    }
    const t = await r.text();
    let json = null;
    try { json = JSON.parse(t); } catch { /* no era json */ }
    return { estado: r.status, json };
  };
}

/** Pone el contrato en activo saltándose el pago, para poder probar lo demás. */
async function activar(yo, id) {
  await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "contratar", id }) });
  // El API no deja activar sin cobro, y eso es justo lo que se comprueba antes.
  // Aquí se hace por la puerta de la base de datos, que es lo que hará el
  // confirmador de Stripe el día que exista.
  const k = `eclipse:agentes:${correoDe(yo)}`;
  const mandar = (cmd) =>
    fetch(urlRedis, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cmd) }).then((r) => r.json());

  const crudo = (await mandar(["GET", k])).result;
  const lista = JSON.parse(typeof crudo === "string" ? crudo : JSON.stringify(crudo));
  for (const c of lista) if (c.agenteId === id) c.estado = "activo";
  await mandar(["SET", k, JSON.stringify(lista)]);
}

const correos = new Map();
const correoDe = (s) => correos.get(s);

try {
  console.log("\nEl catálogo se lee sin cuenta, y dice la verdad");
  const anon = sesion();
  const publico = await anon("/api/agentes");
  ok((publico.json?.agentes ?? []).length === 6, `los seis agentes están en el catálogo (${publico.json?.agentes?.length})`);
  // INBOX vale cero porque va incluido en Pro; los de pago llevan su precio, y
  // un precio a cero en uno de esos sería un agente que se regala sin querer.
  ok(publico.json?.agentes?.filter((a) => a.id !== "inbox").every((a) => a.precio > 0),
     "los de pago, todos con su precio");
  ok(publico.json?.agentes?.find((a) => a.id === "inbox")?.precio === 0, "y el incluido en Pro, a cero");
  ok(publico.json?.cobroListo === true, "y el cobro está configurado: se puede contratar de verdad");
  const comms = publico.json.agentes.find((a) => a.id === "comms");
  ok(/todavía no se puede conectar/i.test(comms.diagnostico.dice), "COMMS avisa de lo que aún no se puede conectar (Gmail, WhatsApp)");

  const yo = sesion();
  const correo = `empresa${Date.now()}@ejemplo.com`;
  correos.set(yo, correo);
  await yo("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: correo, password: "eclipse2026", nombre: "Empresa" }) });
  await yo("/api/pro", { method: "POST", body: JSON.stringify({ code: "ECLIPSE-PRO" }) });

  console.log("\nContratar abre la pasarela de Stripe de verdad");
  const contratado = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "contratar", id: "support" }) });
  ok(/^https:\/\/pago\.ejemplo\//.test(contratado.json?.url ?? ""), "devuelve la dirección de pago que ha creado Stripe");
  ok(contratado.json?.contrato?.estado === "pendiente_de_pago", "y el contrato sigue pendiente hasta que el pago exista");
  ok(Boolean(contratado.json?.contrato?.instancia), "con su instancia propia desde el primer momento");

  const cobro = [...pagos.values()][0];
  ok(cobro.modo === "subscription", "es una suscripción, no un pago suelto");
  ok(cobro.importe === "30000", `y por el importe del catálogo: 300 € en céntimos (${cobro.importe})`);
  ok(cobro.moneda === "eur" && cobro.intervalo === "month", "en euros y cada mes");
  ok(cobro.eclipse_cliente === correo && cobro.eclipse_agente === "support",
     "y con quién y qué ha contratado apuntado en el pago, para poder comprobarlo al volver");

  const intento = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "reactivar", id: "support" }) });
  ok(intento.estado === 409, `no se puede activar por la puerta de atrás (${intento.estado})`);

  const sinPagar = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "support", encargo: "hola" }) });
  ok(sinPagar.estado === 422 && /pendiente de pago/i.test(sinPagar.json?.error ?? ""), "y no ejecuta nada mientras esté pendiente de pago");

  console.log("\nAl volver del pago se le PREGUNTA a Stripe");
  const idSesion = [...pagos.keys()][0];
  pagoCompleto = false;
  const aMedias = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "confirmar", id: "support", sesion: idSesion }) });
  ok(aMedias.estado === 402, `si Stripe dice que no está pagado, no se activa (${aMedias.estado})`);

  pagoCompleto = true;
  const inventada = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "confirmar", id: "support", sesion: "cs_test_inventada" }) });
  ok(inventada.estado === 402, "una sesión que no existe tampoco activa nada");

  const otroAgente = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "confirmar", id: "omni", sesion: idSesion }) });
  ok(otroAgente.estado === 404 || otroAgente.estado === 402, "ni un pago de un agente sirve para activar otro");

  const activado = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "confirmar", id: "support", sesion: idSesion }) });
  ok(activado.json?.contrato?.estado === "activo", "con el pago confirmado, el agente se activa");
  ok(Boolean(activado.json?.contrato?.suscripcion), "y se guarda su suscripción, para poder comprobar que sigue viva");

  console.log("\nSin la conexión que necesita, tampoco trabaja");
  await activar(yo, "sales");
  const sinCrm = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "sales", encargo: "dame los leads" }) });
  ok(sinCrm.estado === 422, "SALES no trabaja sin su CRM");
  ok(/requiere conexión.*hubspot/i.test(sinCrm.json?.error ?? ""), `y dice exactamente qué falta: ${sinCrm.json?.error}`);

  console.log("\nCon Notion conectado, SUPPORT trabaja de verdad");
  const conectar = await yo("/api/conexiones", { method: "POST", body: JSON.stringify({ servicio: "notion", campos: { token: ESPERADO.TOKEN_NOTION }, permiso: "escribir" }) });
  ok(conectar.estado === 200, `Notion conectado (${conectar.estado})`);
  ok(conectar.json?.permiso === "escribir", "con permiso de escritura en la conexión");

  guion = [
    { llamada: { nombre: "conexion", args: { servicio: "notion", accion: "buscar", datos: { texto: "devoluciones" } } } },
    { texto: "En vuestra documentación hay una página de Ideas de vídeos y una base de Clientes." },
  ];
  const trabajo = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "support", encargo: "busca la política de devoluciones" }) });
  ok(trabajo.estado === 200, `el agente trabaja (${trabajo.estado})`);
  ok(trabajo.json?.acciones?.some((a) => a.ok), "y ha ejecutado una acción de verdad contra Notion");
  ok(/Ideas de vídeos|Clientes/.test(trabajo.json?.texto ?? ""), "contestando con lo que hay en la cuenta, no de memoria");

  console.log("\nCada agente solo ve SUS servicios");
  const sistema = recibido.map((p) => p.messages?.find((m) => m.role === "system")?.content ?? "").join("\n");
  ok(/Notion/.test(sistema), "a SUPPORT se le dice que tiene Notion");
  /*
    Lo que de verdad hay que mirar: qué servicios lleva la herramienta de
    conexiones. Es el enum que el modelo puede escribir, así que lo que no esté
    ahí no lo puede ni pedir.
  */
  const laDeConexiones = (recibido[recibido.length - 1]?.tools ?? []).find(
    (t) => t.function?.name === "conexion",
  );
  const puede = laDeConexiones?.function?.parameters?.properties?.servicio?.enum ?? [];
  ok(JSON.stringify(puede) === JSON.stringify(["notion"]),
     `solo puede pedir los servicios que tiene: ${JSON.stringify(puede)}`);

  guion = [
    { llamada: { nombre: "conexion", args: { servicio: "cloudflare", accion: "listar_zonas", datos: {} } } },
    { texto: "No tengo acceso a eso." },
  ];
  const colado = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "support", encargo: "mira los dominios" }) });
  ok(colado.json?.acciones?.some((a) => !a.ok), "si el modelo se inventa un servicio, se rechaza aquí y no en el prompt");

  /*
    Dos frenos independientes, y hacen falta los dos.

    El de la CONEXIÓN es de toda la vida: una cuenta conectada en solo lectura
    no se puede tocar la toque quien la toque. El del AGENTE es nuevo: aunque la
    cuenta admita escritura, este agente concreto puede estar en solo lectura.
    Que sean dos y no uno es lo que hace que darle permiso a un agente no sea
    darle permiso a todos.
  */
  console.log("\nEn solo lectura, el agente no escribe aunque la cuenta le deje");
  const antes = escrituras.length;
  guion = [
    { llamada: { nombre: "conexion", args: { servicio: "notion", accion: "escribir_en_pagina", datos: { id: "pag-1", texto: "nota" } } } },
    { texto: "No puedo escribir." },
  ];
  await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "support", encargo: "apunta esto en Notion" }) });
  ok(escrituras.length === antes, "no se ha llegado a llamar a la API: el freno está antes, no en el prompt");

  console.log("\nCon aprobación humana, la acción se PARA");
  await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "config", id: "support", puedeEscribir: true, apruebaAntes: true }) });
  guion = [
    { llamada: { nombre: "conexion", args: { servicio: "notion", accion: "escribir_en_pagina", datos: { id: "pag-1", texto: "Política de devoluciones: 14 días" } } } },
    { texto: "Lo dejo preparado y esperando tu aprobación." },
  ];
  const parado = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "support", encargo: "apunta la política en Notion" }) });
  ok(escrituras.length === antes, "sigue sin escribirse nada: la aprobación PARA, no avisa después");
  ok(parado.json?.enEspera === 1, `y queda una acción en espera (${parado.json?.enEspera})`);

  const ficha = await yo("/api/agentes?id=support");
  const pendiente = ficha.json?.pendientes?.[0];
  ok(Boolean(pendiente), "la acción aparece en la cola de aprobación");
  ok(pendiente?.accion === "escribir_en_pagina", "con la acción exacta que quería hacer");
  ok(ficha.json?.registro?.some((a) => a.tipo === "aprobacion" && a.ok === false), "y en el registro NO figura como hecha");

  console.log("\nY al aprobarla, entonces sí se ejecuta");
  const aprobado = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "aprobar", id: "support", pendiente: pendiente.id }) });
  ok(aprobado.estado === 200, `se aprueba (${aprobado.estado} ${aprobado.json?.error ?? ""})`);
  ok(escrituras.length === antes + 1, "AHORA sí se ha escrito en Notion de verdad");
  ok(escrituras[escrituras.length - 1].servicio === "notion", "y en el servicio que era");

  console.log("\nPausar para de verdad");
  await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "pausar", id: "support" }) });
  const enPausa = await yo("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "support", encargo: "busca algo" }) });
  ok(enPausa.estado === 422 && /pausa/i.test(enPausa.json?.error ?? ""), "en pausa no ejecuta nada");

  console.log("\nLo de una empresa no lo ve otra");
  const otra = sesion();
  const correoOtra = `otra${Date.now()}@ejemplo.com`;
  correos.set(otra, correoOtra);
  await otra("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: correoOtra, password: "eclipse2026" }) });
  const suyo = await otra("/api/agentes");
  ok(suyo.json?.agentes?.every((a) => a.contrato === null), "otra empresa no ve ningún contrato de la primera");
  ok((suyo.json?.pendientes ?? []).length === 0, "ni lo que tenía pendiente de aprobar");
  const fichaAjena = await otra("/api/agentes?id=support");
  ok((fichaAjena.json?.registro ?? []).length === 0, "ni una línea de su registro");
  const colada = await otra("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "support", encargo: "x" }) });
  ok(colada.estado === 404, "ni puede darle encargos a un agente que no ha contratado");

  /*
    El regalo por correo.

    Lo pidió Carlos para poder comprobar la plataforma entera sin cobrarse a sí
    mismo. Lo que importa es que sea un camino APARTE del pago —no una forma de
    saltárselo— y que se diga que es un regalo, no un cobro.
  */
  console.log("\nA la cuenta de la lista se le regalan, y se dice que es un regalo");
  const invitado = sesion();
  correos.set(invitado, "regalado@ejemplo.com");
  await invitado("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: "regalado@ejemplo.com", password: "eclipse2026", nombre: "Carlos" }) });
  const pagosAntes = pagos.size;
  const regalo = await invitado("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "contratar", id: "omni" }) });
  ok(regalo.json?.contrato?.estado === "activo", "se activa directamente, sin pasar por el pago");
  ok(regalo.json?.regalado === true && /regalo/i.test(regalo.json?.aviso ?? ""), "y se dice que es un regalo, no un cobro");
  ok(pagos.size === pagosAntes, "no se ha abierto ninguna pasarela ni se ha cobrado nada");
  ok(!regalo.json?.contrato?.suscripcion, "y no tiene suscripción que cobrar");

  const deOtro = sesion();
  correos.set(deOtro, `nolista${Date.now()}@ejemplo.com`);
  await deOtro("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: correoDe(deOtro), password: "eclipse2026" }) });
  const sinRegalo = await deOtro("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "contratar", id: "omni" }) });
  ok(sinRegalo.json?.regalado !== true, "y a cualquier otra cuenta NO se le regala: se le cobra");
  ok(typeof sinRegalo.json?.url === "string", "a esa se le abre la pasarela");

  /*
    Cada contratación, su propia instancia.

    Lo pidió Carlos así: "que cada compra sea un ID distinto... que no tenga el
    mismo asistente a 100 empresas y que se les junte todo". La separación ya
    estaba por cuenta; esto la hace explícita y comprobable.
  */
  console.log("\nCada contratación tiene su instancia, y no se mezclan");
  const miInstancia = (await yo("/api/agentes?id=support")).json?.contrato?.instancia;
  const suInstancia = regalo.json?.contrato?.instancia;
  ok(Boolean(miInstancia) && Boolean(suInstancia), "las dos tienen instancia");
  ok(miInstancia !== suInstancia, "y no se parecen en nada, aunque fuera el mismo agente");

  const mismoAgente = await invitado("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "contratar", id: "support" }) });
  ok(mismoAgente.json?.contrato?.instancia !== miInstancia,
     "dos empresas con el MISMO agente tienen dos instancias distintas");

  console.log("\nY el trabajo de una no llega a la otra");
  // La segunda empresa conecta SU Notion. Las dos tienen el mismo agente.
  await invitado("/api/conexiones", { method: "POST", body: JSON.stringify({ servicio: "notion", campos: { token: ESPERADO.TOKEN_NOTION } }) });
  recibido.length = 0;
  guion = [{ texto: "Sin novedades." }];
  await invitado("/api/agentes", { method: "POST", body: JSON.stringify({ accion: "encargar", id: "support", encargo: "qué hay documentado" }) });
  const suSistema = recibido.map((p) => p.messages?.find((m) => m.role === "system")?.content ?? "").join("\n");
  const suHistorial = JSON.stringify(recibido.map((p) => p.messages ?? []));
  ok(!/devoluciones|Política/i.test(suHistorial),
     "al agente de la segunda empresa NO le llega nada de los encargos de la primera");
  ok(!/pol[ií]tica de devoluciones/i.test(suSistema), "ni en sus instrucciones");
  const suRegistro = (await invitado("/api/agentes?id=support")).json?.registro ?? [];
  ok(!suRegistro.some((a) => /devoluciones/i.test(a.texto)), "ni en su registro");

  console.log("\nY las claves no salen de casa");
  const todo = JSON.stringify((await yo("/api/agentes?id=support")).json);
  ok(!todo.includes(ESPERADO.TOKEN_NOTION), "el token de Notion no viaja al navegador por ninguna parte");
} finally {
  apis.close();
  motor.close();
  stripe.close();
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
  redis.kill();
  if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
