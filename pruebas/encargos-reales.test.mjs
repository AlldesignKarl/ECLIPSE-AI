// Que un encargo programado vea DE VERDAD las cuentas conectadas, y que cuando
// no hay nada conectado lo diga en vez de inventárselo.
//
// Este es el fallo que contó Carlos: sus partes hablaban de pedidos y de stock
// con cifras que no salían de ninguna parte. La causa estaba escondida: las
// conexiones se buscaban por la COOKIE de quien está delante, y un encargo lo
// dispara el reloj a las cuatro de la mañana, cuando no hay nadie ni cookie.
// Así que el modelo se quedaba sin la tienda, con un encargo que le hablaba de
// la tienda, y rellenaba el hueco.
import { spawn } from "node:child_process";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { crear, ESPERADO } from "./apis-falsas.mjs";
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const apis = crear();
await new Promise((r) => apis.listen(0, "127.0.0.1", r));
const baseApis = `http://127.0.0.1:${apis.address().port}`;

const puertoRedis = `${AQUI}redis-encargos.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

// El almacén y el registro leen esto al arrancar, así que se pone ANTES de
// importarlos.
process.env.UPSTASH_REDIS_REST_URL = urlRedis;
process.env.UPSTASH_REDIS_REST_TOKEN = "t";
process.env.AUTH_SECRET = "secreto-encargos";
process.env.CONEXION_BASE_SHOPIFY = baseApis;

const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
const { misConexiones, guardarConexion } = await jiti.import(enSrc("lib/conexiones/almacen.ts"));
const { ejecutarConexion } = await jiti.import(enSrc("lib/conexiones/registro.ts"));
const { herramientaConexion } = await jiti.import(enSrc("lib/conexiones/herramienta.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const DUENO = "karl@ejemplo.com";

try {
  console.log("\nAntes: sin dueño no hay nada, y por eso se inventaba");
  ok((await misConexiones()).length === 0, "sin cookie y sin dueño, cero conexiones (así estaba el reloj)");

  console.log("\nUna tienda conectada, guardada como la guarda la aplicación");
  await guardarConexion(
    "shopify",
    { tienda: "mitienda.myshopify.com", token: ESPERADO.TOKEN_SHOPIFY },
    "Mi Tienda · EUR",
    "leer",
    DUENO,
  );

  const suyas = await misConexiones(DUENO);
  ok(suyas.length === 1 && suyas[0].servicio === "shopify", "y se leen por su correo, sin cookie ninguna");

  console.log("\nEl reloj, ahora, sí ve la tienda");
  const herramienta = await herramientaConexion(undefined, DUENO);
  ok(Boolean(herramienta), "la herramienta de conexiones se monta sin nadie delante");
  ok(/shopify/.test(herramienta?.descripcion ?? ""), "y le dice al modelo qué tiene conectado de verdad");

  console.log("\nY los datos salen de la tienda, no de la cabeza de nadie");
  const r = await ejecutarConexion({
    servicio: "shopify",
    accion: "resumen_tienda",
    datos: {},
    dueno: DUENO,
  });
  ok(!r.error, `el resumen se hace sin errores${r.error ? `: ${r.error}` : ""}`);
  ok(/Mi Tienda/.test(r.texto), "trae el nombre real de la tienda");
  ok(/CATÁLOGO: 2 producto/.test(r.texto), "cuenta los productos que hay de verdad (2)");
  ok(/Sin publicar: 1/.test(r.texto), "ve cuál está sin publicar");
  ok(/Sin stock: 1/.test(r.texto), "y cuál se ha quedado sin stock");
  ok(/Taza/.test(r.texto), "y lo dice con su nombre, para poder actuar");
  ok(/VENTAS \(últimos 30 días\): 1 pedido\(s\), 28\.40 EUR/.test(r.texto), "las ventas son las que hay: 1 pedido, 28,40 €");
  ok(/Pendientes de enviar: 1/.test(r.texto), "y lo que está sin enviar, que es lo que hay que hacer hoy");

  console.log("\nSin dueño, la misma acción no encuentra nada (y lo dice)");
  const sinNadie = await ejecutarConexion({ servicio: "shopify", accion: "resumen_tienda", datos: {} });
  ok(Boolean(sinNadie.error), "sin saber de quién es, no hay conexión que valga");
  ok(/no está conectado/i.test(sinNadie.error ?? ""), "y el error se lee: no está conectado");
} finally {
  apis.close();
  redis.kill();
  if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
