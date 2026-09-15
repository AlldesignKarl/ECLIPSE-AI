// Cortar al modelo cuando se engancha, sin cortar a quien repite por escribir.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { crearVigilanteDeBucle } = await jiti.import(enSrc("lib/bucle-roto.ts"));

const pasar = (texto, corte = 9) => {
  const v = crearVigilanteDeBucle();
  let cortadoEn = -1, leido = 0;
  for (let i = 0; i < texto.length; i += corte) {
    const t = texto.slice(i, i + corte);
    leido += t.length;
    if (v.trozo(t)) { cortadoEn = leido; break; }
  }
  return cortadoEn;
};

const enBucle = "Vale. " + "¿Qué forma de altar? ".repeat(30);
const listaLegitima = `Aquí tienes los pasos:
1. Instala las dependencias con npm install.
2. Arranca el servidor con npm run dev.
3. Abre el navegador en localhost:3000.
4. Edita el archivo index.html a tu gusto.
5. Vuelve a cargar la página para ver los cambios.`;
const codigoRepetitivo = Array.from({ length: 12 }, (_, i) => `  bloque.position.set(${i}, 0, ${i * 2});`).join("\n");
const guiones = "Separador:\n" + "-".repeat(120) + "\nY sigue el texto normal.";
const normal = "Esta foto es de Londres. Muestra el distrito financiero, con el 20 Fenchurch Street y el Leadenhall Building, dos rascacielos muy característicos de la City.";

const casos = [
  ["modelo en bucle", enBucle, true],
  ["lista de pasos", listaLegitima, false],
  ["código repetitivo", codigoRepetitivo, false],
  ["línea de guiones", guiones, false],
  ["respuesta normal", normal, false],
];

const fallos = [];
for (const [nombre, texto, deberiaCortar] of casos) {
  for (const corte of [1, 9, 40, 5000]) {
    const en = pasar(texto, corte);
    const corto = en !== -1;
    if (corto !== deberiaCortar)
      fallos.push(`${nombre} (trozos de ${corte}): ${corto ? "cortó" : "no cortó"} y debía ${deberiaCortar ? "cortar" : "no cortar"}`);
  }
  const en = pasar(texto);
  console.log(`  ${(pasar(texto) !== -1) === deberiaCortar ? "✓" : "✗"} ${nombre.padEnd(20)} ${en === -1 ? "sigue entero" : `cortado en el carácter ${en} de ${texto.length}`}`);
}

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
