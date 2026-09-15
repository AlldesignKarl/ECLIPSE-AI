/**
 * Correr todas las pruebas.
 *
 *   node pruebas/correr.mjs            todas
 *   node pruebas/correr.mjs ligeras    solo las que no abren navegador (~1 min)
 *   node pruebas/correr.mjs memoria    solo las que lleven "memoria" en el nombre
 *
 * Cada prueba es un programa suelto que se ejecuta con `node` y sale con 0 si
 * todo va bien. No hay framework a propósito: así una prueba se puede lanzar
 * sola para depurarla, y lo que falla se lee en cristiano.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const AQUI = new URL(".", import.meta.url).pathname;
const filtro = process.argv[2] ?? "";

/**
 * Las que levantan la aplicación o abren un navegador.
 *
 * Van aparte porque tardan entre 20 y 90 segundos cada una, mientras que las
 * demás tardan menos de dos. Al arreglar algo se corren las ligeras en bucle y
 * las pesadas una vez al final.
 */
const PESADAS = new Set([
  "ajustes-ui.test.mjs",
  "bienvenida-conexiones.test.mjs",
  "conexiones-api.test.mjs",
  "conexiones-ui.test.mjs",
  "convertir.test.mjs",
  "escritura.test.mjs",
  "foto.test.mjs",
  "grupos-ui.test.mjs",
  "grupos.test.mjs",
  "llamada-ui.test.mjs",
  "memoria.test.mjs",
  "programar-api.test.mjs",
  "programar-ui.test.mjs",
  "tema.test.mjs",
  "ubicacion.test.mjs",
]);

let ficheros = readdirSync(AQUI)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort();

if (filtro === "ligeras") ficheros = ficheros.filter((f) => !PESADAS.has(f));
else if (filtro === "pesadas") ficheros = ficheros.filter((f) => PESADAS.has(f));
else if (filtro) ficheros = ficheros.filter((f) => f.includes(filtro));

if (!ficheros.length) {
  console.error(`No hay ninguna prueba que se llame "${filtro}".`);
  process.exit(1);
}

console.log(`Corriendo ${ficheros.length} pruebas…\n`);

const fallidas = [];
const empezo = Date.now();

for (const fichero of ficheros) {
  const t = Date.now();
  const r = spawnSync("node", [`${AQUI}${fichero}`], {
    encoding: "utf8",
    timeout: 400_000,
    // La aplicación de verdad se levanta desde la raíz del proyecto.
    cwd: `${AQUI}..`,
  });
  const segundos = ((Date.now() - t) / 1000).toFixed(1);

  if (r.status === 0) {
    console.log(`  ok    ${fichero}  (${segundos}s)`);
  } else {
    console.log(`  FALLA ${fichero}  (${segundos}s)`);
    // Solo el final: es donde está el resumen de lo que falló.
    const salida = `${r.stdout ?? ""}${r.stderr ?? ""}`.trimEnd().split("\n").slice(-18);
    console.log(salida.map((l) => `        ${l}`).join("\n"));
    fallidas.push(fichero);
  }
}

const total = ((Date.now() - empezo) / 1000 / 60).toFixed(1);
console.log(
  fallidas.length
    ? `\n${fallidas.length} de ${ficheros.length} fallan (${total} min):\n- ${fallidas.join("\n- ")}`
    : `\nLas ${ficheros.length} pasan. (${total} min)`,
);
process.exit(fallidas.length ? 1 : 0);
