// Cuándo toca un encargo. Es la regla de la que depende todo: si se equivoca,
// o no se hace nunca o se hace cinco veces el mismo día.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { tocaHoy, yaHechaHoy, pendientes, textoDe, DIAS } =
  await jiti.import(enSrc("lib/tareas/tipos.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

// Días de referencia (UTC). 2026-09-14 es lunes.
const lunes = new Date("2026-09-14T06:00:00Z");
const jueves = new Date("2026-09-17T06:00:00Z");
const sabado = new Date("2026-09-19T06:00:00Z");
const domingo = new Date("2026-09-20T06:00:00Z");

console.log("\nQué día toca");
ok(DIAS[lunes.getUTCDay()] === "lunes", "el calendario de referencia cuadra");
ok(tocaHoy({ tipo: "diario" }, lunes) && tocaHoy({ tipo: "diario" }, domingo), "«cada día» toca también en domingo");
ok(tocaHoy({ tipo: "laborables" }, lunes) && tocaHoy({ tipo: "laborables" }, jueves), "«de lunes a viernes» toca entre semana");
ok(!tocaHoy({ tipo: "laborables" }, sabado) && !tocaHoy({ tipo: "laborables" }, domingo), "y NO toca el fin de semana");
ok(tocaHoy({ tipo: "semanal", dia: 4 }, jueves), "«cada jueves» toca el jueves");
ok(!tocaHoy({ tipo: "semanal", dia: 4 }, lunes), "y no el lunes");
ok(tocaHoy({ tipo: "semanal", dia: 0 }, domingo), "el domingo es el 0, como en JavaScript");

console.log("\nNo se repite el mismo día");
const porLaMañana = new Date("2026-09-14T06:00:00Z").getTime();
const porLaTarde = new Date("2026-09-14T19:30:00Z");
ok(yaHechaHoy(porLaMañana, porLaTarde), "hecha de mañana, por la tarde ya está hecha");
ok(!yaHechaHoy(porLaMañana, jueves), "pero tres días después toca otra vez");
ok(!yaHechaHoy(undefined, lunes), "una recién creada no está hecha");
// El cambio de mes y de año no puede confundirla.
ok(!yaHechaHoy(new Date("2025-09-14T06:00:00Z").getTime(), lunes), "el mismo día del año pasado no cuenta");
ok(!yaHechaHoy(new Date("2026-08-14T06:00:00Z").getTime(), lunes), "ni el mismo día del mes pasado");

console.log("\nQué hay que hacer ahora mismo");
const tareas = [
  { id: "a", titulo: "Diaria", cuando: { tipo: "diario" }, activa: true },
  { id: "b", titulo: "Pausada", cuando: { tipo: "diario" }, activa: false },
  { id: "c", titulo: "Ya hecha hoy", cuando: { tipo: "diario" }, activa: true, ultima: porLaMañana },
  { id: "d", titulo: "De los jueves", cuando: { tipo: "semanal", dia: 4 }, activa: true },
  { id: "e", titulo: "Laborable", cuando: { tipo: "laborables" }, activa: true },
];
const hoyLunes = pendientes(tareas, porLaTarde).map((t) => t.id);
ok(hoyLunes.includes("a"), "la diaria, sí");
ok(!hoyLunes.includes("b"), "la pausada, no");
ok(!hoyLunes.includes("c"), "la que ya se hizo hoy, no");
ok(!hoyLunes.includes("d"), "la de los jueves, hoy no");
ok(hoyLunes.includes("e"), "la laborable, sí porque es lunes");
ok(pendientes(tareas, jueves).map((t) => t.id).join() === "a,c,d,e", `el jueves cambia la lista (${pendientes(tareas, jueves).map((t) => t.id).join()})`);
ok(pendientes(tareas, sabado).map((t) => t.id).join() === "a,c", "y el sábado solo quedan las diarias");

console.log("\nCómo se lee");
ok(textoDe({ tipo: "diario" }) === "Cada día", "«Cada día»");
ok(textoDe({ tipo: "laborables" }) === "De lunes a viernes", "«De lunes a viernes»");
ok(textoDe({ tipo: "semanal", dia: 4 }) === "Cada jueves", "«Cada jueves»");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
