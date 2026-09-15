// Cuando ECLIPSE planifica tu calendario, lo que contesta es un JSON. Y un
// modelo contesta un JSON envuelto en comillas de bloque, con una frase delante,
// con un campo de menos o con una fecha del mes pasado. Nada de eso puede
// acabar en una pantalla en blanco ni en una tarjeta que dice "el 3 de
// septiembre" estando a 15.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { leerPlan, leerCuandoDelPlan } = await jiti.import(enSrc("lib/tareas/planear.ts"));

const HOY = "2026-09-15";
const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

console.log("\nUn plan que viene bien");
const bueno = leerPlan(JSON.stringify({
  nota: "Te lo he repartido para que no te caiga todo el lunes.",
  encargos: [
    { titulo: "Cómo va la tienda", instruccion: "Mira los pedidos de ayer y dime cuánto suman.", cuando: { tipo: "diario" } },
    { titulo: "Repaso del SEO", instruccion: "Audita la web y dime solo lo que haya que arreglar.", cuando: { tipo: "semanal", dia: 2 } },
  ],
}), HOY);
ok(bueno.encargos.length === 2, "se leen los dos encargos");
ok(bueno.nota.startsWith("Te lo he repartido"), "y la nota que explica por qué lo ha hecho así");
ok(bueno.encargos[1].cuando.dia === 2, "cada uno con su día");

console.log("\nUn plan que viene como vienen de verdad");
const sucio = leerPlan('¡Claro! Aquí tienes tu plan:\n```json\n{"nota":"Va.","encargos":[{"instruccion":"Dime el tiempo que va a hacer el finde.","cuando":{"tipo":"semanal","dia":5}}]}\n```\nEspero que te sirva.', HOY);
ok(sucio.encargos.length === 1, "el JSON se encuentra aunque venga con una frase delante y otra detrás");
ok(sucio.encargos[0].titulo === "Dime el tiempo que va a hacer el finde.", "sin título, se usa el principio del encargo: nadie rellena dos campos para decir una cosa");

console.log("\nLo que no se entiende, no rompe nada");
ok(leerPlan("lo siento, no puedo", HOY).encargos.length === 0, "una respuesta sin JSON devuelve un plan vacío, no un error");
ok(leerPlan('{"encargos": [', HOY).encargos.length === 0, "un JSON a medias tampoco revienta");
const cojo = leerPlan(JSON.stringify({ encargos: [{ titulo: "Sin nada dentro" }, { instruccion: "Esta sí vale.", cuando: { tipo: "diario" } }] }), HOY);
ok(cojo.encargos.length === 1 && cojo.encargos[0].instruccion === "Esta sí vale.", "un encargo sin instrucción se cae y los demás siguen");

console.log("\nLas fechas");
ok(leerCuandoDelPlan({ tipo: "unavez", fecha: "2026-09-20" }, HOY).fecha === "2026-09-20", "una fecha por venir se acepta");
ok(leerCuandoDelPlan({ tipo: "unavez", fecha: "2026-09-15" }, HOY).fecha === "2026-09-15", "hoy también cuenta como por venir");
ok(leerCuandoDelPlan({ tipo: "unavez", fecha: "2026-09-03" }, HOY) === null,
   "una fecha ya pasada se rechaza: enseñar «el 3» estando a 15 es enseñar algo roto");
ok(leerCuandoDelPlan({ tipo: "unavez", fecha: "el jueves" }, HOY) === null, "y una fecha que no es una fecha, igual");
const pasada = leerPlan(JSON.stringify({ encargos: [
  { instruccion: "Esta es de un día que ya pasó.", cuando: { tipo: "unavez", fecha: "2026-01-01" } },
  { instruccion: "Y esta está bien.", cuando: { tipo: "diario" } },
] }), HOY);
ok(pasada.encargos.length === 1, "el encargo con fecha pasada se cae del plan");

console.log("\nLos «cada cuánto» raros, puestos en su sitio");
ok(leerCuandoDelPlan({ tipo: "mensual", dia: 31 }, HOY).dia === 28,
   "«cada día 31» se baja a 28: cuatro meses del año no tienen 31 y el encargo se saltaría febrero sin avisar");
ok(leerCuandoDelPlan({ tipo: "mensual", dia: 0 }, HOY).dia === 1, "y el día 0 no existe");
ok(leerCuandoDelPlan({ tipo: "semanal", dia: 9 }, HOY).dia === 1, "un día de la semana imposible se convierte en lunes");
const inventado = leerCuandoDelPlan({ tipo: "cada dos martes" }, HOY);
ok(inventado.tipo === "semanal" && inventado.dia === 1,
   "y un «cada cuánto» inventado se convierte en «cada lunes»: un día razonable es mejor que perder el encargo");

console.log("\nNi se pasa de largo");
const muchos = leerPlan(JSON.stringify({ encargos: Array.from({ length: 12 }, (_, i) => ({ instruccion: `Encargo ${i}`, cuando: { tipo: "diario" } })) }), HOY);
ok(muchos.encargos.length === 5, "un plan trae cinco encargos como mucho: más no se lee, se hojea");
const largo = leerPlan(JSON.stringify({ nota: "x".repeat(900), encargos: [{ titulo: "y".repeat(200), instruccion: "z".repeat(3000), cuando: { tipo: "diario" } }] }), HOY);
ok(largo.encargos[0].instruccion.length === 1000 && largo.encargos[0].titulo.length === 60 && largo.nota.length === 300,
   "y todo viene recortado a lo que cabe, venga como venga");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
