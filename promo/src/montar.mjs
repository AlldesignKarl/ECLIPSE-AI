/*
  EL MONTAJE
  ===========================================================================
  Junta los fotogramas con la música y saca el archivo que se sube a TikTok,
  Reels y Shorts.

  Dos cosas que no son evidentes y que son las que hacen que se vea bien:

  · Los fotogramas están grabados a 60 y el vídeo va a 30. `tmix` promedia cada
    dos en uno, y eso es desenfoque de movimiento de verdad: el obturador a 180°
    de una cámara de cine. Sin él, una carta que cruza la pantalla en cuatro
    fotogramas se ve como cuatro cartas.
  · H.264 en perfil alto, yuv420p y `faststart`. Es lo único que reproducen
    todas las redes sin volver a comprimir de más; un formato más moderno se ve
    peor porque lo recomprimen ellas.

    node promo/src/montar.mjs
*/
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FIN } from "./guion.js";
import { FPS, SUBMUESTRAS } from "./ajustes.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..");
const FOTOGRAMAS = resolve(RAIZ, ".fotogramas");
const MUSICA = resolve(RAIZ, ".audio", "banda.wav");
const SALIDA = resolve(RAIZ, "salida");
const VIDEO = resolve(SALIDA, "eclipse-promo.mp4");
const PORTADA = resolve(SALIDA, "eclipse-promo-portada.jpg");

/**
 * Dónde está ffmpeg.
 *
 * Por orden: lo que diga la variable FFMPEG, el del sistema, o el binario del
 * paquete `ffmpeg-static` si alguien lo ha instalado. El que trae Playwright no
 * sirve: está recortado a WebM y no sabe hacer H.264, que es lo único que
 * aceptan bien las redes.
 */
async function buscarFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  for (const c of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/opt/homebrew/bin/ffmpeg"])
    if (existsSync(c)) return c;
  try {
    const m = await import("ffmpeg-static");
    if (m.default) return m.default;
  } catch {
    /* no está instalado: se intenta el del PATH */
  }
  return "ffmpeg";
}
const FFMPEG = await buscarFfmpeg();

const correr = (args) => execFileSync(FFMPEG, args, { stdio: ["ignore", "inherit", "inherit"] });

const esperados = Math.round(FIN * FPS * SUBMUESTRAS);
const hay = existsSync(FOTOGRAMAS) ? readdirSync(FOTOGRAMAS).filter((f) => f.endsWith(".png")).length : 0;
if (hay < esperados)
  throw new Error(`Faltan fotogramas: hay ${hay} y hacen falta ${esperados}. Lanza renderizar.mjs.`);
if (!existsSync(MUSICA)) throw new Error("Falta la música. Lanza musica.mjs.");

mkdirSync(SALIDA, { recursive: true });

correr([
  "-y", "-hide_banner", "-loglevel", "error", "-stats",
  "-framerate", String(FPS * SUBMUESTRAS),
  "-start_number", "0",
  "-i", resolve(FOTOGRAMAS, "%06d.png"),
  "-i", MUSICA,
  "-filter_complex",
  `[0:v]tmix=frames=${SUBMUESTRAS}:weights='${Array(SUBMUESTRAS).fill(1).join(" ")}',` +
    `framestep=${SUBMUESTRAS},format=yuv420p[v]`,
  "-map", "[v]", "-map", "1:a",
  "-r", String(FPS),
  "-t", String(FIN),
  "-c:v", "libx264",
  "-preset", "slow",
  // 16 y no 20: el anuncio es casi todo negro con degradados, y ahí es donde
  // primero se ven las bandas. Además las redes vuelven a comprimir lo que se
  // les sube, así que darles un archivo justo de bits es empezar perdiendo.
  "-crf", "16",
  "-profile:v", "high", "-level", "4.2",
  // Un fotograma clave cada segundo: las redes cortan y recomprimen, y con
  // claves lejos, el primer segundo de la copia que ellas generan sale sucio.
  "-x264-params", "keyint=30:min-keyint=15:scenecut=0:aq-mode=3",
  "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
  "-movflags", "+faststart",
  VIDEO,
]);

// La portada: el plano hero, que es el fotograma que mejor cuenta de qué va.
correr([
  "-y", "-hide_banner", "-loglevel", "error",
  "-i", VIDEO, "-ss", "22.6", "-frames:v", "1", "-q:v", "2", PORTADA,
]);

const mb = (p) => (statSync(p).size / 1024 / 1024).toFixed(1);
console.log(`\nVídeo:   ${VIDEO}  (${mb(VIDEO)} MB)`);
console.log(`Portada: ${PORTADA}  (${mb(PORTADA)} MB)`);
