// La memoria de punta a punta: que aprenda de una conversación, que use lo
// aprendido en la siguiente, que pueda mirar atrás — y, lo que más importa,
// que NO se quede con lo que no debe y se pueda borrar de verdad.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as unPuerto } from "node:net";
import { readFileSync, existsSync, unlinkSync, openSync } from "node:fs";
import { RAIZ, SRC, crearJiti, enSrc } from "./entorno.mjs";

const AQUI = new URL(".", import.meta.url).pathname;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

/* ----------------------- Lo que se puede probar solo --------------------- */
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
const T = await jiti.import(enSrc("lib/memoria/tipos.ts"));
const A = await jiti.import(enSrc("lib/memoria/aprender.ts"));

console.log("\nNo repetir lo mismo con otras palabras");
ok(T.esElMismo("Tiene una tienda de ropa en Shopify", "Tiene una tienda en Shopify de ropa"), "el mismo hecho en otro orden");
ok(!T.esElMismo("Tiene una tienda en Shopify", "Estudia segundo de Bachillerato"), "dos hechos distintos, distintos");
// El caso que de verdad se escapaba: casi las mismas palabras, otro dato.
ok(
  !T.esElMismo("Tiene una tienda de ropa en Shopify", "Tiene una tienda de bicis en Shopify"),
  "dos tiendas distintas NO son la misma, aunque se parezcan al leerlas",
);
const fundido = T.fundir([{ id: "1", texto: "Tiene una tienda de ropa en Shopify", cuando: 1 }], { id: "2", texto: "Tiene una tienda de ropa de montaña en Shopify", cuando: 2 });
ok(fundido.length === 1, "al repetirse, no se acumulan dos");
ok(fundido[0].id === "2", "y se queda el más nuevo, que está más al día");

console.log("\nNo crecer sin fin");
let muchos = [];
const temas90 = ["fotografía", "ciclismo", "alemán", "cocina", "guitarra", "ajedrez", "escalada", "vela", "cerámica", "astronomía"];
for (let i = 0; i < 90; i++)
  muchos = T.fundir(muchos, {
    id: String(i),
    texto: `Le interesa ${temas90[i % 10]} desde ${1990 + i}`,
    cuando: i,
  });
ok(muchos.length === T.MAX_HECHOS, `se para en ${T.MAX_HECHOS}, no en 90`);
ok(muchos[0].texto.includes("2079"), "y lo que cae es lo más viejo, no lo último");

console.log("\nBuscar entre lo recordado");
const temas = [
  { id: "a", titulo: "La web de la tienda", texto: "Montamos el catálogo y quedamos en usar fotos propias." },
  { id: "b", titulo: "Trabajo de biología", texto: "Esquema sobre la mitosis para el viernes." },
  { id: "c", titulo: "Logo", texto: "Probamos tres versiones del logo de la tienda." },
];
const sobreTienda = T.buscar(temas, "tienda");
ok(sobreTienda.length === 2, `encuentra las dos de la tienda (${sobreTienda.length})`);
ok(sobreTienda[0].titulo === "La web de la tienda", "y primero la que lo lleva en el título");
ok(T.buscar(temas, "astronomía").length === 0, "de lo que no hay, no se inventa nada");

console.log("\nLeer lo que contesta el modelo");
const leido = A.leerSalida(`HECHOS:
- Tiene una tienda de ropa de montaña en Shopify
- Prefiere respuestas cortas
TEMA:
Repasaron el catálogo de la tienda.
Quedaron en cambiar las fotos.`);
ok(leido.hechos.length === 2, "saca los hechos");
ok(leido.tema.includes("catálogo") && leido.tema.includes("fotos"), "y el tema, en una línea");
ok(A.leerSalida("HECHOS:\n- ninguno\nTEMA:\nCharla suelta.").hechos.length === 0, "«ninguno» es una respuesta válida, no un hecho");
ok(A.leerSalida("cualquier cosa sin formato").hechos.length === 0, "y una respuesta con otro formato no cuela basura");
ok(A.leerSalida("Claro, aquí tienes:\nHECHOS:\n- Tiene un perro\nTEMA:\nNada.").hechos.length === 1, "aunque venga con un «claro, aquí tienes» delante");

/* --------------------------- Y ahora, entero ----------------------------- */
// Un motor de mentira que hace de "extractor": devuelve hechos y tema.
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
    const texto = JSON.stringify(b.messages ?? []);

    // Si le piden aprender, contesta con la ficha.
    if (/HECHOS:/.test(texto)) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        choices: [{ message: { content: "HECHOS:\n- Tiene una tienda de ropa de montaña en Shopify\n- Prefiere respuestas cortas\nTEMA:\nRepasaron el catálogo y quedaron en cambiar las fotos." } }],
      }));
    }

    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Vale." } }] })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });
});
await new Promise((r) => motor.listen(0, "127.0.0.1", r));
const baseMotor = `http://127.0.0.1:${motor.address().port}`;

const puertoRedis = `${AQUI}redis-memoria.txt`;
if (existsSync(puertoRedis)) unlinkSync(puertoRedis);
const redis = spawn("node", [`${AQUI}redis-falso.mjs`, puertoRedis], { stdio: "ignore" });
for (let i = 0; i < 50 && !existsSync(puertoRedis); i++) await esperar(100);
const urlRedis = `http://127.0.0.1:${readFileSync(puertoRedis, "utf8").trim()}`;

const PUERTO = await new Promise((r) => {
  const s = unPuerto();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});
const app = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  cwd: RAIZ, detached: true,
  stdio: ["ignore", openSync(`${AQUI}app-memoria.log`, "w"), openSync(`${AQUI}app-memoria.log`, "a")],
  env: {
    ...process.env,
    UPSTASH_REDIS_REST_URL: urlRedis, UPSTASH_REDIS_REST_TOKEN: "t",
    AUTH_SECRET: "secreto-memoria", GROQ_API_KEY: "gsk_prueba", MOTOR_BASE_GROQ: baseMotor,
  },
});
const URL_APP = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 80; i++) { try { await fetch(`${URL_APP}/api/auth`); break; } catch { await esperar(250); } }

/** Una sesión con su cookie. */
function sesion() {
  let galleta = "";
  return async (ruta, opciones = {}) => {
    const res = await fetch(`${URL_APP}${ruta}`, {
      ...opciones,
      headers: { "Content-Type": "application/json", ...(galleta ? { cookie: galleta } : {}), ...(opciones.headers ?? {}) },
    });
    const puesta = res.headers.get("set-cookie");
    if (puesta) galleta = puesta.split(";")[0];
    const cuerpo = await res.text();
    let json = null;
    try { json = JSON.parse(cuerpo); } catch { /* SSE u otra cosa */ }
    return { estado: res.status, json, texto: cuerpo };
  };
}

try {
  const yo = sesion();
  const correo = `memoria${Date.now()}@ejemplo.com`;
  await yo("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: correo, password: "eclipse2026", nombre: "Karl" }) });

  console.log("\nAl principio no sabe nada");
  const vacia = await yo("/api/memoria");
  ok(vacia.json?.hechos?.length === 0, "cero hechos");
  ok(vacia.json?.temas?.length === 0, "y cero conversaciones recordadas");

  console.log("\nAprende de una conversación");
  const aprender = await yo("/api/memoria", {
    method: "POST",
    body: JSON.stringify({
      id: "conv-1",
      titulo: "La tienda",
      turnos: [
        { role: "user", content: "Tengo una tienda de ropa de montaña en Shopify y quiero repasar el catálogo" },
        { role: "assistant", content: "Vamos a verlo." },
      ],
    }),
  });
  ok(aprender.json?.aprendido === true, "aprende");

  const sabe = await yo("/api/memoria");
  ok(sabe.json?.hechos?.length === 2, `y guarda los dos hechos (${sabe.json?.hechos?.length})`);
  ok(sabe.json?.hechos?.some((h) => /montaña/.test(h.texto)), "con lo que dijo de su tienda");
  ok(sabe.json?.temas?.length === 1, "y de qué fue la conversación");
  ok(/catálogo/.test(sabe.json?.temas?.[0]?.texto ?? ""), "en dos líneas");

  console.log("\nNo aprende diez veces de lo mismo");
  const otraVez = await yo("/api/memoria", {
    method: "POST",
    body: JSON.stringify({ id: "conv-1", titulo: "La tienda", turnos: [
      { role: "user", content: "Tengo una tienda de ropa de montaña en Shopify y quiero repasar el catálogo" },
      { role: "assistant", content: "Vamos a verlo." },
      { role: "user", content: "gracias" },
    ] }),
  });
  ok(otraVez.json?.aprendido === false, "con dos mensajes más no vuelve a gastar una llamada al motor");

  console.log("\nLo aprendido llega al chat");
  pedidos.length = 0;
  await yo("/api/chat", { method: "POST", body: JSON.stringify({ mode: "chat", speed: "rapido", messages: [{ role: "user", content: "¿por dónde íbamos?" }] }) });
  const sistema = pedidos.map((p) => p.messages?.find((m) => m.role === "system")?.content ?? "").join("\n");
  ok(/tienda de ropa de montaña/.test(sistema), "el modelo ya sabe a qué se dedica");
  ok(/no lo recites|NO lo recites/i.test(sistema), "con la orden de no recitárselo como una ficha");

  /*
    El perfil de comunicación: cómo le gusta que le hablen.

    Lo pidió Carlos: que se adapte poco a poco a cada persona. Lo que se
    comprueba aquí es lo que no se ve en la lógica suelta: que se aprende de la
    cuenta y no de la conversación —o sea, que sigue ahí al abrir otra—, que
    obedece el interruptor de la memoria, y que el botón de borrar lo borra.
  */
  console.log("\nAprende cómo le gusta que le hablen, conversación a conversación");
  // Cinco mensajes, cada uno en su conversación, como quien usa la aplicación
  // varios días. Si esto se guardara en la conversación, no sumaría.
  for (const frase of ["hazlo corto por favor", "más corto", "al grano", "resúmelo", "no te enrolles"])
    await yo("/api/chat", { method: "POST", body: JSON.stringify({ mode: "chat", speed: "rapido", messages: [{ role: "user", content: frase }] }) });

  const conEstilo = await yo("/api/memoria");
  ok((conEstilo.json?.estilo ?? []).some((l) => /respuestas cortas/i.test(l)), "ha aprendido que las quiere cortas, y se puede ver en Ajustes");

  pedidos.length = 0;
  await yo("/api/chat", { method: "POST", body: JSON.stringify({ mode: "chat", speed: "rapido", messages: [{ role: "user", content: "y esto otro qué tal lo ves tú" }] }) });
  const conPerfil = pedidos.map((p) => p.messages?.find((m) => m.role === "system")?.content ?? "").join("\n");
  ok(/contéstale corto/.test(conPerfil), "y en la conversación siguiente ya se lo dice al modelo");
  ok(/NO copies sus palabras/.test(conPerfil), "con la orden de no imitarle");

  console.log("\nEn un chat temporal, ni se acuerda ni aprende");
  pedidos.length = 0;
  await yo("/api/chat", { method: "POST", body: JSON.stringify({ mode: "chat", speed: "rapido", temporal: true, messages: [{ role: "user", content: "hola" }] }) });
  const sistemaTemporal = pedidos.map((p) => p.messages?.find((m) => m.role === "system")?.content ?? "").join("\n");
  ok(!/tienda de ropa de montaña/.test(sistemaTemporal), "no le pasa nada de lo que sabía");
  ok(!/aprendido de sus mensajes/.test(sistemaTemporal), "ni cómo le gusta que le hablen: temporal es temporal");

  console.log("\nLo de otro no se mezcla");
  const otra = sesion();
  await otra("/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", email: `otra${Date.now()}@ejemplo.com`, password: "eclipse2026", nombre: "Ana" }) });
  const deOtra = await otra("/api/memoria");
  ok(deOtra.json?.hechos?.length === 0, "otra persona empieza de cero");

  console.log("\nSe puede borrar, y se borra de verdad");
  const unHecho = sabe.json.hechos[0].id;
  await yo(`/api/memoria?hecho=${unHecho}`, { method: "DELETE" });
  const menos = await yo("/api/memoria");
  ok(menos.json?.hechos?.length === 1, "una cosa suelta se olvida");

  await yo("/api/memoria", { method: "DELETE" });
  const nada = await yo("/api/memoria");
  ok(nada.json?.hechos?.length === 0, "y del todo, todo");
  ok(nada.json?.temas?.length === 0, "incluidas las conversaciones recordadas");
  ok((nada.json?.estilo ?? []).length === 0, "y cómo había aprendido a hablarle: el botón borra TODO lo que aprendió");

  pedidos.length = 0;
  await yo("/api/chat", { method: "POST", body: JSON.stringify({ mode: "chat", speed: "rapido", messages: [{ role: "user", content: "hola" }] }) });
  const traBorrar = pedidos.map((p) => p.messages?.find((m) => m.role === "system")?.content ?? "").join("\n");
  ok(!/tienda de ropa de montaña/.test(traBorrar), "y después de borrar, el modelo ya no lo recibe");
  ok(!/aprendido de sus mensajes/.test(traBorrar), "ni el perfil de cómo le gusta que le hablen");

  console.log("\nSin cuenta, no hay memoria que valga");
  const anonimo = sesion();
  const sinCuenta = await anonimo("/api/memoria");
  ok(sinCuenta.json?.sinCuenta === true, "se dice que hace falta cuenta");
  const intento = await anonimo("/api/memoria", { method: "POST", body: JSON.stringify({ id: "x", titulo: "x", turnos: [{ role: "user", content: "algo" }, { role: "assistant", content: "ok" }] }) });
  ok(intento.json?.aprendido === false, "y no se guarda nada de quien no ha entrado");

  console.log("\nLo que NUNCA debe aprender");
  const fuente = readFileSync(enSrc("lib/memoria/aprender.ts"), "utf8");
  ok(/salud, religión, ideas políticas/.test(fuente), "salud, religión e ideas políticas, prohibidas");
  ok(/orientación sexual/.test(fuente), "orientación sexual, prohibida");
  ok(/terceras personas/.test(fuente), "y lo de la familia y los amigos de quien escribe, también");
  ok(/Contraseñas, claves, tokens/.test(fuente), "ni contraseñas ni claves ni direcciones");
} finally {
  motor.close();
  redis.kill("SIGKILL");
  try { process.kill(-app.pid, "SIGKILL"); } catch { app.kill("SIGKILL"); }
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
