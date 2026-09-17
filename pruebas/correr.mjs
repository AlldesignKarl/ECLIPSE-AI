/**
 * Correr todas las pruebas.
 *
 *   node pruebas/correr.mjs            todas
 *   node pruebas/correr.mjs ligeras    solo las que no abren navegador
 *
 * Cada prueba es un programa suelto que se ejecuta con `node` y sale con 0 si
 * todo va bien. No hay framework a propósito: así una prueba se puede lanzar
 * sola para depurarla, y lo que falla se lee en cristiano.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const AQUI = new URL(".", import.meta.url).pathname;
const filtro = process.argv[2] ?? "";

/** La que levanta la web y abre un navegador: tarda medio minuto, va aparte. */
const PESADAS = new Set(["web-ui.test.mjs"]);

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
    // La web de verdad se levanta desde la raíz del proyecto.
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
