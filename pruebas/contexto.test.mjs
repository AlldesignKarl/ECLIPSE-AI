// Lo que se le manda al modelo en CADA mensaje, que es lo que se paga en cada
// mensaje: las instrucciones, la memoria y la conversación.
//
// Esta prueba existe por una razón muy concreta: todo esto crece solo. Se añade
// una regla al prompt, se guarda un hecho más, la conversación se alarga… y un
// día el cupo por minuto se acaba antes de que el modelo empiece a escribir. Con
// un presupuesto escrito aquí, crecer de más falla en vez de notarse tres
// semanas después en la factura o en las respuestas cortadas.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { buildSystemPrompt } = await jiti.import(enSrc("lib/prompts.ts"));
const { hechosRelevantes, esPreferencia } = await jiti.import(enSrc("lib/memoria/relevancia.ts"));
const { estiloDe } = await jiti.import(enSrc("lib/estilo.ts"));
const { compactarHistorial } = await jiti.import(enSrc("lib/project.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };
// Aproximación para castellano. No hace falta más: el presupuesto es un techo,
// no una factura.
const tokens = (t) => Math.round(t.length / 3.6);

console.log("\nEl presupuesto de las instrucciones");
const chat = buildSystemPrompt({
  mode: "chat", plan: "pro", web: true, nombre: "Karl",
  conHerramientas: ["buscar_web", "crear_imagen", "crear_archivo", "mapa", "mis_conversaciones"],
});
const codigo = buildSystemPrompt({ mode: "code", plan: "pro", conHerramientas: ["buscar_web"] });
ok(tokens(chat) < 3900, `una conversación normal cabe en 3.900 tokens de instrucciones (${tokens(chat)})`);
ok(tokens(codigo) < 3600, `y ECLIPSE CODE en 3.600, que ahí cada token es archivo (${tokens(codigo)})`);

console.log("\nLo que se le pide a la respuesta");
ok(/AL GRANO/.test(chat) && /uno a cuatro párrafos/i.test(chat), "de uno a cuatro párrafos cortos por defecto");
ok(/Listas solo cuando/.test(chat), "listas solo si se lee mejor");
ok(/no digas que has buscado/.test(chat), "y no puede decir que ha hecho algo que no ha hecho");
ok(/pide ESE dato y solo ese/.test(chat), "si le falta un dato, pide ese y solo ese");
ok(/no te inventes NUNCA/i.test(chat), "nada de inventarse fuentes, precios, IDs ni funciones");

console.log("\nLa personalidad de ECLIPSE cuando todavía no te conoce");
ok(/natural, cercano/.test(chat), "tiene una personalidad de partida propia, no es una hoja en blanco");
ok(/seguridad cuando sabes/.test(chat) && /no estoy seguro/.test(chat), "segura al contestar, pero sin fingir certeza cuando no la hay");
ok(/no se sustituye por la de nadie/.test(chat), "y adaptarse a alguien no es dejar de ser él");

console.log("\nEl repaso de antes de contestar, que NO se ve");
ok(/repásala por dentro y en silencio/.test(chat), "se repasa por dentro");
ok(/Ese repaso NO se escribe/.test(chat), "y no se escribe: nada de razonamiento a la vista");
ok(/Entiendo tu pregunta|Espero que esto te ayude/.test(chat), "se le prohíben las fórmulas de robot por su nombre");

/*
  El perfil de comunicación dentro del presupuesto.

  Es lo último que se ha añadido a lo que viaja en cada mensaje, y lo que más
  fácil se desmadra: seis ejes, cada uno con su frase. Aquí se mide el caso
  peor —alguien de quien se sabe TODO— contra el techo de las instrucciones.
*/
console.log("\nCon el perfil puesto, las instrucciones siguen cabiendo");
const { observar, acumular, perfilVacio, comoLinea } = await jiti.import(enSrc("lib/perfil/tipos.ts"));
let sabido = perfilVacio();
for (const m of [
  "hazlo corto", "al grano", "resúmelo", "más corto", "no te enrolles",
  "el endpoint del json devuelve el token del servidor correcto",
  "el deploy del build falla en el commit del repositorio nuevo",
  "la función del componente usa una variable del framework antiguo",
  "ponme un ejemplo", "dame ejemplos", "enséñame un caso práctico",
  "buah tío qué crack jajaja, esto está guay 😄", "menudo crack eres tío jajaja 😄",
  "qué guay tío, gracias crack jajaja 😄",
])
  sabido = acumular(sabido, observar(m));

const conPerfil = buildSystemPrompt({
  mode: "chat", plan: "pro", web: true, nombre: "Karl",
  conHerramientas: ["buscar_web", "crear_imagen", "crear_archivo", "mapa", "mis_conversaciones"],
  estilo: comoLinea(sabido),
});
ok(comoLinea(sabido).length > 0, "de alguien muy conocido sí sale perfil");
ok(tokens(conPerfil) < 3900, `y con él puesto las instrucciones siguen cabiendo (${tokens(conPerfil)})`);
ok(tokens(conPerfil) - tokens(chat) < 130, `el perfil entero cuesta menos de 130 tokens (${tokens(conPerfil) - tokens(chat)})`);

console.log("\nLa memoria: solo la que viene a cuento");
const hechos = [
  { id: "1", texto: "Prefiere respuestas cortas y directas", cuando: 9 },
  { id: "2", texto: "Tiene una tienda de ropa de montaña en Shopify", cuando: 8 },
  { id: "3", texto: "Su perro se llama Tor", cuando: 7 },
  { id: "4", texto: "Está desarrollando ECLIPSE, su aplicación de IA", cuando: 6 },
  { id: "5", texto: "Usa Mistral como motor principal", cuando: 5 },
  { id: "6", texto: "Toca la guitarra los fines de semana", cuando: 4 },
  { id: "7", texto: "Trabaja casi siempre desde el móvil", cuando: 3 },
  { id: "8", texto: "Vive en Zaragoza", cuando: 2 },
  { id: "9", texto: "Le gusta el cine de los ochenta", cuando: 1 },
];
ok(esPreferencia("Prefiere respuestas cortas y directas"), "una preferencia se reconoce como tal");
ok(!esPreferencia("Su perro se llama Tor"), "y un dato suelto no lo es");

const tienda = hechosRelevantes(hechos, "¿cuántos pedidos me han entrado hoy en la tienda?");
ok(tienda.some((h) => h.id === "2"), "preguntando por la tienda, sale lo de la tienda");
ok(tienda.some((h) => h.id === "1"), "y la preferencia de respuestas cortas, que vale para todo");
ok(!tienda.some((h) => h.id === "3"), "pero no el perro, que no pinta nada aquí");
ok(!tienda.some((h) => h.id === "9"), "ni el cine de los ochenta");

const suelta = hechosRelevantes(hechos, "hola");
ok(suelta.length <= 4, `con un «hola» apenas se manda nada (${suelta.length} hechos de ${hechos.length})`);
ok(suelta.some((h) => esPreferencia(h.texto)), "van las preferencias, que son las que cambian el tono");
// El mínimo existe por "¿por dónde íbamos?": ahí no hay nada que buscar, y un
// filtro estricto dejaría a ECLIPSE a ciegas justo cuando le piden memoria.
const vago = hechosRelevantes(hechos, "¿por dónde íbamos?");
ok(vago.some((h) => h.id === "2"), "y con una pregunta vaga van los más recientes, no nada");
ok(hechosRelevantes(hechos, "eclipse mistral tienda guitarra zaragoza cine perro móvil").length <= 8,
   "y nunca más de ocho, pregunte lo que pregunte");
ok(hechosRelevantes([], "lo que sea").length === 0, "sin memoria, nada");

console.log("\nCómo escribe, sin imitarle");
const cortos = [{ role: "user", content: "va" }, { role: "user", content: "sí" }, { role: "user", content: "dale" }, { role: "user", content: "ok" }];
ok(/muy cortos/.test(estiloDe(cortos)), "si escribe en corto, que le contesten en corto");
const conEmoji = [
  { role: "user", content: "buenas 😄 cómo va" },
  { role: "user", content: "vale bro 👌 lo miro" },
  { role: "user", content: "jaja gracias" },
];
const e = estiloDe(conEmoji);
ok(/emojis/.test(e) && /informal/.test(e), "detecta los emojis y el registro informal");
ok(/NO copies sus palabras/.test(e), "y se le dice explícitamente que no le imite: eso es lo que suena a burla");
ok(!/buenas|bro|jaja/.test(e), "lo que sale son señales, nunca sus frases");

const formal = [
  { role: "user", content: "Buenos días, le agradecería que revisara el documento adjunto." },
  { role: "user", content: "Muchas gracias. ¿Podría usted indicarme el plazo estimado?" },
  { role: "user", content: "De acuerdo, quedo a la espera de su respuesta. Un cordial saludo." },
];
ok(/usted/.test(estiloDe(formal)), "y si le hablan de usted, de usted");
ok(estiloDe([{ role: "user", content: "hola" }]) === "", "con un mensaje suelto no se inventa un perfil");
ok(tokens(estiloDe(conEmoji)) < 90, `y todo esto cuesta menos de 90 tokens (${tokens(estiloDe(conEmoji))})`);

console.log("\nUna conversación larga no se manda entera");
const larga = Array.from({ length: 40 }, (_, i) => ({
  role: i % 2 === 0 ? "user" : "assistant",
  content: `Mensaje número ${i} con su explicación larga. ${"palabras de relleno ".repeat(30)}`,
}));
const compacta = compactarHistorial(larga);
ok(compacta.length === larga.length, "no se pierde ningún turno: se recortan, no se tiran");
ok(compacta[0].content === larga[0].content, "el primero va entero: es el que dice de qué va todo");
ok(compacta.at(-1).content === larga.at(-1).content, "y los últimos también, que son los que se están hablando");
ok(compacta[5].content.includes("(recortado"), "los de en medio se quedan en una línea");
const antes = larga.reduce((s, m) => s + m.content.length, 0);
const despues = compacta.reduce((s, m) => s + m.content.length, 0);
ok(despues < antes * 0.55, `una conversación de 40 mensajes pesa menos de la mitad (${Math.round((despues / antes) * 100)}%)`);

const corta = larga.slice(0, 8);
ok(JSON.stringify(compactarHistorial(corta)) === JSON.stringify(corta), "y una conversación corta no se toca");

const conCodigo = [
  { role: "user", content: "hazme una web" },
  ...Array.from({ length: 20 }, () => ({ role: "user", content: "cambia esto " + "x".repeat(300) })),
  { role: "assistant", content: "```html\n<html>" + "y".repeat(400) + "</html>\n```" },
  ...Array.from({ length: 13 }, () => ({ role: "user", content: "otra cosa" })),
];
const conservado = compactarHistorial(conCodigo);
ok(conservado[21].content === conCodigo[21].content,
   "lo que todavía lleva código va entero: es la versión viva que hay que poder corregir");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
