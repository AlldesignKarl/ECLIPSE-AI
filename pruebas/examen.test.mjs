// Modo Examen: que lo que se pregunta salga de los apuntes de quien estudia.
//
// Esto es lo único que de verdad importa aquí, y por eso es lo que más se
// comprueba. Una aplicación para estudiar que se inventa una pregunta no es
// peor que no tenerla: te hace estudiar lo que no es, y eso no se descubre
// hasta el día del examen. Pedirle a un modelo que no invente es una súplica;
// comprobar que lo que ha dicho está en el texto es una comprobación, y es lo
// que se prueba aquí.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const E = await jiti.import(enSrc("lib/examen/tipos.ts"));
const {
  cuantoSaleDe, estaRespaldada, largaRespaldada, leerMapa, leerPreguntas,
  leerLargas, leerCorreccion, notaDe, porcentajes, aRepasar, evolucion, sacarJSON,
} = E;

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

// Unos apuntes de verdad, cortos: es lo que habría leído de dos fotos.
const EXTRACTO = [
  { id: "t0", tema: "Célula", texto: "La mitocondria es el orgánulo encargado de producir la energía de la célula en forma de ATP mediante la respiración celular.", fuente: { archivo: "apuntes1.jpg", pagina: 1 } },
  { id: "t1", tema: "Mitosis", texto: "La mitosis tiene cuatro fases: profase, metafase, anafase y telofase. En la metafase los cromosomas se alinean en el centro de la célula.", fuente: { archivo: "apuntes2.jpg" } },
];

console.log("\nContar cuánto de algo sale del material");
ok(cuantoSaleDe("la mitocondria produce ATP", EXTRACTO[0].texto) > 0.6, "lo que está en los apuntes puntúa alto");
ok(cuantoSaleDe("el aparato de Golgi empaqueta proteínas", EXTRACTO[0].texto) < 0.3, "lo que no está, puntúa bajo");
ok(cuantoSaleDe("", EXTRACTO[0].texto) === 0, "y de la nada no sale nada");

console.log("\nUna pregunta que SÍ sale de los apuntes pasa");
const buena = {
  id: "p0", trozo: "t0", tema: "Célula",
  enunciado: "¿Qué orgánulo produce la energía de la célula en forma de ATP?",
  opciones: ["La mitocondria", "El núcleo", "El ribosoma", "El lisosoma"],
  correcta: 0, explicacion: "Lo pone en tus apuntes.", fuente: EXTRACTO[0].fuente,
};
ok(estaRespaldada(buena, EXTRACTO), "una pregunta sacada del material se acepta");

console.log("\nY una inventada NO pasa, aunque sea verdad");
const inventada = { ...buena, trozo: "t0", enunciado: "¿Qué orgánulo empaqueta las proteínas para exportarlas?", opciones: ["El aparato de Golgi", "La mitocondria", "El núcleo", "La pared celular"], correcta: 0 };
ok(!estaRespaldada(inventada, EXTRACTO), "algo cierto en biología pero que NO está en sus apuntes se cae");
ok(!estaRespaldada({ ...buena, trozo: "t99" }, EXTRACTO), "y una que cita un trozo que no existe, también");
ok(!estaRespaldada({ ...buena, opciones: ["La mitocondria"] }, EXTRACTO), "una con una sola opción no es una pregunta");
ok(!estaRespaldada({ ...buena, opciones: ["La mitocondria", "La mitocondria", "El núcleo", "X"] }, EXTRACTO), "ni una con dos opciones iguales");
ok(!estaRespaldada({ ...buena, correcta: 7 }, EXTRACTO), "ni una cuya respuesta correcta no existe");
ok(!estaRespaldada({ ...buena, enunciado: "" }, EXTRACTO), "ni una sin enunciado");

console.log("\nLeer lo que conteste el modelo, y tirar lo que no se pueda comprobar");
const contestado = JSON.stringify({ preguntas: [
  { enunciado: "¿Qué orgánulo produce el ATP de la célula?", opciones: ["La mitocondria", "El núcleo", "El ribosoma", "La vacuola"], correcta: 0, explicacion: "Está en tus apuntes.", trozo: "t0" },
  { enunciado: "¿Quién descubrió la penicilina?", opciones: ["Fleming", "Pasteur", "Koch", "Darwin"], correcta: 0, explicacion: "Cultura general.", trozo: "t0" },
  { enunciado: "¿En qué fase de la mitosis se alinean los cromosomas en el centro?", opciones: ["Metafase", "Profase", "Anafase", "Telofase"], correcta: 0, explicacion: "Lo pone.", trozo: "t1" },
]});
const leidas = leerPreguntas(contestado, EXTRACTO);
ok(leidas.length === 2, `de tres preguntas se quedan las dos que salen del material (${leidas.length})`);
ok(!leidas.some((p) => /penicilina/i.test(p.enunciado)), "la de la penicilina no llega nunca a la pantalla");
ok(leidas[0].fuente.archivo === "apuntes1.jpg", "y cada una se queda con su archivo de origen");
ok(leidas[1].fuente.archivo === "apuntes2.jpg", "cada una con el suyo, no todas con el primero");
ok(leidas[0].tema === "Célula", "y con su tema, que es lo que luego dice qué repasar");

console.log("\nCon un modelo que conteste basura, no se rompe nada");
ok(leerPreguntas("lo siento, no puedo ayudarte con eso", EXTRACTO).length === 0, "un modelo que se niega no rompe la pantalla");
ok(leerPreguntas("```json\n{\"preguntas\":[]}\n```", EXTRACTO).length === 0, "ni uno que devuelve la lista vacía");
ok(sacarJSON('aquí tienes: {"a":1} espero que te sirva') !== null, "el JSON envuelto en frases se saca igual");

console.log("\nEl mapa del examen: solo lo que hay");
const mapa = leerMapa(JSON.stringify({
  temas: [{ nombre: "Célula", emoji: "🧬", cobertura: 90 }, { nombre: "Mitosis", cobertura: 250 }, { nombre: "", cobertura: 10 }],
  trozos: [
    { tema: "Célula", texto: "La mitocondria produce la energía de la célula en forma de ATP.", archivo: "apuntes1.jpg", pagina: 1 },
    { tema: "Célula", texto: "corto", archivo: "apuntes1.jpg" },
    { tema: "Mitosis", texto: "La mitosis tiene cuatro fases bien diferenciadas entre sí.", archivo: "inventado.jpg" },
  ],
}), ["apuntes1.jpg", "apuntes2.jpg"]);
ok(mapa.mapa.length === 2, "los temas sin nombre se caen");
ok(mapa.mapa[1].cobertura === 100, "una cobertura de 250 se queda en 100, que es lo que existe");
ok(mapa.mapa[0].emoji === "🧬", "y el emoji se respeta si lo puso");
ok(mapa.extracto.length === 2, "un trozo de dos palabras no respalda nada y se cae");
ok(mapa.extracto[1].fuente.archivo === "apuntes1.jpg", "un archivo inventado se cambia por uno real: si no, la fuente no sirve para comprobar");
ok(mapa.extracto[0].fuente.pagina === 1, "y la página se guarda, para poder ir a mirarlo");

console.log("\nLas de desarrollo, con la misma vara de medir");
const largas = leerLargas(JSON.stringify({ preguntas: [
  { enunciado: "Explica qué hace la mitocondria en la célula.", puntos: 2, espera: ["produce la energía de la célula", "en forma de ATP"], trozo: "t0" },
  { enunciado: "Explica el ciclo de Krebs con sus ocho pasos.", puntos: 3, espera: ["acetil-CoA entra en el ciclo", "se produce NADH y FADH2"], trozo: "t0" },
]}), EXTRACTO);
ok(largas.length === 1, "la que pide algo que no está en los apuntes no se pone");
ok(largas[0].puntos === 2, "y la buena conserva lo que vale");
ok(leerLargas(JSON.stringify({ preguntas: [{ enunciado: "Explica algo", puntos: 99, espera: ["produce la energía de la célula en forma de ATP"], trozo: "t0" }] }), EXTRACTO)[0].puntos === 5,
   "una pregunta de 99 puntos se queda en 5: un examen reparte puntos, no regala");

console.log("\nCorregir sin pasarse de nota");
const c = leerCorreccion(JSON.stringify({ puntos: 5, bien: ["ha dicho lo del ATP"], falta: ["no menciona la respiración celular"], errores: [], mejorar: ["concreta más"], esperada: "La mitocondria produce ATP." }), 2);
ok(c.puntos === 2, "no se pueden dar 5 puntos en una pregunta que vale 2");
ok(leerCorreccion(JSON.stringify({ puntos: -3 }), 2).puntos === 0, "ni menos de cero");
ok(leerCorreccion(JSON.stringify({ puntos: 1.5 }), 2).puntos === 1.5, "y los medios puntos valen, que así se corrige de verdad");
ok(c.errores.length === 0, "si no hay errores, no se inventan para rellenar");
ok(leerCorreccion("no es json", 2) === null, "y si el modelo contesta cualquier cosa, se sabe");

console.log("\nLas cuentas del progreso");
ok(notaDe(7, 10) === 7, "siete de diez es un 7");
ok(notaDe(0, 0) === 0, "y sin preguntas no hay nota, pero tampoco error");
const intentos = [
  { id: "1", tipo: "quiz", cuando: 1, nota: 5, aciertos: 5, total: 10, porTema: { Célula: { bien: 4, total: 5 }, Mitosis: { bien: 1, total: 5 } }, falladas: ["Mitosis"] },
  { id: "2", tipo: "quiz", cuando: 2, nota: 8, aciertos: 8, total: 10, porTema: { Célula: { bien: 5, total: 5 }, Mitosis: { bien: 3, total: 5 } }, falladas: ["Mitosis"] },
];
ok(aRepasar(intentos)[0] === "Mitosis", "lo que peor va sale lo primero para repasar");
ok(!aRepasar(intentos).includes("Célula"), "y lo que ya se sabe no se manda repasar");
ok(JSON.stringify(evolucion(intentos)) === "[5,8]", "la nota se ve subir, del primero al último");
ok(porcentajes(intentos[1].porTema)[0].tema === "Mitosis", "y por temas, lo flojo primero");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
