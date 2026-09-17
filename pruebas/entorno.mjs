/**
 * Dónde está todo, calculado y no escrito a mano.
 *
 * Las pruebas vivían fuera del proyecto, en una carpeta temporal, y llevaban la
 * ruta del proyecto escrita a pelo (`/home/user/ECLIPSE-AI/...`). Eso funciona
 * exactamente en un ordenador: el que las escribió. Aquí se saca de dónde está
 * este archivo, así que el proyecto se puede mover, clonar o renombrar y las
 * pruebas siguen encontrándolo.
 */
import { existsSync, readdirSync } from "node:fs";

/** La raíz del proyecto, terminada en barra. */
export const RAIZ = new URL("..", import.meta.url).pathname;

export const JITI = `${RAIZ}node_modules/jiti/lib/jiti.mjs`;
export const SRC = `${RAIZ}src`;
export const PLAYWRIGHT = `${RAIZ}node_modules/playwright-core/index.mjs`;

/** Un trozo de `src`, para pasárselo a jiti. */
export const enSrc = (ruta) => `${SRC}/${ruta.replace(/^\/+/, "")}`;

/**
 * El Chromium que hay instalado, sin fijar la versión.
 *
 * La ruta llevaba el número de versión dentro (`chromium-1194`), así que el día
 * que el contenedor trae otra, todas las pruebas de navegador dejan de
 * arrancar por un motivo que no tiene nada que ver con lo que prueban. Se busca
 * el que haya.
 */
function rutaChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const candidatos = [];

  if (existsSync(base)) {
    for (const nombre of readdirSync(base)) {
      if (!nombre.startsWith("chromium")) continue;
      candidatos.push(`${base}/${nombre}/chrome-linux/chrome`);
      candidatos.push(`${base}/${nombre}/chrome-linux64/chrome`);
    }
    // El de siempre, por si el directorio no lleva versión.
    candidatos.push(`${base}/chromium/chrome-linux/chrome`);
    candidatos.push(`${base}/chromium`);
  }

  const encontrado = candidatos.find((c) => existsSync(c));
  if (encontrado) return encontrado;

  // Sin nada a mano se devuelve undefined: Playwright buscará el suyo, y si
  // tampoco lo tiene dirá él mismo qué falta, que se entiende mejor que un
  // "no existe el archivo" con una ruta rara.
  return undefined;
}

/**
 * Un jiti listo para importar TypeScript del proyecto.
 *
 * Las pruebas leen los módulos de `src` tal cual están, sin compilarlos a mano
 * ni mantener una copia: jiti los carga al vuelo. El alias `@` se pone aquí
 * para que no haya que repetirlo —ni equivocarse con él— en sesenta archivos.
 *
 * `moduleCache: false` cuando una prueba necesita releer un módulo con otras
 * variables de entorno puestas; sin eso, la segunda carga devuelve la primera.
 */
export async function crearJiti(desde, opciones = {}) {
  const { createJiti } = await import(JITI);
  return createJiti(desde, { alias: { "@": SRC }, ...opciones });
}

/**
 * Abre un Chromium listo para usar.
 *
 * Aquí y no en cada prueba porque son tres cosas que siempre van juntas —cargar
 * Playwright, encontrar el navegador y pasarle `--no-sandbox`— y repetirlas en
 * nueve archivos es repetir nueve veces el mismo fallo cuando cambie una.
 */
export async function abrirNavegador(opciones = {}) {
  const { chromium } = await import(PLAYWRIGHT);
  return chromium.launch({
    executablePath: rutaChromium(),
    args: ["--no-sandbox"],
    ...opciones,
  });
}

/** Un puerto libre de verdad. Con uno fijo, dos pruebas a la vez se pisan. */
export async function puertoLibre() {
  const { createServer } = await import("node:net");
  return new Promise((listo) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const puerto = s.address().port;
      s.close(() => listo(puerto));
    });
  });
}
