/**
 * Mirar instantes sueltos del anuncio sin tener que renderizarlo entero.
 *
 * Es la herramienta con la que se ajusta esto: se cambia un tiempo en
 * `guion.js`, se ojean los cuatro segundos de alrededor y se ve si funciona.
 * Renderizar el vídeo entero para comprobar una frase son cinco minutos por
 * cada prueba.
 *
 *   node promo/src/ojear.mjs 2.9 6.2 11.3      → tres instantes
 *   node promo/src/ojear.mjs --tira 13 21 8    → ocho instantes repartidos
 */
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { abrirLienzo } from "./lienzo.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const OJEADAS = resolve(AQUI, "..", ".ojeadas");

let tiempos;
const args = process.argv.slice(2);
if (args[0] === "--tira") {
  const [a, b, n] = args.slice(1).map(Number);
  tiempos = Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
} else {
  tiempos = args.map(Number);
}
if (!tiempos.length) tiempos = [0.6, 2.9, 4.8, 8.0, 11.3, 15.0, 18.4, 22.0, 26.5];

const main = async () => {
  rmSync(OJEADAS, { recursive: true, force: true });
  mkdirSync(OJEADAS, { recursive: true });
  const { pagina, cerrar } = await abrirLienzo();
  for (const t of tiempos) {
    await pagina.evaluate((x) => window.pintar(x), t);
    await pagina.screenshot({ path: resolve(OJEADAS, `t${t.toFixed(2).replace(".", "_")}.png`) });
    console.log("·", t.toFixed(2), "s");
  }
  await cerrar();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
