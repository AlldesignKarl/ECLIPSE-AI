/*
  LA BANDA SONORA
  ===========================================================================
  Sintetizada aquí, nota a nota, en lugar de bajada de ninguna parte. No es una
  floritura: una música de biblioteca tiene licencia, y una licencia mal leída
  es un anuncio retirado de TikTok o un canal con un aviso. Esto no tiene dueño
  fuera de este repositorio.

  Lo que suena, de menos a más:

  · un subgrave que sostiene todo el anuncio y le da cuerpo en un móvil;
  · un colchón de cuerdas sintéticas que va cambiando de acorde por escena;
  · un pulso que entra cuando aparece el producto y se calla en el plano hero
    —el silencio es el golpe más fuerte que hay—;
  · subidas de ruido antes de los dos momentos grandes;
  · y unas campanas sueltas en los tres sitios donde hace falta un brillo.

  Los tiempos están atados a los de `guion.js`: si allí se mueve una escena, la
  música se mueve con ella sin tocar nada de aquí.

    node promo/src/musica.mjs
*/
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FIN, T } from "./guion.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = resolve(AQUI, "..", ".audio");

const MUESTREO = 48000;
const COLA = 1.2; // la reverberación tiene que poder acabarse
const N = Math.round((FIN + COLA) * MUESTREO);

const izq = new Float32Array(N);
const der = new Float32Array(N);
const envioI = new Float32Array(N); // lo que va a la reverberación
const envioD = new Float32Array(N);

const TAU = Math.PI * 2;

/** Notas, por nombre, para no escribir frecuencias a pelo. */
const NOTA = {
  A1: 55, F1: 43.65, C2: 65.41, G1: 49,
  A2: 110, F2: 87.31, C3: 130.81, G2: 98,
  A3: 220, C4: 261.63, E4: 329.63, F3: 174.61, G3: 196, B3: 246.94, D4: 293.66,
  E5: 659.25, A4: 440, A5: 880, C5: 523.25,
};

/** Envolvente de toda la vida: ataque, caída, sostenido y suelta. */
function envolvente(p, dur, ata, caida, sost, suelta) {
  if (p < 0 || p > dur) return 0;
  if (p < ata) return p / ata;
  if (p < ata + caida) return 1 - (1 - sost) * ((p - ata) / caida);
  if (p < dur - suelta) return sost;
  return sost * Math.max(0, (dur - p) / suelta);
}

const ruido = (() => {
  // Ruido repetible: la misma banda sonora cada vez que se genera.
  let s = 12345;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x3fffffff) - 1;
  };
})();

function sumar(i, l, r, envio = 0) {
  if (i < 0 || i >= N) return;
  izq[i] += l;
  der[i] += r;
  envioI[i] += l * envio;
  envioD[i] += r * envio;
}

/* ---------------------------------------------------------------- Piezas */

/**
 * El colchón.
 *
 * Tres notas, cada una con cuatro armónicos que se van apagando, y las dos
 * orejas ligeramente desafinadas entre sí. Esa desafinación mínima es todo el
 * truco: sin ella el acorde suena a teclado, y con ella suena ancho.
 */
function colchon(t0, dur, notas, ganancia = 0.1) {
  const i0 = Math.round(t0 * MUESTREO);
  const n = Math.round(dur * MUESTREO);
  for (let i = 0; i < n; i++) {
    const p = i / MUESTREO;
    const env = envolvente(p, dur, dur * 0.34, 0.2, 0.86, dur * 0.42);
    if (env <= 0) continue;
    let l = 0;
    let r = 0;
    for (const f of notas) {
      for (let h = 1; h <= 4; h++) {
        const a = 1 / (h * h * 1.35);
        const fase = TAU * f * h * p;
        l += Math.sin(fase * 1.0015 + h) * a;
        r += Math.sin(fase * 0.9985 + h * 1.7) * a;
      }
    }
    const g = (env * ganancia) / notas.length;
    sumar(i0 + i, l * g, r * g, 0.55);
  }
}

/** El subgrave. Es lo que hace que esto se note en el altavoz de un móvil. */
function grave(t0, dur, f, ganancia = 0.3, desliz = 1) {
  const i0 = Math.round(t0 * MUESTREO);
  const n = Math.round(dur * MUESTREO);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const p = i / MUESTREO;
    const env = envolvente(p, dur, Math.min(0.12, dur * 0.2), 0.1, 0.9, dur * 0.45);
    const fr = f * Math.pow(desliz, p / dur);
    fase += (TAU * fr) / MUESTREO;
    const v = (Math.sin(fase) + Math.sin(fase * 2) * 0.12) * env * ganancia;
    sumar(i0 + i, v, v, 0.06);
  }
}

/**
 * El golpe.
 *
 * Un subgrave que cae de 70 a 28 hercios en un cuarto de segundo, con un
 * chasquido de ruido delante. Es el sonido de que algo ha llegado, y va
 * exactamente en los dos cortes que importan: cuando aparece el móvil y cuando
 * se abre el plano hero.
 */
function golpe(t0, ganancia = 1) {
  const i0 = Math.round(t0 * MUESTREO);
  const n = Math.round(1.6 * MUESTREO);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const p = i / MUESTREO;
    const fr = 28 + 46 * Math.exp(-p * 11);
    fase += (TAU * fr) / MUESTREO;
    const cuerpo = Math.sin(fase) * Math.exp(-p * 2.1) * 0.62;
    const chasquido = ruido() * Math.exp(-p * 38) * 0.14;
    const v = (cuerpo + chasquido) * ganancia;
    sumar(i0 + i, v, v, 0.22);
  }
}

/** La subida de ruido que anuncia un golpe. Sin ella el golpe llega sin avisar. */
function subida(t0, dur, ganancia = 0.16) {
  const i0 = Math.round(t0 * MUESTREO);
  const n = Math.round(dur * MUESTREO);
  let filtroI = 0;
  let filtroD = 0;
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const q = i / n;
    // El filtro se abre según sube: es lo que da la sensación de acercarse.
    const k = 0.012 + 0.34 * q * q;
    filtroI += k * (ruido() - filtroI);
    filtroD += k * (ruido() - filtroD);
    fase += (TAU * (180 + 900 * q * q)) / MUESTREO;
    const tono = Math.sin(fase) * 0.16 * q * q;
    const env = q * q * ganancia;
    sumar(i0 + i, (filtroI * 2.4 + tono) * env, (filtroD * 2.4 + tono) * env, 0.5);
  }
}

/** Un tic del pulso. Corto, agudo y en su sitio. */
function tic(t0, ganancia = 0.06, agudo = 1) {
  const i0 = Math.round(t0 * MUESTREO);
  const n = Math.round(0.09 * MUESTREO);
  let filtro = 0;
  for (let i = 0; i < n; i++) {
    const p = i / MUESTREO;
    filtro += 0.55 * (ruido() - filtro);
    const v = (ruido() - filtro) * Math.exp(-p * (120 / agudo)) * ganancia;
    sumar(i0 + i, v * 0.9, v, 0.35);
  }
}

/** El bombo del pulso: grave y seco, no una patada de discoteca. */
function pulso(t0, ganancia = 0.2) {
  const i0 = Math.round(t0 * MUESTREO);
  const n = Math.round(0.5 * MUESTREO);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const p = i / MUESTREO;
    fase += (TAU * (46 + 60 * Math.exp(-p * 26))) / MUESTREO;
    const v = Math.sin(fase) * Math.exp(-p * 7.5) * ganancia;
    sumar(i0 + i, v, v, 0.05);
  }
}

/** Una campana. Tres armónicos no enteros y una caída larga: brillo sin dulzura. */
function campana(t0, f, ganancia = 0.09, dur = 3.4) {
  const i0 = Math.round(t0 * MUESTREO);
  const n = Math.round(dur * MUESTREO);
  const parciales = [1, 2.01, 2.99, 4.21, 5.43];
  for (let i = 0; i < n; i++) {
    const p = i / MUESTREO;
    let v = 0;
    for (let k = 0; k < parciales.length; k++) {
      v += Math.sin(TAU * f * parciales[k] * p + k) * Math.exp(-p * (1.6 + k * 1.4)) / (k + 1.6);
    }
    const g = v * ganancia * Math.min(1, p * 320);
    sumar(i0 + i, g * 0.94, g, 0.85);
  }
}

/**
 * El aire.
 *
 * Una capa de ruido muy filtrado y muy bajita, debajo de todo. No se oye: se
 * nota cuando falta. Sin ella, entre acorde y acorde hay agujeros de silencio
 * y el anuncio parece que se corta.
 */
function aire(t0, dur, ganancia = 0.02) {
  const i0 = Math.round(t0 * MUESTREO);
  const n = Math.round(dur * MUESTREO);
  let a = 0;
  let b = 0;
  for (let i = 0; i < n; i++) {
    const p = i / MUESTREO;
    const env = envolvente(p, dur, 1.6, 0.4, 0.9, 2.2);
    a += 0.0016 * (ruido() - a);
    b += 0.0019 * (ruido() - b);
    const v = (a + b) * 60 * env * ganancia;
    sumar(i0 + i, v, -v * 0.92, 0.7);
  }
}

/* ------------------------------------------------------------ El arreglo */

aire(2.6, FIN - 2.6, 0.026);

// Los acordes, uno por escena. La menor casi todo, sol mayor para la tensión
// del final del repaso y do mayor en el hero: el único acorde alegre del
// anuncio va donde se enseña el producto entero.
const ACORDES = [
  [0.45, 3.4, [NOTA.A2, NOTA.A3, NOTA.E4], 0.055],
  [3.3, 3.9, [NOTA.A2, NOTA.C4, NOTA.E4], 0.085],
  [T.tragar[1] - 0.1, 3.7, [NOTA.F2, NOTA.F3, NOTA.C4], 0.1],
  [10.0, 4.4, [NOTA.A2, NOTA.C4, NOTA.E4], 0.1],
  [T.paso4[0], 3.4, [NOTA.F2, NOTA.A3, NOTA.C4], 0.1],
  [T.paso6[0], 3.4, [NOTA.G2, NOTA.B3, NOTA.D4], 0.1],
  [T.hero[0], 4.0, [NOTA.C3, NOTA.E4, NOTA.G3], 0.125],
  [T.cierre[0] - 0.2, 4.9, [NOTA.A2, NOTA.C4, NOTA.E4], 0.1],
];
for (const [t0, dur, notas, g] of ACORDES) colchon(t0, dur, notas, g);

// El subgrave, siguiendo la raíz del acorde.
grave(0.35, 3.4, NOTA.A1, 0.16);
grave(3.3, 3.8, NOTA.A1, 0.2);
grave(T.tragar[1] - 0.1, 3.7, NOTA.F1, 0.24);
grave(10.0, 4.4, NOTA.A1, 0.24);
grave(T.paso4[0], 3.4, NOTA.F1, 0.24);
grave(T.paso6[0], 3.4, NOTA.G1, 0.24);
grave(T.hero[0], 4.1, NOTA.C2, 0.26);
grave(T.cierre[0] - 0.2, 5.0, NOTA.A1, 0.18);

/*
  El pulso.

  El compás dura 1,6 segundos y está clavado en los cortes de la escena de las
  funciones: cada vez que cambia la pantalla, cae un compás. Por eso el montaje
  parece sincronizado con la música, y lo está.
*/
const COMPAS = 1.6;
const NEGRA = COMPAS / 4;
const primerCompas = T.paso4[0] - COMPAS * 4; // 7,75 s: justo después del golpe
for (let c = 0; primerCompas + c * COMPAS < T.hero[0] - 0.05; c++) {
  const inicio = primerCompas + c * COMPAS;
  const fuerza = Math.min(1, 0.55 + c * 0.07);
  pulso(inicio, 0.2 * fuerza);
  pulso(inicio + NEGRA * 2.5, 0.12 * fuerza);
  for (let n = 0; n < 4; n++) {
    tic(inicio + n * NEGRA, (n === 0 ? 0.075 : 0.042) * fuerza, n % 2 ? 1.25 : 1);
    if (c > 3) tic(inicio + n * NEGRA + NEGRA / 2, 0.022 * fuerza, 1.5);
  }
}

// Los dos momentos grandes: subida y golpe.
subida(T.tragar[0] - 0.3, T.tragar[1] - T.tragar[0] + 0.3, 0.17);
golpe(T.tragar[1] - 0.1, 0.95);

subida(T.hero[0] - 1.35, 1.35, 0.2);
golpe(T.hero[0], 1.0);

// Y el arranque, que también es un momento: la luz que se abre.
subida(0.0, 0.85, 0.1);
golpe(T.anillo[0], 0.45);

// Las campanas: el nombre, el hero y el cierre. Tres. Ni una más.
campana(T.nombre[0] + 0.05, NOTA.E5, 0.075);
campana(T.hero[0] + 0.02, NOTA.E5, 0.085, 4.2);
campana(T.hero[0] + 0.02, NOTA.A5, 0.05, 4.2);
campana(T.cierre[0] + 0.3, NOTA.A4, 0.07, 4.5);
campana(T.url[0], NOTA.C5, 0.045, 3.6);

/* --------------------------------------------------- La sala: reverberación */

/*
  Una reverberación de Schroeder: cuatro peines y dos pasa-todo.

  Es de 1962 y sigue siendo lo que hace que un sintetizador suene dentro de un
  sitio en vez de dentro de un ordenador. Sin esto, cada nota aparece y
  desaparece en seco, y en un anuncio eso se oye como barato.
*/
function reverberar(entrada, semillaDelay) {
  const salida = new Float32Array(N);
  const peines = [1557, 1617, 1491, 1422].map((d) => ({
    buf: new Float32Array(d + semillaDelay),
    i: 0,
    g: 0.805,
  }));
  const pasaTodo = [225, 556].map((d) => ({ buf: new Float32Array(d + semillaDelay), i: 0, g: 0.62 }));

  for (let n = 0; n < N; n++) {
    const x = entrada[n];
    let y = 0;
    for (const c of peines) {
      const v = c.buf[c.i];
      y += v;
      c.buf[c.i] = x + v * c.g;
      c.i = (c.i + 1) % c.buf.length;
    }
    y *= 0.25;
    for (const a of pasaTodo) {
      const v = a.buf[a.i];
      const s = y + v * a.g;
      y = v - a.g * s;
      a.buf[a.i] = s;
      a.i = (a.i + 1) % a.buf.length;
    }
    salida[n] = y;
  }
  return salida;
}

const salaI = reverberar(envioI, 0);
const salaD = reverberar(envioD, 23); // unas muestras de diferencia: así la sala tiene anchura

/* --------------------------------------------------------- Mezcla y salida */

let pico = 0;
for (let i = 0; i < N; i++) {
  izq[i] += salaI[i] * 0.33;
  der[i] += salaD[i] * 0.33;
  pico = Math.max(pico, Math.abs(izq[i]), Math.abs(der[i]));
}

// Normalizar a -1 dB y redondear los picos con una tangente hiperbólica: un
// limitador de pobre, pero limitador. Recortar a pelo suena a distorsión.
const ganancia = (0.89 / (pico || 1)) * 1.18;
const desvanece = (t) => {
  // Media décima de entrada y una cola de salida, para que no haya chasquido.
  const ent = Math.min(1, t / 0.08);
  // Se acaba con el vídeo, no después: si la música sigue sonando cuando ya no
  // hay imagen, la red social corta el audio a mitad de nota.
  const sal = Math.min(1, Math.max(0, (FIN - t) / 0.75));
  return ent * sal;
};

const pcm = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  const d = desvanece(i / MUESTREO);
  const l = Math.tanh(izq[i] * ganancia) * 0.97 * d;
  const r = Math.tanh(der[i] * ganancia) * 0.97 * d;
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l)) * 32767), i * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r)) * 32767), i * 4 + 2);
}

const cabecera = Buffer.alloc(44);
cabecera.write("RIFF", 0);
cabecera.writeUInt32LE(36 + pcm.length, 4);
cabecera.write("WAVE", 8);
cabecera.write("fmt ", 12);
cabecera.writeUInt32LE(16, 16);
cabecera.writeUInt16LE(1, 20);
cabecera.writeUInt16LE(2, 22);
cabecera.writeUInt32LE(MUESTREO, 24);
cabecera.writeUInt32LE(MUESTREO * 4, 28);
cabecera.writeUInt16LE(4, 32);
cabecera.writeUInt16LE(16, 34);
cabecera.write("data", 36);
cabecera.writeUInt32LE(pcm.length, 40);

mkdirSync(SALIDA, { recursive: true });
const destino = resolve(SALIDA, "banda.wav");
writeFileSync(destino, Buffer.concat([cabecera, pcm]));
console.log(`${(FIN + COLA).toFixed(1)} s de música en ${destino}`);
