// El router: qué motor pide cada mensaje.
//
// Lo que se comprueba aquí es lo que pidió Carlos con sus propios ejemplos, más
// lo que NO pidió y es lo que de verdad decide si esto sirve: que el
// especialista no acabe contestándolo todo. Un router que en la duda cambia de
// motor es un router que cambia de motor siempre, y entonces no es un router.
//
// Sin red y sin modelo: son reglas locales, así que esto corre en milisegundos.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { decidirMotor } = await jiti.import(enSrc("lib/router.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const decide = (ultimo, extra = {}) => decidirMotor({ ultimo, ...extra });
const normal = (t) => !decide(t).especialista;
const especial = (t, motivo) => {
  const d = decide(t);
  return d.especialista && (!motivo || d.motivo === motivo);
};

console.log("\nLos ejemplos que puso Carlos, uno por uno");
ok(normal("Hola, ¿qué tal?"), "«Hola, ¿qué tal?» → el de siempre");
ok(normal("Explícame qué es la fotosíntesis"), "«Explícame qué es la fotosíntesis» → el de siempre");
ok(normal("¿Cuál es la capital de Francia?"), "«¿Cuál es la capital de Francia?» → el de siempre");
ok(especial("Escribe una función JavaScript que ordene un array de objetos por fecha", "codigo"),
   "«Escribe una función JavaScript que…» → el especialista, por código");
ok(especial("Este código me da este error, arréglalo: no funciona la función", "codigo"),
   "«Este código me da este error, arréglalo» → el especialista, por código");
ok(especial("Analiza este algoritmo y encuentra el problema de complejidad", "razonar"),
   "«Analiza este algoritmo y encuentra el problema» → el especialista, por razonar");
ok(especial("Resuelve este problema complejo y explica el razonamiento paso a paso", "razonar"),
   "«Resuelve este problema y explica el razonamiento» → el especialista, por razonar");

console.log("\nLo que no se puede fingir: un bloque de código o una traza");
ok(especial("mira\n```js\nconst a = 1\n```", "codigo"), "un bloque de código pegado basta, aunque el mensaje sea corto");
ok(especial("TypeError: Cannot read properties of undefined (reading 'map')", "codigo"), "una traza de error basta sola");
ok(especial("Traceback (most recent call last):\n  File \"a.py\", line 3, in <module>", "codigo"), "y una de Python también");
ok(especial("npm ERR! code ERESOLVE", "codigo"), "y un error de npm");

console.log("\nUn texto muy largo se va al que más contexto traga");
ok(especial("x".repeat(4200), "contexto"), "cuatro mil caracteres pegados ya son contexto");
ok(normal("x".repeat(900)), "pero novecientos no: cambiar de motor ahí no gana nada");
const charla = Array.from({ length: 30 }, () => ({ role: "user", content: "y".repeat(800) }));
ok(decidirMotor({ ultimo: "sigue con eso", historial: charla }).motivo === "contexto",
   "y una conversación con mucho recorrido también, aunque el último mensaje sea corto");

console.log("\nLos frenos: que el especialista no lo conteste todo");
ok(normal("¿y el código?"), "«¿y el código?» es una continuación, no un encargo");
ok(normal("arréglalo"), "«arréglalo» tampoco: es corto y va de lo que ya se hablaba");
ok(normal("falla"), "ni «falla»");
ok(normal("¿en qué año salió Python?"), "una pregunta de dato suelto no cambia de motor aunque nombre un lenguaje");
ok(normal("¿qué significa API?"), "ni una de vocabulario");
ok(normal("quiero abrir una tienda online y necesito una web bonita para venderla"),
   "ni alguien hablando de su negocio, aunque diga «web»");
ok(normal("gracias, ha quedado genial"), "ni un gracias");
ok(normal("¿cuánto cuesta un dominio .com al año más o menos?"), "ni una pregunta de precios");

console.log("\nECLIPSE CODE no se toca: ahí el motor lo elige el usuario");
ok(!decidirMotor({ ultimo: "hazme una tienda entera en React", modo: "code" }).especialista,
   "en modo code el router se aparta, que es donde se decide si un archivo sale entero");
ok(!decidirMotor({ ultimo: "```js\nconst a = 1\n```", modo: "code" }).especialista,
   "ni con un bloque de código delante");

console.log("\nY con nada, nada");
ok(normal(""), "un mensaje vacío no cambia de motor");
ok(normal("   "), "ni uno en blanco");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
