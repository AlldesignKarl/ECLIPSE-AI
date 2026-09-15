// El perfil de comunicación: que ECLIPSE aprenda cómo le gusta a cada uno que
// le hablen, poco a poco, y sin inventarse nada.
//
// Las dos condiciones que puso Carlos son las que se comprueban aquí, porque
// son las que separan "se adapta" de "cambia de personalidad cada mensaje":
//   1. GRADUAL: un mensaje no mueve el perfil; varios seguidos sí.
//   2. SIN INVENTAR: lo que no se ha visto lo bastante, no se usa.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { observar, acumular, perfilVacio, comoLinea, comoLista, idiomaHabitual } =
  await jiti.import(enSrc("lib/perfil/tipos.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

/** Meterle N mensajes iguales, que es como se aprende de verdad. */
const tras = (mensajes) => mensajes.reduce((p, m) => acumular(p, observar(m)), perfilVacio());

console.log("\nLeer un mensaje: señales, no frases");
const corto = observar("hazlo corto porfa");
ok(corto.directo === 1, "«hazlo corto» es pedir ir al grano");
ok(corto.largo === 0, "y también dice que las quiere breves");
ok(observar("explícamelo con detalle, que no lo entiendo").directo === 0, "«explícamelo con detalle» es lo contrario");
ok(observar("¿me lo puedes poner con un ejemplo?").ejemplos === 1, "pedir un ejemplo se apunta");
ok(observar("buenos días, ¿sería usted tan amable de revisarlo?").formal === 1, "el usted se nota");
ok(observar("buah tío qué crack jajaja").formal === 0, "y el colegueo también");
ok(observar("el endpoint devuelve un json con el token dentro").tecnico === 1, "se ve quién sabe de tecnología");
ok(observar("vale").tecnico === undefined, "pero en un «vale» no se ve nada: no se apunta");
ok(observar("vale").ejemplos === undefined, "un «vale» tampoco dice que no le gusten los ejemplos");
ok(observar("me alegro mucho de eso 😄").emojis === 1, "los emojis se ven");
ok(observar("mándame el resumen del informe cuando puedas").emojis === 0, "y un mensaje con texto y sin ninguno cuenta como que no los usa");
ok(Object.keys(observar("   ")).length === 0, "de un mensaje vacío no sale nada");

console.log("\nGradual: un mensaje suelto NO cambia a ECLIPSE");
const unoSolo = tras(["hazlo corto"]);
ok(comoLinea(unoSolo) === "", "con un mensaje no se le dice nada al modelo todavía");
const dos = tras(["hazlo corto", "más corto"]);
ok(comoLinea(dos) === "", "con dos, tampoco: eso sigue siendo casualidad");

console.log("\nPero insistiendo, se adapta");
const insistiendo = tras(["hazlo corto", "más corto", "al grano", "resúmelo", "no te enrolles"]);
ok(/contéstale corto/.test(comoLinea(insistiendo)), "a la quinta vez, ECLIPSE ya le contesta corto");
ok(/la respuesta primero/.test(comoLinea(insistiendo)), "y sabe que quiere la respuesta antes que el porqué");
ok(insistiendo.ejes.largo.valor < 0.32, `y el eje se ha movido de verdad (${insistiendo.ejes.largo.valor})`);

console.log("\nY se puede volver atrás: no se queda clavado");
let vuelta = insistiendo;
for (const m of ["explícamelo con detalle", "amplía eso por favor", "desarróllalo paso a paso", "explícame en profundidad cómo funciona", "extiéndete un poco más en eso", "explícamelo en detalle otra vez", "amplía la explicación por favor", "desarróllalo en profundidad"])
  vuelta = acumular(vuelta, observar(m));
ok(!/contéstale corto/.test(comoLinea(vuelta)), "quien cambia de gusto deja de tener el de antes");
ok(vuelta.ejes.largo.valor > insistiendo.ejes.largo.valor, "el eje se mueve al otro lado, sin saltos");

console.log("\nNo se inventa nada");
const nada = tras(["hola", "vale", "ok", "gracias"]);
ok(comoLinea(nada) === "", "de cuatro monosílabos no sale ningún perfil");
ok(comoLista(nada).length === 0, "ni nada que enseñarle en Ajustes");
ok(comoLinea(null) === "", "y sin perfil, ni una palabra");
const tibio = tras(["hazlo corto", "explícamelo con detalle", "hazlo corto", "amplía eso"]);
ok(!/contéstale corto|agradece el detalle/.test(comoLinea(tibio)), "y de alguien que pide las dos cosas no se decide nada");

console.log("\nEl idioma, cuando es el suyo de verdad");
const enIngles = tras([
  "what is the best way to do this",
  "can you explain the difference with the other one",
  "please give me a short answer about this",
  "and what about the price of the thing",
  "could you check the numbers from the report",
]);
ok(idiomaHabitual(enIngles) === "en", "quien escribe siempre en inglés tiene el inglés por idioma");
ok(/contéstale en ese idioma/.test(comoLinea(enIngles)), "y se le contesta en el suyo");
const mezcla = tras(["quiero hacer esto para mañana", "what is the best way to do this", "cómo puedo hacer esto"]);
ok(idiomaHabitual(mezcla) === null, "quien mezcla dos idiomas no tiene «el suyo», y no se le impone ninguno");

console.log("\nLo que se aprende se puede mirar");
const mirable = tras(["hazlo corto", "al grano", "resúmelo", "más corto", "no te enrolles"]);
ok(comoLista(mirable).some((l) => /respuestas cortas/i.test(l)), "en Ajustes se lee en cristiano");
ok(comoLista(mirable).every((l) => l.length < 60), "y en frases, no en números");

console.log("\nLa línea que viaja en cada mensaje es CORTA");
const todo = tras([
  "hazlo corto", "al grano", "resúmelo", "más corto", "no te enrolles",
  "el endpoint del json devuelve el token del servidor correcto",
  "el deploy del build falla en el commit del repositorio nuevo",
  "la función del componente usa una variable del framework antiguo",
  "ponme un ejemplo", "dame ejemplos", "enséñame un caso práctico",
]);
const linea = comoLinea(todo);
ok(linea.length > 0, "con mucho aprendido sí hay línea");
ok(Math.round(linea.length / 3.6) < 120, `y cabe en 120 tokens aunque lo sepa todo (${Math.round(linea.length / 3.6)})`);
ok(!/NO copies sus palabras/.test("") && /NO copies sus palabras/.test(linea), "con la orden de no imitarle, que es lo que suena a burla");
ok(/manda lo que pide ahora/.test(linea), "y si en este mensaje pide otra cosa, manda lo de ahora");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
