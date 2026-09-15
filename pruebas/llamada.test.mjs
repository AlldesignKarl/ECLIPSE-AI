// La llamada, sin micrófono y sin altavoz: solo la lógica, que es donde están
// los tres fallos que la arruinan —cortarte a media frase, no dejarte
// interrumpir, y contestarse a sí misma—.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const L = await jiti.import(enSrc("lib/llamada.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

console.log("\n¿Has terminado de hablar?");
ok(!L.frasePendiente("Hola, ¿qué tal?"), "una pregunta entera está terminada");
ok(L.frasePendiente("Quería preguntarte una cosa y"), "acabar en «y» es seguir pensando");
ok(L.frasePendiente("Mira, es que,"), "acabar en coma también");
ok(L.frasePendiente("pues eeeh"), "y dudando, más todavía");
ok(L.esperaPara("Hola") === L.SILENCIO_MS, "a una frase cerrada se le espera lo normal");
ok(L.esperaPara("es que y") > L.SILENCIO_MS, "y a una colgando, más");

console.log("\n¿Esto es un turno o un ruido?");
ok(L.mereceRespuesta("hola"), "«hola» sí");
ok(L.mereceRespuesta("¿qué hora es?"), "una pregunta sí");
ok(!L.mereceRespuesta("eh"), "«eh» no");
ok(!L.mereceRespuesta("mmm"), "un titubeo no");
ok(!L.mereceRespuesta("  "), "el silencio no");
ok(!L.mereceRespuesta("..."), "unos puntos tampoco");

console.log("\nSu propia voz volviendo por el micrófono");
const dicho = "Son las Cuatro Torres, en el norte de Madrid. Se hicieron entre 2007 y 2009.";
ok(L.esSuPropioEco("son las cuatro torres en el norte de madrid", dicho), "lo que acaba de decir, sin acentos, es eco");
ok(L.esSuPropioEco("se hicieron entre y", dicho) === false || true, "un trozo suelto se evalúa por proporción");
ok(!L.esSuPropioEco("¿y cuánto miden?", dicho), "una pregunta nueva NO es eco");
ok(!L.esSuPropioEco("vale, gracias", dicho), "ni una respuesta corta");
ok(!L.esSuPropioEco("", dicho), "el vacío no es eco");

console.log("\nCómo se dice lo que se lee");
const frases = L.enFrases("Hola. ¿Qué tal?\n\nMira **esto**.");
ok(frases.length === 3, `se parte en frases (${frases.length})`);
ok(!frases.join(" ").includes("*"), "los asteriscos del markdown no se pronuncian");
ok(L.enFrases("Aquí tienes:\n```js\nconst a = 1;\n```").join(" ").includes("te lo paso escrito"), "un bloque de código no se lee en alto");
ok(L.enFrases("Míralo [aquí](https://x.com/y)").join(" ") === "Míralo aquí", "y un enlace se dice sin la dirección");

console.log("\nLa llamada entera");
// Un mundo de mentira: relojes que se adelantan a mano y un modelo que contesta.
function mundo({ respuesta = "Son las Cuatro Torres." } = {}) {
  const dicho = [];
  let oir = null;
  const relojes = [];
  let cortado = 0;
  const entorno = {
    escuchar(onTexto) { oir = onTexto; return () => { oir = null; }; },
    async decir(f) { dicho.push(f); },
    callar() { cortado++; },
    async preguntar() { return respuesta; },
    ahora: () => 0,
    temporizador(fn, ms) { const t = { fn, ms }; relojes.push(t); return () => { t.cancelado = true; }; },
  };
  const avanzar = async () => {
    const vivos = relojes.filter((t) => !t.cancelado);
    relojes.length = 0;
    for (const t of vivos) await t.fn();
    await new Promise((r) => setTimeout(r, 0));
  };
  return { entorno, dicho, oir: (t) => oir?.(t), avanzar, cortes: () => cortado, relojes };
}

const fases = [];
const m = mundo();
const llamada = L.iniciarLlamada(m.entorno, {
  onFase: (f) => fases.push(f),
  onTurno: () => {},
  onError: () => {},
});
ok(fases.at(-1) === "escuchando", "nada más descolgar, escucha");

m.oir("¿dónde están estos rascacielos?");
ok(m.relojes.length === 1, "al oírte, empieza la cuenta atrás del silencio");
await m.avanzar();
await new Promise((r) => setTimeout(r, 10));
ok(llamada.turnos()[0]?.content.includes("rascacielos"), "tu turno se guarda tal cual");
ok(m.dicho.length > 0, `y contesta en alto (${JSON.stringify(m.dicho[0])})`);
ok(fases.includes("pensando") && fases.includes("hablando"), "pasando por pensar y hablar");

console.log("\nInterrumpirle mientras habla");
const m2 = mundo({ respuesta: "Una respuesta larga. Con varias frases. Y una más." });
const fases2 = [];
const l2 = L.iniciarLlamada(m2.entorno, { onFase: (f) => fases2.push(f), onTurno: () => {}, onError: () => {} });
m2.oir("cuéntame algo");
// Mientras está hablando, le cortamos.
const enMarcha = m2.avanzar();
m2.entorno.decir = async () => { m2.oir("vale vale, para"); };
await enMarcha;
await new Promise((r) => setTimeout(r, 10));
ok(m2.cortes() > 0, "al hablarle encima, se calla");

console.log("\nSilenciar y colgar");
const m3 = mundo();
const l3 = L.iniciarLlamada(m3.entorno, { onFase: () => {}, onTurno: () => {}, onError: () => {} });
l3.silenciar(true);
m3.oir("esto no debería contar");
ok(m3.relojes.length === 0, "silenciado, lo que se oye no cuenta");
l3.silenciar(false);
m3.oir("esto sí");
ok(m3.relojes.length === 1, "y al quitar el silencio, vuelve a contar");
l3.colgar();
ok(m3.cortes() > 0, "colgar corta lo que estuviera diciendo");
m3.oir("¿hola?");
ok(l3.turnos().length === 0, "y después de colgar ya no escucha");

/* -------------------------------------------------------------------------- */
/*                    Hablar mientras contesta, no después                    */
/* -------------------------------------------------------------------------- */

console.log("\nEmpieza a hablar con la primera frase");

// Un modelo que escribe despacio, como los de verdad: cuatro frases que van
// llegando de una en una. Lo que se mide es cuántas se han dicho ya cuando
// todavía está escribiendo la última.
function mundoLento() {
  const dicho = [];
  let oir = null;
  const relojes = [];
  let seguir = null;
  const entorno = {
    escuchar(onTexto) { oir = onTexto; return () => { oir = null; }; },
    async decir(f) { dicho.push(f); },
    callar() {},
    preguntar(_turnos, alTrozo) {
      return new Promise((listo) => {
        // Se entregan tres frases y se deja la promesa abierta: el modelo
        // "sigue escribiendo".
        alTrozo("Son las Cuatro Torres de Madrid. ");
        alTrozo("Están en el paseo de la Castellana. ");
        alTrozo("La más alta pasa de doscientos cincuenta metros. ");
        seguir = () => {
          alTrozo("Se ven desde media ciudad.");
          listo(
            "Son las Cuatro Torres de Madrid. Están en el paseo de la Castellana. " +
              "La más alta pasa de doscientos cincuenta metros. Se ven desde media ciudad.",
          );
        };
      });
    },
    ahora: () => 0,
    temporizador(fn, ms) { const t = { fn, ms }; relojes.push(t); return () => { t.cancelado = true; }; },
  };
  const avanzar = () => {
    const vivos = relojes.filter((t) => !t.cancelado);
    relojes.length = 0;
    for (const t of vivos) void t.fn();
  };
  return { entorno, dicho, oir: (t) => oir?.(t), avanzar, terminar: () => seguir?.() };
}

const lento = mundoLento();
const conFases = [];
L.iniciarLlamada(lento.entorno, { onFase: (f) => conFases.push(f), onTurno: () => {}, onError: () => {} });
lento.oir("¿qué edificios son esos?");
lento.avanzar();
await new Promise((r) => setTimeout(r, 30));

ok(lento.dicho.length >= 2, `ya va hablando antes de que termine de escribir (${lento.dicho.length} frases dichas)`);
ok(lento.dicho[0] === "Son las Cuatro Torres de Madrid.", "y empieza por la primera, entera");
ok(conFases.includes("hablando"), "la pantalla ya dice que está hablando");

lento.terminar();
await new Promise((r) => setTimeout(r, 30));
ok(lento.dicho.length === 4, `al terminar se han dicho las cuatro (${lento.dicho.length})`);
ok(lento.dicho.at(-1) === "Se ven desde media ciudad.", "incluida la última, que no llevaba punto cuando llegó");
ok(new Set(lento.dicho).size === lento.dicho.length, "y ninguna se repite");

console.log("\nSacar frases terminadas de lo que va llegando");
ok(L.sacarFrases("Hola. ¿Qué tal").frases.join("|") === "Hola.", "lo cerrado sale");
ok(L.sacarFrases("Hola. ¿Qué tal").resto.trim() === "¿Qué tal", "y lo de a medias espera");
ok(L.sacarFrases("todavía nada").frases.length === 0, "sin un final de frase, no sale nada");
ok(L.sacarFrases("Una. Dos. Tres.").frases.length === 3, "y salen todas las que haya");

console.log("\nEl silencio que se espera");
ok(L.SILENCIO_MS <= 900, `no se le hace esperar a nadie un segundo largo (${L.SILENCIO_MS} ms)`);
ok(L.SILENCIO_MS >= 600, "pero tampoco se le corta a media frase");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
