// Lo que el modelo se deja escapar no debe llegar a la pantalla.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { crearSeparador } = await jiti.import(enSrc("lib/pensamiento.ts"));

// Se parte en trozos de tamaño raro, como llega de verdad por la red.
const pasar = (texto, corte = 7) => {
  const s = crearSeparador();
  let visible = "", oculto = "";
  for (let i = 0; i < texto.length; i += corte) {
    const r = s.trozo(texto.slice(i, i + corte));
    visible += r.texto; oculto += r.pensando;
  }
  const f = s.cerrar();
  return { visible: visible + f.texto, oculto: oculto + f.pensando };
};

const casos = [
  ["deliberación", "<think>vale, en inglés</think>Los rascacielos son de Madrid.", "Los rascacielos son de Madrid."],
  ["llamada suelta", '<tool_code> search.query("Spain net worth") </tool_code>Son las Cuatro Torres, en Madrid.', "Son las Cuatro Torres, en Madrid."],
  ["sin cerrar", 'Un momento. <tool_code> search.query("algo")', "Un momento. "],
  ["dos seguidos", "<think>a</think>Hola <tool_call>x()</tool_call>y adiós.", "Hola y adiós."],
  ["nada que quitar", "Son las Cuatro Torres de Madrid, España.", "Son las Cuatro Torres de Madrid, España."],
  ["etiqueta que no es suya", "Usa <div> para el contenedor.", "Usa <div> para el contenedor."],
];

const fallos = [];
for (const [nombre, entrada, esperado] of casos) {
  for (const corte of [1, 3, 7, 500]) {
    const { visible } = pasar(entrada, corte);
    if (visible !== esperado)
      fallos.push(`${nombre} (trozos de ${corte}): salió ${JSON.stringify(visible)} y esperaba ${JSON.stringify(esperado)}`);
  }
  console.log(`${nombre.padEnd(22)} → ${JSON.stringify(pasar(entrada).visible)}`);
}

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
