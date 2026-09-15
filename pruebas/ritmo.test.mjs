// El ritmo al que aparece la respuesta: que se note, que no se quede atrás, y
// que nunca haga esperar más de la cuenta.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { crearRitmo } = await jiti.import(enSrc("lib/ritmo.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

/**
 * Simula una respuesta: el motor escribe a `porSegundo` caracteres y la
 * pantalla se repinta a 60 por segundo. Devuelve cuánto tarda en verse entera.
 */
function simular({ largo, porSegundo, ajustes = {}, paraEn = Infinity }) {
  const FOTOGRAMA = 1000 / 60;
  let t = 0;
  const ritmo = crearRitmo(t, ajustes);
  let recibido = 0;
  let terminado = false;
  const muestras = [];

  for (let i = 0; i < 60 * 600; i++) {
    t += FOTOGRAMA;
    if (!terminado) {
      recibido = Math.min(largo, Math.round((t / 1000) * porSegundo));
      if (recibido >= largo || t / 1000 >= paraEn) terminado = true;
    }
    const antes = ritmo.visibles(t, recibido, terminado);
    muestras.push({ t, recibido, visto: antes });
    if (terminado && !ritmo.pendiente(recibido)) break;
  }

  const ultima = muestras.at(-1);
  const llegada = muestras.find((m) => m.recibido >= largo)?.t ?? Infinity;
  return {
    segundos: ultima.t / 1000,
    visto: ultima.visto,
    recibido: ultima.recibido,
    // Cuánto se esperó DESPUÉS de que el motor terminara.
    colaSegundos: (ultima.t - llegada) / 1000,
    muestras,
  };
}

console.log("\nUna respuesta corta");
const corta = simular({ largo: 180, porSegundo: 10000 });
ok(corta.visto === 180, "se enseña entera");
ok(corta.segundos > 0.6, `no aparece de golpe: tarda ${corta.segundos.toFixed(2)}s`);
ok(corta.segundos < 2.5, "pero tampoco se hace de rogar");

console.log("\nUna respuesta normal, con un motor rápido");
// 1.800 caracteres que el motor suelta a 600 por segundo: 3s de llegada.
const normal = simular({ largo: 1800, porSegundo: 600 });
ok(normal.visto === 1800, "se enseña entera");
ok(normal.segundos > 4, `se lee mientras se escribe: ${normal.segundos.toFixed(1)}s para 1.800 caracteres`);
ok(normal.colaSegundos < 3, `y al acabar el motor, termina rápido (${normal.colaSegundos.toFixed(1)}s)`);

// Que de verdad vaya más despacio que el motor, que es de lo que se trata.
const mitad = normal.muestras.find((m) => m.recibido >= 900);
ok(mitad.visto < mitad.recibido, `va por detrás del motor a propósito (visto ${mitad.visto} de ${mitad.recibido})`);

console.log("\nUn borbotón: todo el párrafo de una vez");
const golpe = simular({ largo: 1200, porSegundo: 1000000 });
ok(golpe.segundos > 1, `no lo pinta de golpe (${golpe.segundos.toFixed(1)}s)`);
ok(golpe.segundos < 4, "pero lo vacía en un tiempo razonable");

console.log("\nUn archivo largo de ECLIPSE CODE");
const codigo = simular({ largo: 14000, porSegundo: 900, ajustes: { techo: 900, techoFinal: 6000 } });
ok(codigo.visto === 14000, "se enseña entero");
ok(codigo.colaSegundos < 4, `no deja esperando al final (${codigo.colaSegundos.toFixed(1)}s de cola)`);

console.log("\nNunca retrocede ni se salta nada");
let anterior = -1;
let retrocede = false;
for (const m of normal.muestras) { if (m.visto < anterior) retrocede = true; anterior = m.visto; }
ok(!retrocede, "lo enseñado, enseñado está");
ok(normal.muestras.every((m) => m.visto <= m.recibido), "y nunca enseña algo que no ha llegado");

console.log("\nCasos raros");
const r = crearRitmo(1000);
ok(r.visibles(1000, 500) === 0, "en el mismo milisegundo todavía no hay nada que enseñar");
ok(r.visibles(500, 500) === 0, "un reloj que va hacia atrás no rompe nada");
ok(r.visibles(2000, 500) > 0, "y después sigue avanzando");
const vacio = crearRitmo(0);
ok(vacio.visibles(1000, 0) === 0 && !vacio.pendiente(0), "sin texto, nada pendiente");
const parado = crearRitmo(0);
parado.visibles(100, 5000);
parado.todo(5000);
ok(!parado.pendiente(5000), "al parar, se enseña todo de golpe");

// Con la pestaña en segundo plano los fotogramas se espacian muchísimo.
const dormido = crearRitmo(0);
dormido.visibles(16, 3000);
const trasVolver = dormido.visibles(30000, 3000, true);
ok(trasVolver === 3000, `al volver de segundo plano se pone al día (${trasVolver} de 3000)`);

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
