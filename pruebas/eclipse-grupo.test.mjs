// Cuándo abre la boca ECLIPSE en un grupo. Es la regla que decide si un grupo
// con IA dentro se puede usar: si contesta a todo sin que nadie se lo haya
// pedido, se apaga a los diez minutos; si no contesta nunca, no pinta nada.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { leHablanAEclipse, MODOS, MODO_POR_DEFECTO, comoSeLeVe } =
  await jiti.import(enSrc("lib/grupos/tipos.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

console.log("\nLos tres sitios donde puede estar");
ok(MODOS.length === 3, "hay tres formas de estar en el grupo");
ok(MODOS.every((m) => m.corto && m.explicacion), "y las tres se explican en cristiano, sin tecnicismos");
// Cambiado a propósito: antes era "nombrado" y lo que pasaba en un móvil de
// verdad es que nadie daba con la palabra y el grupo parecía vacío.
ok(MODO_POR_DEFECTO === "siempre", "un grupo nace con ECLIPSE dentro y contestando, sin palabras mágicas");

console.log("\nPor defecto: está y contesta");
ok(leHablanAEclipse("eclipse, búscanos un hotel"), "le hablan por su nombre");
ok(leHablanAEclipse("hola"), "y también sin nombrarle, que es lo que espera cualquiera que lo mete en un grupo");
ok(leHablanAEclipse("ECLIPSE"), "escribir solo «ECLIPSE» contesta: era el caso que fallaba en el móvil de Carlos");

console.log("\nEl modo de antes, para quien lo quiera");
ok(leHablanAEclipse("eclipse, búscanos un hotel", false, "nombrado"), "le hablan por su nombre");
ok(leHablanAEclipse("@eclipse esto qué es", false, "nombrado"), "con arroba también");
ok(leHablanAEclipse("ECLIPSE dinos la hora", false, "nombrado"), "en mayúsculas igual");
ok(leHablanAEclipse("dinos tres sitios para cenar", false, "nombrado"), "una orden directa cuenta aunque no le nombren");
ok(!leHablanAEclipse("yo mañana no puedo", false, "nombrado"), "y lo que se dicen entre ellos lo lee y se calla");
ok(!leHablanAEclipse("jajajaja", false, "nombrado"), "una risa no es una pregunta");
ok(leHablanAEclipse("hola", true, "nombrado"), "al primer mensaje del grupo sí contesta: si no, parece que no hay nadie");

console.log("\nPuesto a contestar a todo");
ok(leHablanAEclipse("yo mañana no puedo", false, "siempre"), "contesta a cualquier cosa");
ok(leHablanAEclipse("jajajaja", false, "siempre"), "también a lo que no es una pregunta");

console.log("\nApagado");
ok(!leHablanAEclipse("eclipse, contéstame", false, "no"), "no contesta ni llamándole por su nombre");
ok(!leHablanAEclipse("hola", true, "no"), "ni al primer mensaje del grupo");

console.log("\nLo que no cambia: nadie ve el correo de nadie");
ok(comoSeLeVe("carlos@ejemplo.com") === "carlos", "sin nombre puesto se ve el principio del correo, nunca el dominio");
ok(comoSeLeVe("carlos@ejemplo.com", "Karl") === "Karl", "y con nombre puesto, el nombre");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
