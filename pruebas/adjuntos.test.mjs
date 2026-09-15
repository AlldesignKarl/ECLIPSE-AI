// Lo más caro de una conversación con fotos, y no se veía: cada adjunto se
// reenviaba entero en TODOS los mensajes siguientes.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { aligerarHistorial } = await jiti.import(enSrc("lib/project.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

// Una foto de móvil ya encogida por la app: unos 300 KB en base64.
const foto = (n) => ({
  id: `a${n}`, name: `${n}.jpg`, mime: "image/jpeg", kind: "image",
  size: 220_000, data: "x".repeat(300_000),
});
const usuario = (texto, adjuntos) => ({ role: "user", content: texto, attachments: adjuntos });
const eclipse = (texto) => ({ role: "assistant", content: texto });

console.log("\nUna conversación como la de Carlos: cuatro fotos y preguntas");
const charla = [
  usuario("¿Dónde son estos rascacielos?", [foto(1)]),
  eclipse("Son las Cuatro Torres, en Madrid."),
  usuario("¿Y estos otros?", [foto(2)]),
  eclipse("Ese es el distrito financiero de Londres."),
  usuario("¿Y este edificio?", [foto(3)]),
  eclipse("La Sagrada Familia, en Barcelona."),
  usuario("¿Y este?", [foto(4)]),
];

const pesar = (msgs) =>
  msgs.reduce(
    (t, m) => t + m.content.length + (m.attachments ?? []).reduce((s, a) => s + a.data.length, 0),
    0,
  );

const antes = pesar(charla);
const despues = pesar(aligerarHistorial(charla));
const ahorro = Math.round((1 - despues / antes) * 100);
console.log(`  del mensaje viajaban ${(antes / 1024).toFixed(0)} KB y ahora ${(despues / 1024).toFixed(0)} KB`);
ok(ahorro > 40, `se ahorra el ${ahorro}% de lo que se manda`);

const salida = aligerarHistorial(charla);
const conFoto = salida.filter((m) => m.attachments?.length);
ok(conFoto.length === 2, `solo viajan las dos últimas fotos (${conFoto.length})`);
ok(conFoto.map((m) => m.attachments[0].name).join() === "3.jpg,4.jpg", "y son las dos últimas, no dos cualesquiera");

console.log("\nLas que ya no viajan dejan constancia");
const vieja = salida[0];
ok(!vieja.attachments, "la primera ya no lleva la foto");
ok(vieja.content.includes("¿Dónde son estos rascacielos?"), "pero su pregunta sigue entera");
ok(/Aquí adjuntó "1\.jpg"/.test(vieja.content), "y se dice qué adjuntó, para no perder el hilo");
ok(/no se vuelve a mandar/.test(vieja.content), "y por qué no está");

console.log("\nUna sola foto y luego cinco preguntas sobre ella");
// Aquí la foto NO debe desaparecer: sigue siendo de lo que se está hablando.
const unaFoto = [
  usuario("Mira esta foto", [foto(1)]),
  eclipse("Es una plaza."),
  usuario("¿Qué edificio es el del fondo?"),
  eclipse("Un ayuntamiento."),
  usuario("¿De qué época?"),
  eclipse("Del XIX."),
  usuario("¿Y la estatua?"),
];
const conservada = aligerarHistorial(unaFoto);
ok(Boolean(conservada[0].attachments?.length), "la foto sigue viajando: es de lo que se habla");

console.log("\nNo se toca nada más");
ok(aligerarHistorial([]).length === 0, "una conversación vacía no rompe nada");
const sinNada = [usuario("hola"), eclipse("qué tal")];
ok(JSON.stringify(aligerarHistorial(sinNada)) === JSON.stringify(sinNada), "sin adjuntos, se queda igual");

// Pasarlo dos veces (navegador y servidor) no puede cambiar el resultado.
const unaVez = aligerarHistorial(charla);
const dosVeces = aligerarHistorial(unaVez);
ok(JSON.stringify(unaVez) === JSON.stringify(dosVeces), "pasarlo dos veces da lo mismo");

// Y lo que ya hacía —quitar el código viejo— tiene que seguir haciéndolo.
const conCodigo = [
  usuario("hazme una web"),
  eclipse("```html index.html\n<h1>uno</h1>\n```"),
  usuario("cámbiala"),
  eclipse("```html index.html\n<h1>dos</h1>\n```"),
  usuario("otra vez"),
  eclipse("```html index.html\n<h1>tres</h1>\n```"),
];
const aligerado = aligerarHistorial(conCodigo);
ok(/omitido para no repetirlo/.test(aligerado[1].content), "el código más viejo se sigue omitiendo");
ok(aligerado[5].content.includes("<h1>tres</h1>"), "y el último se conserva entero");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
