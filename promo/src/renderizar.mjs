/**
 * El grabador: convierte `escena.html` en fotogramas.
 *
 * Abre el lienzo en un Chromium de 1080×1920, le dice a `pintar(t)` en qué
 * segundo está y fotografía. Uno detrás de otro, sin reloj de por medio: por eso
 * el resultado es idéntico cada vez que se vuelve a lanzar.
 *
 * Se graba al DOBLE de fotogramas de los que va a tener el vídeo, y el montaje
 * junta cada dos en uno. Eso es el desenfoque de movimiento de verdad —lo que
 * en cine es un obturador a 180°—, y es la diferencia entre un movimiento rápido
 * que se ve fluido y uno que salta.
 *
 *   node promo/src/renderizar.mjs             (entero)
 *   node promo/src/renderizar.mjs 0 3.5       (solo un trozo, para probar)
 */
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FIN } from "./guion.js";
import { FPS, SUBMUESTRAS } from "./ajustes.mjs";
import { abrirLienzo } from "./lienzo.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const FOTOGRAMAS = resolve(AQUI, "..", ".fotogramas");

const desde = Number(process.argv[2] ?? 0);
const hasta = Number(process.argv[3] ?? FIN);
const parcial = process.argv.length > 2;

const main = async () => {
  if (!parcial) rmSync(FOTOGRAMAS, { recursive: true, force: true });
  mkdirSync(FOTOGRAMAS, { recursive: true });

  const { pagina: p, cerrar } = await abrirLienzo();

  const total = Math.round((hasta - desde) * FPS * SUBMUESTRAS);
  const primero = Math.round(desde * FPS * SUBMUESTRAS);
  const arranque = Date.now();

  for (let i = 0; i < total; i++) {
    const n = primero + i;
    const t = n / (FPS * SUBMUESTRAS);
    await p.evaluate((seg) => window.pintar(seg), t);
    await p.screenshot({
      path: resolve(FOTOGRAMAS, String(n).padStart(6, "0") + ".png"),
      animations: "disabled",
    });
    if (i % 120 === 0 || i === total - 1) {
      const va = (Date.now() - arranque) / 1000;
      const queda = i ? (va / i) * (total - i) : 0;
      console.log(
        `  ${String(i + 1).padStart(5)}/${total}  ·  ${t.toFixed(2)} s  ·  quedan ${Math.round(queda)} s`,
      );
    }
  }

  await cerrar();
  console.log(`${readdirSync(FOTOGRAMAS).length} fotogramas en ${FOTOGRAMAS}`);
};

// Solo si se lanza a mano. Importarlo desde otro archivo no puede ponerse a
// renderizar —ni a borrar la carpeta de fotogramas—: eso ya pasó una vez.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
