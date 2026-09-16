/**
 * El anuncio entero, de un tirón.
 *
 *   node promo/src/todo.mjs            capturas + música + render + montaje
 *   node promo/src/todo.mjs --rapido   salta las capturas (necesita `next dev`)
 *
 * Las capturas necesitan la aplicación corriendo en http://127.0.0.1:3100
 * (`npx next dev -p 3100`). Lo demás no necesita ni red ni servidor.
 */
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const paso = (archivo) => {
  console.log(`\n── ${archivo} ──────────────────────────────`);
  execFileSync(process.execPath, [resolve(AQUI, archivo)], { stdio: "inherit" });
};

if (!process.argv.includes("--rapido")) {
  paso("apuntes.mjs");
  paso("capturar.mjs");
}
paso("musica.mjs");
paso("revisar.mjs");     // antes de renderizar: doce minutos no se tiran por un texto cortado
paso("renderizar.mjs");
paso("montar.mjs");
