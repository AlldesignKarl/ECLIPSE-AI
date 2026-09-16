// La lógica de los agentes, sin red: qué puede hacer cada uno y qué no.
//
// Lo que se comprueba aquí es lo que decide si esto es una plataforma o una
// página que lo aparenta: que un agente al que le falta algo NO sale como
// listo, que se distingue lo que puede arreglar el cliente de lo que tenemos
// que construir nosotros, y que a cada agente solo se le ponen delante sus
// servicios.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { AGENTES, agenteDe, totalMensual } = await jiti.import(enSrc("lib/agentes/catalogo.ts"));
const { estadoDe, serviciosDe, herramientasDe, puedeTrabajar, configPorDefecto } =
  await jiti.import(enSrc("lib/agentes/tipos.ts"));
const { SERVICIOS, servicioDe } = await jiti.import(enSrc("lib/conexiones/registro.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

console.log("\nEl catálogo se configura en un solo sitio");
ok(AGENTES.length === 6, `hay seis agentes (${AGENTES.length})`);
// Uno va incluido en Pro y por eso vale cero. Los demás cobran, y un cero ahí
// sería un agente regalado sin querer.
ok(AGENTES.every((a) => a.periodo === "mes"), "todos se cobran al mes");
ok(AGENTES.filter((a) => !a.conPro).every((a) => a.precio > 0), "los de pago, todos con su precio");
ok(AGENTES.filter((a) => a.conPro).every((a) => a.precio === 0),
   "y los incluidos en Pro a cero, que es lo que son: no se cobran aparte");
ok(new Set(AGENTES.map((a) => a.id)).size === AGENTES.length, "sin identificadores repetidos");
ok(AGENTES.every((a) => a.instrucciones.length > 200), "todos con instrucciones de verdad, no una frase");
ok(AGENTES.every((a) => a.ejemplos.length >= 2 && a.funciones.length >= 3), "y con qué hacen y ejemplos");
ok(totalMensual(["omni", "sales"]) === 900, "el total mensual sale de los precios del catálogo (900)");
ok(totalMensual(["inventado"]) === 0, "y un agente que no existe no suma nada");

console.log("\nLos servicios que dicen usar EXISTEN, o están marcados como pendientes");
const reales = new Set(SERVICIOS.map((s) => s.id));
for (const a of AGENTES) {
  const mentira = a.integraciones.filter((i) => !i.pendiente && !reales.has(i.servicio));
  ok(mentira.length === 0, `${a.nombre}: ninguna integración inventada${mentira.length ? ` (${mentira.map((m) => m.servicio)})` : ""}`);
}
const pendientes = AGENTES.flatMap((a) => a.integraciones.filter((i) => i.pendiente).map((i) => i.servicio));
ok(pendientes.includes("whatsapp") && pendientes.includes("outlook"),
   "WhatsApp y Outlook están marcados como todavía-no-conectables, no escondidos");
// Gmail estuvo en esa lista hasta que tuvo conector de verdad. Que ya no esté
// es lo que hace que la ficha ofrezca conectarlo en vez de disculparse.
ok(!pendientes.includes("gmail"), "y Gmail ya NO: tiene conector, así que se puede conectar de verdad");
ok(AGENTES.some((a) => a.integraciones.some((i) => i.servicio === "gmail" && !i.pendiente)),
   "y sale como integración conectable de quien la lleva");

/*
  Lo que faltaba y que Carlos encontró en cinco minutos: la ficha de un agente
  decía "requiere conexión: Gmail" y ahí se acababa. Ni cómo, ni qué te van a
  pedir. Esto comprueba que TODO lo que un agente dice necesitar se puede
  conectar de verdad y que el conector explica cómo, en sus propias palabras.
*/
console.log("\nTodo lo que un agente pide se puede conectar, y se explica cómo");
for (const a of AGENTES) {
  const sinExplicar = [];
  for (const i of a.integraciones) {
    if (i.pendiente) continue;
    const s = servicioDe(i.servicio);
    // Pasos para saber DÓNDE se saca, y después o un botón de permiso (oauth)
    // o al menos un campo que pegar. Sin una de las dos cosas, la ficha manda a
    // alguien a una pantalla donde no hay nada que hacer.
    if (!s || s.pasos.length < 2 || (!s.oauth && s.campos.length < 1)) sinExplicar.push(i.servicio);
  }
  ok(sinExplicar.length === 0,
     `${a.nombre}: todas sus conexiones dicen cómo se hacen${sinExplicar.length ? ` (falta: ${sinExplicar})` : ""}`);
}

/*
  Y al revés, que es lo que se pudre solo.

  Gmail estuvo marcado `pendiente` meses; el día que tuvo conector, la marca se
  quedó y la ficha seguía disculpándose por algo que ya se podía conectar. Una
  marca de "todavía no" sobre algo que SÍ existe es peor que no tenerla.
*/
const marcadaYExiste = AGENTES.flatMap((a) =>
  a.integraciones.filter((i) => i.pendiente && servicioDe(i.servicio)).map((i) => `${a.id}/${i.servicio}`),
);
ok(marcadaYExiste.length === 0,
   `ninguna integración se disculpa por algo que ya tiene conector${marcadaYExiste.length ? ` (${marcadaYExiste})` : ""}`);

console.log("\nSin conexiones, nadie finge estar listo");
const sales = agenteDe("sales");
const pelado = estadoDe(sales, []);
ok(pelado.estado === "requiere_conexion", "SALES sin CRM pide conexión");
ok(/HubSpot/.test(pelado.dice), "y dice cuál: HubSpot");
ok(serviciosDe(sales, []).length === 0, "y no tiene ningún servicio que tocar");

console.log("\nCon lo suyo conectado, sí");
const conCrm = estadoDe(sales, ["hubspot", "stripe"]);
ok(conCrm.estado === "listo", "con HubSpot ya puede trabajar");
ok(conCrm.listas.length === 2, "y cuenta las dos cuentas que tiene");
const suyos = serviciosDe(sales, ["hubspot", "stripe", "cloudflare", "ionos"]);
ok(!suyos.includes("cloudflare") && !suyos.includes("ionos"),
   `los dominios están conectados pero no son cosa de SALES: ${JSON.stringify(suyos)}`);
ok(suyos.includes("hubspot") && suyos.includes("stripe"), "y sí entran los que sí usa");

console.log("\nLo que el cliente no puede arreglar se dice aparte");
const comms = agenteDe("comms");
const conSlack = estadoDe(comms, ["slack"]);
ok(conSlack.estado === "listo", "COMMS con Slack ya trabaja");
ok(/todavía no se puede conectar/i.test(conSlack.dice), "pero se dice igual que Outlook y WhatsApp aún no se pueden conectar");
ok(conSlack.sinConector.length === 2, `las que faltan salen contadas (${conSlack.sinConector.length})`);

console.log("\nUn agente que NECESITA algo que no existe, no puede trabajar");
const inventado = {
  ...comms,
  integraciones: [{ servicio: "gmail", nombre: "Gmail", necesaria: true, pendiente: true }],
};
const bloqueado = estadoDe(inventado, ["slack"]);
ok(bloqueado.estado === "sin_conector", "se queda en «falta construirlo»");
ok(/No puede trabajar/.test(bloqueado.dice), "y lo dice sin rodeos, no como una nota al pie");

console.log("\nLas herramientas se pueden recortar");
const config = configPorDefecto(sales);
ok(config.puedeEscribir === false, "un agente nace en SOLO LECTURA, como toda conexión de ECLIPSE");
ok(config.apruebaAntes === true, "y el comercial nace pidiendo aprobación: un correo mal mandado no se recoge");
ok(configPorDefecto(agenteDe("automation")).apruebaAntes === false, "el de automatizaciones no, que es lo suyo");
ok(herramientasDe(sales, { ...config, apagadas: ["buscar_web"] }).includes("conexion"), "apagar una deja las demás");
ok(!herramientasDe(sales, { ...config, apagadas: ["conexion"] }).includes("conexion"), "y la apagada desaparece de verdad");

console.log("\nCuándo puede trabajar y cuándo no");
const listo = estadoDe(sales, ["hubspot"]);
ok(puedeTrabajar(null, listo).puede === false, "sin contrato, no");
ok(/no está contratado/i.test(puedeTrabajar(null, listo).porque), "y se dice por qué");
const contrato = (estado) => ({ agenteId: "sales", estado, desde: 1, config });
ok(puedeTrabajar(contrato("activo"), listo).puede === true, "contratado, activo y con lo suyo conectado: sí");
ok(puedeTrabajar(contrato("pausado"), listo).puede === false, "en pausa, no");
ok(/pausa/i.test(puedeTrabajar(contrato("pausado"), listo).porque), "y se dice que está en pausa");
ok(puedeTrabajar(contrato("pendiente_de_pago"), listo).puede === false, "pendiente de pago, tampoco");
ok(/cobro todavía no está activado/i.test(puedeTrabajar(contrato("pendiente_de_pago"), listo).porque),
   "y se dice que el cobro no está activado, en vez de un error genérico");
ok(puedeTrabajar(contrato("activo"), pelado).puede === false, "activo pero sin su CRM, no trabaja");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
