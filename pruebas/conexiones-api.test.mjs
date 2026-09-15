// La API de Conexiones de punta a punta, con su base de datos y sus puertas:
// plan Pro, cuenta, clave comprobada antes de guardar, cifrado de verdad y el
// permiso de solo lectura.
import { spawn } from "node:child_process";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { crear, ESPERADO } from "./apis-falsas.mjs";
import { RAIZ, SRC, crearJiti, enSrc } from "./entorno.mjs";

// Cuántos servicios hay se lee del registro, no de un número escrito a mano:
// cada conector nuevo hacía fallar esta prueba por la razón equivocada.
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
const { SERVICIOS } = await jiti.import(enSrc("lib/conexiones/registro.ts"));
const CUANTOS = SERVICIOS.length;

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) Las APIs de mentira.
const apis = crear();
await new Promise((r) => apis.listen(0, "127.0.0.1", r));
const baseApis = `http://127.0.0.1:${apis.address().port}`;

// 2) Un Redis de mentira.
const puertoRedis = `${AQUI}redis-conex.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

// 3) ECLIPSE, apuntando a los dos.
//
// Puerto libre de verdad, no uno fijo: con uno fijo, una ejecución que deje el
// servidor colgado hace que la siguiente hable con el servidor viejo —el que
// apunta a un Redis ya muerto— y falle por todas partes menos por la que es.
const { createServer: unPuerto } = await import("node:net");
const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => r(p));
  });
});
const entorno = {
  ...process.env,
  UPSTASH_REDIS_REST_URL: urlRedis,
  UPSTASH_REDIS_REST_TOKEN: "t",
  AUTH_SECRET: "secreto-de-pruebas",
  PRO_ACCESS_CODE: "ECLIPSE-PRO",
  CONEXION_BASE_SHOPIFY: baseApis,
  CONEXION_BASE_WOOCOMMERCE: baseApis,
  CONEXION_BASE_WIX: baseApis,
  CONEXION_BASE_IONOS: baseApis,
  CONEXION_BASE_MERCADOS: baseApis,
};
const registro = `${AQUI}app-conexiones.log`;
const { openSync } = await import("node:fs");
const salida = openSync(registro, "w");
// En su propio grupo de procesos: `npx` lanza un hijo, y matar solo a `npx`
// deja el servidor vivo escuchando en el puerto.
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, env: entorno, stdio: ["ignore", salida, salida], detached: true,
});
const matarApp = () => {
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
};
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) {
  try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); }
}

const fallos = [];
const ok = (cond, que) => {
  console.log(`  ${cond ? "✓" : "✗"} ${que}`);
  if (!cond) fallos.push(que);
};

// Un navegador de mentira que guarda las cookies, que es donde va la sesión.
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
      const nombre = par.slice(0, i);
      const valor = par.slice(i + 1);
      if (valor) galletas.set(nombre, valor); else galletas.delete(nombre);
    }
    const texto = await r.text();
    let json = null;
    try { json = JSON.parse(texto); } catch { /* no era json */ }
    return { estado: r.status, json, texto };
  };
}

try {
  /* ---------------------- Sin cuenta y sin plan Pro ---------------------- */
  console.log("\nLas puertas");
  const anonimo = sesion();
  const catalogoAnon = await anonimo("/api/conexiones");
  ok(catalogoAnon.json?.pro === false, "sin Pro, la API lo dice");
  ok(catalogoAnon.json?.servicios?.length === CUANTOS, `pero el catálogo se ve igual (${CUANTOS} servicios), para saber qué te estás perdiendo`);
  ok(catalogoAnon.json?.servicios?.every((s) => !s.conectado), "y nada aparece conectado");

  const intentoAnon = await anonimo("/api/conexiones", {
    method: "POST",
    body: JSON.stringify({ servicio: "shopify", campos: { tienda: "x.myshopify.com", token: ESPERADO.TOKEN_SHOPIFY } }),
  });
  ok(intentoAnon.estado === 402 && intentoAnon.json?.code === "solo_pro", "conectar sin Pro se rechaza en el SERVIDOR, no solo en la pantalla");

  /* ----------------------------- Con cuenta ----------------------------- */
  const yo = sesion();
  const correo = `pro${Date.now()}@ejemplo.com`;
  const alta = await yo("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: correo, password: "eclipse2026", nombre: "Karl" }) });
  ok(alta.json?.user === correo, `la cuenta se crea (${alta.estado} ${alta.json?.error ?? alta.json?.user})`);

  const sinPro = await yo("/api/conexiones", {
    method: "POST",
    body: JSON.stringify({ servicio: "shopify", campos: { tienda: "x.myshopify.com", token: ESPERADO.TOKEN_SHOPIFY } }),
  });
  ok(sinPro.estado === 402, "con cuenta pero sin Pro, tampoco");

  // Activar Pro con el código.
  const pro = await yo("/api/pro", { method: "POST", body: JSON.stringify({ code: "ECLIPSE-PRO" }) });
  ok(pro.json?.plan === "pro", `el código activa Pro (${pro.estado} ${JSON.stringify(pro.json)?.slice(0, 80)})`);

  /* --------------------------- Clave incorrecta -------------------------- */
  console.log("\nConectar");
  const mala = await yo("/api/conexiones", {
    method: "POST",
    body: JSON.stringify({ servicio: "shopify", campos: { tienda: "mitienda.myshopify.com", token: "shpat_falso" } }),
  });
  ok(mala.estado === 400 && /rechazado la clave/.test(mala.json?.error ?? ""), "una clave que no vale NO se guarda: se comprueba antes");
  const trasMala = await yo("/api/conexiones");
  ok(!trasMala.json?.servicios?.find((s) => s.id === "shopify")?.conectado, "y no queda nada guardado");

  /* ---------------------------- Clave correcta --------------------------- */
  const buena = await yo("/api/conexiones", {
    method: "POST",
    body: JSON.stringify({ servicio: "shopify", campos: { tienda: "mitienda.myshopify.com", token: ESPERADO.TOKEN_SHOPIFY } }),
  });
  ok(buena.estado === 200 && /Mi Tienda/.test(buena.json?.cuenta ?? ""), `conecta y dice a qué tienda (${buena.json?.cuenta ?? buena.json?.error})`);
  ok(buena.json?.permiso === "leer", "y nace en SOLO LECTURA aunque no se diga nada");

  const conectado = await yo("/api/conexiones");
  const sh = conectado.json?.servicios?.find((s) => s.id === "shopify");
  ok(sh?.conectado === true && sh?.cuenta, "el catálogo ya lo da por conectado");
  ok(!JSON.stringify(conectado.json).includes(ESPERADO.TOKEN_SHOPIFY), "y el token NO vuelve al navegador por ningún lado");

  /* ------------------------ Cifrado en la base de datos ------------------ */
  console.log("\nLo que queda escrito");
  const volcado = await fetch(`${urlRedis}`, { method: "POST", body: JSON.stringify(["KEYS", "*"]) })
    .then((r) => r.json()).catch(() => null);
  const claves = Array.isArray(volcado?.result) ? volcado.result : [];
  const deConexion = claves.filter((k) => String(k).includes("conexion"));
  ok(deConexion.length > 0, `hay conexiones guardadas (${deConexion.length})`);

  let crudoTodo = "";
  for (const k of deConexion) {
    const v = await fetch(`${urlRedis}`, { method: "POST", body: JSON.stringify(["GET", k]) }).then((r) => r.json());
    crudoTodo += String(v?.result ?? "");
  }
  ok(crudoTodo.length > 0, "y se pueden leer tal cual están escritas");
  ok(!crudoTodo.includes(ESPERADO.TOKEN_SHOPIFY), "el token NO está en claro en la base de datos");
  ok(!Buffer.from(crudoTodo).toString("base64").includes(Buffer.from(ESPERADO.TOKEN_SHOPIFY).toString("base64").slice(0, 12)), "ni disimulado en base64");
  ok(/"sobre":"[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(crudoTodo), "está dentro de un sobre cifrado (iv.etiqueta.contenido)");

  /* ------------------------------ Permisos ------------------------------- */
  console.log("\nPermisos");
  const wix = await yo("/api/conexiones", {
    method: "POST",
    body: JSON.stringify({ servicio: "wix", campos: { token: ESPERADO.TOKEN_WIX, sitio: ESPERADO.SITIO_WIX }, permiso: "escribir" }),
  });
  ok(wix.json?.permiso === "escribir", "si se pide permiso de escritura a propósito, se da");

  const mercados = await yo("/api/conexiones", {
    method: "POST",
    body: JSON.stringify({ servicio: "mercados", campos: { clave: ESPERADO.CLAVE_BINANCE, secreto: ESPERADO.SECRETO_BINANCE }, permiso: "escribir" }),
  });
  ok(mercados.json?.permiso === "leer", "pero a los mercados NO se les puede dar, aunque se pida");

  const subir = await yo("/api/conexiones", { method: "PATCH", body: JSON.stringify({ servicio: "mercados", permiso: "escribir" }) });
  ok(subir.estado === 400, "ni siquiera después, cambiando el permiso");

  const subirShopify = await yo("/api/conexiones", { method: "PATCH", body: JSON.stringify({ servicio: "shopify", permiso: "escribir" }) });
  ok(subirShopify.json?.permiso === "escribir", "Shopify sí se puede subir a escritura sin volver a pegar la clave");

  /* ---------------------------- Desconectar ------------------------------ */
  console.log("\nDesconectar");
  await yo("/api/conexiones?servicio=shopify", { method: "DELETE" });
  const tras = await yo("/api/conexiones");
  ok(!tras.json?.servicios?.find((s) => s.id === "shopify")?.conectado, "desconectar lo quita del catálogo");

  let quedaAlgo = "";
  const claves2 = (await fetch(`${urlRedis}`, { method: "POST", body: JSON.stringify(["KEYS", "*"]) }).then((r) => r.json()))?.result ?? [];
  for (const k of claves2.filter((k) => String(k).includes("conexion:") && String(k).includes("shopify"))) {
    const v = await fetch(`${urlRedis}`, { method: "POST", body: JSON.stringify(["GET", k]) }).then((r) => r.json());
    quedaAlgo += String(v?.result ?? "");
  }
  ok(quedaAlgo === "", "y no deja ni el sobre cifrado: se borra de verdad");

  /* --------------------- Dos personas, dos cuentas ----------------------- */
  console.log("\nCada uno lo suyo");
  const otro = sesion();
  await otro("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: `otro${Date.now()}@ejemplo.com`, password: "eclipse2026" }) });
  await otro("/api/pro", { method: "POST", body: JSON.stringify({ code: "ECLIPSE-PRO" }) });
  const suyo = await otro("/api/conexiones");
  ok(suyo.json?.servicios?.every((s) => !s.conectado), "otra persona no ve las conexiones de la primera");
} finally {
  apis.close();
  matarApp();
  redis.kill();
  if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
