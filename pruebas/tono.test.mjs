// Cómo se le pide a ECLIPSE que hable: al grano, acertando, y devolviendo el
// registro de quien le escribe. Son instrucciones, así que lo que se comprueba
// es que estén, que estén donde toca, y que NO estén donde estorban.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { buildSystemPrompt } = await jiti.import(enSrc("lib/prompts.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const chat = buildSystemPrompt({ mode: "chat", plan: "pro" });
const codigo = buildSystemPrompt({ mode: "code", plan: "pro" });
const llamada = buildSystemPrompt({ mode: "chat", plan: "pro", voz: true });

console.log("\nAl grano");
ok(/AL GRANO/.test(chat), "se le dice en mayúsculas, que es lo que más se incumple");
ok(/una o dos frases/.test(chat), "una pregunta corta se contesta corta");
ok(/repite la pregunta con otras palabras/.test(chat), "y se le prohíbe el párrafo de entrada que no dice nada");
ok(/resume lo que acabas de decir/.test(chat), "y el de cierre que repite lo dicho");
ok(/te lo desarrollo/.test(chat), "lo que se queda fuera se ofrece, no se suelta");
ok(/largo sin miedo/.test(chat), "pero cuando toca largo, largo: no es cortar por cortar");

console.log("\nAcertar");
ok(/Acertar antes que sonar seguro/.test(chat), "se le pide acertar, no sonar convincente");
ok(/o si te suena/.test(chat), "distinguir saber de que te suene");
ok(/peor que no responder/.test(chat), "un dato inventado es peor que no contestar");
ok(/tiene trampa|error de partida/.test(chat), "y una pregunta con un error de base se dice antes de contestarla");

console.log("\nComo un amigo");
ok(/jajaja/.test(chat), "si se ríe, se ríe");
ok(/\bbro\b/.test(chat) && /colega/.test(chat), "si le llaman bro o colega, contesta igual");
ok(/de usted, le hablas de usted/.test(chat), "y si le hablan de usted, de usted");
ok(/No finjas/.test(chat), "pero sin fingir colegueo que nadie ha pedido");
ok(/no es dar la razón/.test(chat), "y ser amigo no es darle la razón en todo");
ok(/los usa él primero/.test(chat), "los emojis, solo si los usa él");

console.log("\nDonde estorba, no va");
ok(!/jajaja/.test(codigo), "en ECLIPSE CODE no van las reglas de tono: el cupo es para el archivo");
ok(!/Acertar antes que sonar seguro/.test(codigo), "ni las de rigor con fuentes");
// Nada de lo nuevo pesa en el cupo por minuto de ECLIPSE CODE, que es donde
// cada token de instrucciones es un token menos de archivo.
for (const trozo of ["AL GRANO", "Acertar antes que sonar seguro", "Devuélvele el registro"])
  ok(!codigo.includes(trozo), `«${trozo.slice(0, 22)}…» no entra en ECLIPSE CODE`);

console.log("\nEn una llamada manda la llamada");
ok(/ESTO ES UNA LLAMADA DE VOZ/.test(llamada), "se le dice que le van a escuchar, no leer");
ok(
  llamada.indexOf("ESTO ES UNA LLAMADA DE VOZ") > llamada.indexOf("AL GRANO"),
  "y va después de las reglas de formato, para poder mandar sobre ellas",
);
ok(/Manda sobre cualquier otra instrucción/.test(llamada), "diciéndolo además con todas las letras");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
