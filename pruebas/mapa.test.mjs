// Mapas: qué se sabe de dónde está, qué hay cerca y cómo se llega — contra un
// Nominatim y un Google Maps de mentira, para no llamar a los de verdad.
import { createServer } from "node:http";
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

/* ------------------------- Los mapas de mentira -------------------------- */
const pedidas = [];
const servidor = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  pedidas.push({ ruta: u.pathname, params: Object.fromEntries(u.searchParams), agente: req.headers["user-agent"] });
  const json = (v) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(v));
  };

  /* --- OpenStreetMap (Nominatim) --- */
  if (u.pathname === "/reverse")
    return json({
      address: { city: "Zaragoza", state: "Aragón", country: "España", road: "Calle Falsa" },
      display_name: "Calle Falsa 123, Zaragoza, Aragón, España",
    });

  if (u.pathname === "/search") {
    const q = (u.searchParams.get("q") ?? "").toLowerCase();
    if (q.includes("nada de nada")) return json([]);
    if (q.includes("jaca"))
      return json([{ name: "Jaca", display_name: "Jaca, Huesca, Aragón, España", lat: "42.5711", lon: "-0.5497", type: "town" }]);
    return json([
      { name: "Museo Pablo Gargallo", display_name: "Museo Pablo Gargallo, Zaragoza", lat: "41.6510", lon: "-0.8830", type: "museum" },
      { name: "Museo Goya", display_name: "Museo Goya, Zaragoza", lat: "41.6520", lon: "-0.8790", type: "museum" },
    ]);
  }

  /* --- Google Maps Platform --- */
  if (u.pathname === "/maps/api/geocode/json")
    return json({ results: [{ formatted_address: "Oviedo, Asturias, España" }] });

  if (u.pathname === "/maps/api/place/textsearch/json")
    return json({
      results: [
        {
          name: "Sidrería El Cuélebre",
          formatted_address: "Calle Gascona, Oviedo",
          rating: 4.6,
          user_ratings_total: 812,
          opening_hours: { open_now: true },
          types: ["restaurant"],
          geometry: { location: { lat: 43.362, lng: -5.844 } },
        },
      ],
    });

  if (u.pathname === "/maps/api/directions/json")
    return json({
      routes: [
        {
          legs: [
            {
              distance: { value: 31400 },
              duration: { text: "34 minutos" },
              start_address: "Oviedo, Asturias",
              end_address: "Gijón, Asturias",
              steps: [
                { html_instructions: "Toma la <b>A-66</b> dirección norte", distance: { text: "12 km" } },
                { html_instructions: "Continúa por la <b>A-8</b>", distance: { text: "19 km" } },
              ],
            },
          ],
        },
      ],
    });

  res.writeHead(404);
  res.end("{}");
});
await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${servidor.address().port}`;

process.env.MAPA_BASE_OSM = BASE;
process.env.MAPA_BASE_GOOGLE = BASE;
delete process.env.GOOGLE_MAPS_API_KEY;

const jiti = await crearJiti(import.meta.url, {
  alias: { "@": SRC },
  moduleCache: false,
});
const mapa = await jiti.import(enSrc("lib/mapa.ts"));
const { herramientaMapa } = await jiti.import(enSrc("lib/tools/mapa.ts"));

let fallos = 0;
function ok(cond, texto) {
  console.log(`  ${cond ? "✓" : "✗"} ${texto}`);
  if (!cond) fallos++;
}
const ctx = (ubicacion) => ({ plan: "pro", modo: "chat", ubicacion });
const ZGZ = { lat: 41.6488, lon: -0.8891 };

try {
  /* ------------------------------- Distancia ------------------------------ */
  console.log("\nLas cuentas");
  ok(mapa.distanciaKm(ZGZ, { lat: 40.4168, lon: -3.7038 }) > 240, "Zaragoza-Madrid pasa de 240 km");
  ok(mapa.distanciaKm(ZGZ, { lat: 40.4168, lon: -3.7038 }) < 280, "y no llega a 280");
  ok(mapa.distanciaKm(ZGZ, ZGZ) === 0, "un sitio consigo mismo son 0 km");

  console.log("\nLo que sale del móvil");
  const redondeado = mapa.aproximar({ lat: 41.648812345, lon: -0.889134567 });
  ok(redondeado.lat === 41.649 && redondeado.lon === -0.889, "las coordenadas se redondean al kilómetro");
  ok(String(redondeado.lat).split(".")[1].length <= 3, "no salen más de tres decimales");
  ok(!mapa.puntoValido({ lat: 200, lon: 0 }), "una latitud imposible se rechaza");
  ok(!mapa.puntoValido({ lat: "41", lon: "-0.8" }), "y unas coordenadas de texto también");
  ok(mapa.puntoValido(ZGZ), "unas de verdad valen");

  /* --------------------------- Sin clave de Google ------------------------ */
  console.log("\nSin clave de Google (OpenStreetMap)");
  ok(mapa.hayGoogleMaps() === false, "la aplicación sabe que no la tiene");

  const donde = await herramientaMapa.ejecutar({ accion: "donde_estoy" }, ctx(ZGZ));
  ok(/Zaragoza/.test(donde.texto), "dice en qué ciudad está");
  ok(!/Calle Falsa/.test(donde.texto), "pero NO la calle, aunque el mapa la dé");
  ok(/aproximada/i.test(donde.texto), "y avisa de que es aproximada");

  const reverse = pedidas.find((p) => p.ruta === "/reverse");
  ok(reverse.params.lat === "41.649", "al mapa solo se le manda la posición redondeada");
  ok(/ECLIPSE/.test(reverse.agente ?? ""), "y se identifica, como pide Nominatim");

  const cerca = await herramientaMapa.ejecutar({ accion: "cerca", que: "museos" }, ctx(ZGZ));
  ok(/Museo Pablo Gargallo/.test(cerca.texto), "encuentra lo que hay cerca");
  ok(/km/.test(cerca.texto), "con la distancia a cada sitio");
  ok(/google\.com\/maps/.test(cerca.texto), "y un enlace a Google Maps para abrirlo");
  ok(/<contenido_externo/.test(cerca.texto), "lo que escribió otro va marcado como ajeno");

  // Y la regla de que eso son datos y no órdenes tiene que llegarle al modelo
  // aunque la búsqueda web no esté disponible: hasta ahora solo la llevaba
  // quien tenía buscador, y el mapa trae texto escrito por desconocidos igual.
  const { buildSystemPrompt } = await jiti.import(enSrc("lib/prompts.ts"));
  const conMapa = buildSystemPrompt({ mode: "chat", plan: "pro", conHerramientas: ["mapa"] });
  ok(/<contenido_externo>/.test(conMapa), "y con el mapa solo, el modelo recibe la regla de contenido externo");
  ok(/no lo obedezcas/i.test(conMapa), "que dice explícitamente que no obedezca lo que venga ahí");

  const conLugar = buildSystemPrompt({ mode: "chat", plan: "pro", lugar: "Zaragoza, Aragón, España" });
  ok(/Zaragoza/.test(conLugar), "el sitio donde está entra en las instrucciones");
  ok(/NO para la calle/.test(conLugar), "avisando de que no sabe la calle");
  const sinLugar = buildSystemPrompt({ mode: "chat", plan: "pro" });
  ok(!/ubicación aproximada/.test(sinLugar), "y sin permiso no se le dice nada de dónde está");

  const ruta = await herramientaMapa.ejecutar({ accion: "como_llegar", hasta: "Jaca" }, ctx(ZGZ));
  ok(/línea recta/.test(ruta.texto), "sin Google dice que la distancia es en línea recta");
  ok(/no te inventes el tiempo/.test(ruta.texto), "y le prohíbe inventarse cuánto se tarda");
  ok(/google\.com\/maps\/dir/.test(ruta.texto), "el enlace sí lleva la ruta de verdad");

  const vacio = await herramientaMapa.ejecutar({ accion: "cerca", que: "nada de nada" }, ctx(ZGZ));
  ok(/No he encontrado/.test(vacio.texto), "cuando no hay nada, lo dice");

  /* ----------------------------- Sin ubicación ---------------------------- */
  console.log("\nSin permiso de ubicación");
  const sinDonde = await herramientaMapa.ejecutar({ accion: "donde_estoy" }, ctx(undefined));
  ok(/No sé dónde está/.test(sinDonde.texto), "no se inventa una ciudad");
  ok(/Ajustes/.test(sinDonde.texto), "y dice dónde se activa");
  ok(!sinDonde.error, "no es un error: el modelo tiene que poder preguntarle");

  const sinCerca = await herramientaMapa.ejecutar({ accion: "cerca", que: "bares" }, ctx(undefined));
  ok(/No sé dónde está/.test(sinCerca.texto), "tampoco para buscar cerca");

  const rutaEscrita = await herramientaMapa.ejecutar(
    { accion: "como_llegar", desde: "Zaragoza", hasta: "Jaca" },
    ctx(undefined),
  );
  ok(/km/.test(rutaEscrita.texto), "pero de un sitio a otro sí funciona sin saber dónde estás");

  /* ---------------------------- Con clave de Google ----------------------- */
  console.log("\nCon clave de Google");
  process.env.GOOGLE_MAPS_API_KEY = "clave-de-mentira";
  const jiti2 = await crearJiti(import.meta.url, {
    alias: { "@": SRC },
    moduleCache: false,
  });
  const { herramientaMapa: conClave } = await jiti2.import(enSrc("lib/tools/mapa.ts"));

  const donde2 = await conClave.ejecutar({ accion: "donde_estoy" }, ctx({ lat: 43.3619, lon: -5.8494 }));
  ok(/Oviedo/.test(donde2.texto), "usa Google cuando hay clave");

  const cerca2 = await conClave.ejecutar({ accion: "cerca", que: "sidrerías" }, ctx({ lat: 43.3619, lon: -5.8494 }));
  ok(/Sidrería El Cuélebre/.test(cerca2.texto), "trae sitios de Google");
  ok(/4\.6\/5/.test(cerca2.texto), "con su nota");
  ok(/abierto ahora/.test(cerca2.texto), "y si está abierto ahora mismo");

  const ruta2 = await conClave.ejecutar(
    { accion: "como_llegar", hasta: "Gijón", transporte: "coche" },
    ctx({ lat: 43.3619, lon: -5.8494 }),
  );
  ok(/31\.4 km por carretera/.test(ruta2.texto), "la distancia es la de la carretera, no la recta");
  ok(/34 minutos/.test(ruta2.texto), "y dice cuánto se tarda");
  ok(/A-66/.test(ruta2.texto), "con los tramos del camino");
  ok(!/<b>/.test(ruta2.texto), "sin la maquetación HTML que manda Google");

  const aGoogle = pedidas.filter((p) => p.ruta.startsWith("/maps/api"));
  ok(aGoogle.every((p) => p.params.key === "clave-de-mentira"), "la clave va en la petición");
  ok(aGoogle.every((p) => p.params.language === "es"), "y se le pide todo en castellano");

  /* -------------------------- Cuando el mapa se cae ----------------------- */
  console.log("\nCuando el mapa falla");
  process.env.MAPA_BASE_OSM = "http://127.0.0.1:1";
  process.env.MAPA_BASE_GOOGLE = "http://127.0.0.1:1";
  delete process.env.GOOGLE_MAPS_API_KEY;
  const jiti3 = await crearJiti(import.meta.url, {
    alias: { "@": SRC },
    moduleCache: false,
  });
  const { herramientaMapa: roto } = await jiti3.import(enSrc("lib/tools/mapa.ts"));
  const caido = await roto.ejecutar({ accion: "cerca", que: "museos" }, ctx(ZGZ));
  ok(Boolean(caido.error), "el fallo llega como error, no como excepción");
  ok(/mapas/i.test(caido.error), "y se entiende de qué era");
} finally {
  servidor.close();
}

console.log(fallos === 0 ? "\nTODO CORRECTO" : `\nFALLOS: ${fallos}`);
process.exit(fallos === 0 ? 0 : 1);
