// Cuándo se pasa al siguiente motor y cuándo se enseña el error. La regla que
// convirtió "Groq no tiene ningún modelo" en un recuadro rojo, con Mistral
// configurado al lado sin que nadie lo intentara.
import { readFileSync } from "node:fs";
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { CompatError } = await jiti.import(enSrc("lib/openai-compat.ts"));

// La función tal y como está en la ruta, no una copia que se quede vieja.
const fuente = readFileSync(enSrc("app/api/chat/route.ts"), "utf8");
const desde = fuente.indexOf("const esDeEsteMotor");
const hasta = fuente.indexOf(";", fuente.indexOf("err.message)", desde));
const cuerpo = fuente.slice(desde, hasta).replace("const esDeEsteMotor =", "");
const esDeEsteMotor = new Function(
  "GeminiError", "CompatError",
  `return (${cuerpo.replace(/\(err: unknown\)/, "(err)")});`,
)(class GeminiError extends Error { constructor(m, s) { super(m); this.status = s; } }, CompatError);

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

console.log("\nSe prueba el siguiente motor");
const pasa = [
  ["sin cupo (429)", new CompatError("Has llegado al límite gratuito de Groq por ahora.", 429)],
  ["mensaje demasiado grande (413)", new CompatError("demasiado largo", 413)],
  ["el modelo ya no existe (404)", new CompatError("Groq no tiene ahora mismo ningún modelo disponible.", 404)],
  ["sin modelos servibles (400)", new CompatError("Groq no tiene ahora mismo ningún modelo disponible.", 400)],
  ["cuota agotada dicho con otras palabras", new CompatError("quota exceeded for this project", 403)],
];
for (const [nombre, err] of pasa) ok(esDeEsteMotor(err), nombre);

console.log("\nEsto sí es para enseñarlo: no lo arregla cambiar de motor");
const no = [
  ["clave inválida (401)", new CompatError("La clave no es válida. Revísala en Ajustes.", 401)],
  ["el proveedor se cayó (500)", new CompatError("Groq: internal server error", 500)],
  ["un fallo nuestro cualquiera", new Error("undefined is not a function")],
];
for (const [nombre, err] of no) ok(!esDeEsteMotor(err), nombre);

console.log("\nY el texto que ve el usuario");
const { PRESETS } = await jiti.import(enSrc("lib/openai-compat.ts"));
const compat = readFileSync(enSrc("lib/openai-compat.ts"), "utf8");
const mensajes = [...compat.matchAll(/new CompatError\(\s*(?:\/\/[^\n]*\n\s*)*`([^`]+)`/g)].map((m) => m[1]);
ok(mensajes.length > 0, `se encuentran los mensajes (${mensajes.length})`);
const mandones = mensajes.filter((m) => /otro motor en Ajustes|cambia el motor/i.test(m));
ok(mandones.length === 0, `ninguno manda al usuario a cambiar el motor (${mandones.join(" | ") || "ninguno"})`);
ok(Boolean(PRESETS.mistral), "los motores siguen ahí");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
