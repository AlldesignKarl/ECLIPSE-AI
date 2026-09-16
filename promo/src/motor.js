/*
  EL MOTOR DEL ANUNCIO
  ===========================================================================
  Una sola función, `pintar(t)`, que deja el lienzo exactamente como tiene que
  verse en el segundo `t`. Nada de animaciones de CSS ni de requestAnimationFrame.

  Es la decisión que sostiene todo lo demás: el vídeo se graba fotograma a
  fotograma desde fuera, y una animación de CSS avanza con el reloj del
  navegador, no con el del vídeo. Con el reloj del navegador, cada captura pilla
  la animación donde le apetece y el resultado sale a tirones. Con `pintar(t)`,
  el fotograma 431 es siempre idéntico: se puede volver a renderizar, comparar y
  corregir.

  Aquí no hay textos ni tiempos. Están en `guion.js`.
*/
import { FIN, PANTALLAS, PAPELES, T, TEXTOS } from "./guion.js";

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------- Utilidades */

/** Progreso de 0 a 1 dentro de un tramo del guion, recortado a los extremos. */
const tramo = (t, [a, b]) => Math.max(0, Math.min(1, (t - a) / (b - a)));

/** Entra y sale: 0 fuera del tramo, 1 en el centro, con los bordes suavizados. */
function pico(t, a, b, entrada = 0.34, salida = 0.34) {
  if (t <= a || t >= b) return 0;
  const d = b - a;
  const p = (t - a) / d;
  const e = entrada / d;
  const s = salida / d;
  if (p < e) return suaveSal(p / e);
  if (p > 1 - s) return suaveEnt((1 - p) / s);
  return 1;
}

const mezcla = (a, b, p) => a + (b - a) * p;

/*
  Las curvas. Todo movimiento de este anuncio usa una de estas cuatro, y esa es
  la diferencia entre "se mueve" y "está bien hecho": nada arranca ni para de
  golpe, y lo que entra frena al llegar en vez de clavarse.
*/
const suaveSal = (p) => 1 - Math.pow(1 - p, 3);                       // frena al llegar
const suaveEnt = (p) => p * p * p;                                     // arranca despacio
const expoSal = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));        // frenazo largo, muy cinematográfico
const suaveAmbos = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/** Generador de números repetibles: la misma semilla, el mismo anuncio. */
function semilla(s) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pone opacidad y transformación de una vez: es lo que se hace 40 veces por fotograma. */
function pon(el, { o = 1, x = 0, y = 0, s = 1, r = 0, ry = 0, rx = 0, desenfoque = 0, extra = "" }) {
  el.style.opacity = String(o);
  el.style.transform =
    `translate3d(${x}px,${y}px,0)` +
    (ry ? ` rotateY(${ry}deg)` : "") +
    (rx ? ` rotateX(${rx}deg)` : "") +
    (r ? ` rotate(${r}deg)` : "") +
    (s !== 1 ? ` scale(${s})` : "") +
    (extra ? " " + extra : "");
  el.style.filter = desenfoque > 0.01 ? `blur(${desenfoque}px)` : "none";
}

/* --------------------------------------------------------------- Montaje */

const lienzo = { ancho: 1080, alto: 1920 };

/* Las pantallas del móvil: una imagen por paso, apiladas y apagadas. */
const CRISTAL = { ancho: 560, alto: 1212 };
const pantallas = {};
{
  const caja = $("pantallas");
  for (const [paso, def] of Object.entries(PANTALLAS)) {
    const d = document.createElement("div");
    d.className = "pantalla";
    const img = document.createElement("img");
    img.src = `../capturas/${def.imagen}.png`;
    img.style.height = `${CRISTAL.alto}px`;
    d.appendChild(img);
    caja.appendChild(d);
    pantallas[paso] = { caja: d, img, def };
  }
}

/**
 * Dónde tiene que estar el centro del móvil para que el punto `y` de su
 * pantalla caiga donde toca mirarlo.
 *
 * Con la cámara lejos (zoom 1) el teléfono se ve entero y se centra en el
 * cuadro. Con la cámara cerca el teléfono se sale por arriba, y entonces el
 * punto de interés se ancla un poco por debajo del centro: es donde cae la
 * vista y donde deja sitio arriba para el rótulo.
 */
function alturaDelMovil(zoom, y) {
  const ancla = mezcla(1000, 1080, Math.max(0, Math.min(1, (zoom - 1) / 0.5)));
  return ancla - (y - 0.5) * CRISTAL.alto * zoom - 960;
}

/* Los papeles de la escena del problema: tres fotos repetidas con distinta
   suerte cada una. Nueve, que es cuando deja de ser "unos apuntes" y pasa a ser
   "demasiado". */
const papeles = [];
{
  const caja = $("papeles");
  const azar = semilla(7);
  for (let i = 0; i < 9; i++) {
    const d = document.createElement("div");
    d.className = "papel";
    const img = document.createElement("img");
    img.src = `../material/${PAPELES[i % PAPELES.length]}.png`;
    d.appendChild(img);
    caja.appendChild(d);
    papeles.push({
      el: d,
      // Dónde acaba cada uno. Repartidos, pero sin simetría: una cuadrícula de
      // papeles no parece un montón de apuntes, parece un catálogo.
      x: mezcla(-250, 250, azar()) + (i % 2 ? 26 : -26),
      y: mezcla(-300, 330, azar()),
      giro: mezcla(-17, 17, azar()),
      escala: mezcla(0.82, 1.24, azar()),
      retraso: i * 0.085 + azar() * 0.05,
      desde: mezcla(-1, 1, azar()),
    });
  }
}

/* Las partículas: polvo en el haz de luz. Muy pocas y muy tenues; en cuanto se
   ven, dejan de ser cine y pasan a ser un salvapantallas. */
const lapiz = $("particulas").getContext("2d");
const polvo = [];
{
  const azar = semilla(24);
  for (let i = 0; i < 64; i++) {
    polvo.push({
      x: azar() * lienzo.ancho,
      y: azar() * lienzo.alto,
      r: mezcla(0.9, 2.6, azar()),
      v: mezcla(4, 17, azar()),
      fase: azar() * Math.PI * 2,
      bal: mezcla(10, 46, azar()),
      alfa: mezcla(0.1, 0.5, azar()),
    });
  }
}

/* El grano de película. Diez fotogramas de ruido hechos una vez y turnándose:
   generarlo en cada fotograma cuesta más que todo lo demás junto. */
const granoCtx = $("grano").getContext("2d");
const granos = [];
{
  const azar = semilla(99);
  for (let g = 0; g < 10; g++) {
    const d = granoCtx.createImageData(540, 960);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 110 + azar() * 90;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    granos.push(d);
  }
}

/* ------------------------------------------------------------ Los textos */
$("frase1").textContent = TEXTOS.frase1;
$("frase2").textContent = TEXTOS.frase2;
$("fraseHero").textContent = TEXTOS.hero;
$("heroPie").textContent = TEXTOS.heroPie;
$("nombre").textContent = TEXTOS.nombre;
$("cierreFrase").textContent = TEXTOS.cierre;
$("url").textContent = TEXTOS.url;

/* ----------------------------------------------------------- Dibujar todo */

/** Apaga lo que no toca. Empezar cada fotograma de cero evita que una escena
    se deje encendido algo de la anterior, que es el fallo típico de esto. */
function limpiar() {
  for (const id of ["frase1", "frase2", "fraseHero", "heroPie", "nombre", "cierreFrase", "paso"])
    $(id).style.opacity = "0";
  $("urlCaja").style.opacity = "0";
  $("chispa").style.opacity = "0";
  $("marca").style.opacity = "0";
  $("telefono").style.opacity = "0";
  $("aura").style.opacity = "0";
  $("escaner").style.opacity = "0";
  $("velo").style.opacity = "0";
  $("rejilla").style.opacity = "0";
  $("veloTitular").style.opacity = "0";
  $("corte").style.opacity = "0";
  for (const p of Object.values(pantallas)) p.caja.style.opacity = "0";
  for (const p of papeles) p.el.style.opacity = "0";
}

/** El eclipse, con sus tres luces y su anillo. `dibujo` de 0 a 1 lo va trazando. */
function marca({ tam, x = 0, y = 0, o = 1, dibujo = 1, luz = 1, llamarada = 1, desenfoque = 0, s = 1 }) {
  const m = $("marca");
  m.style.setProperty("--m", `${tam}px`);
  pon(m, { o, x, y, s, desenfoque });
  const anillo = $("anillo");
  anillo.setAttribute("transform", "rotate(-90 120 120)");
  if (dibujo >= 0.999) {
    /*
      Anillo entero: sin línea discontinua ninguna.

      Con `stroke-dasharray` puesto, el trazo tiene principio y final aunque se
      junten, y donde se juntan queda una costura de antialias. A tamaño de logo
      es un píxel y no se ve; en el plano hero el anillo mide novecientos y esa
      costura es una raya blanca en lo alto del eclipse.
    */
    anillo.removeAttribute("stroke-dasharray");
    anillo.removeAttribute("stroke-dashoffset");
  } else {
    anillo.setAttribute("stroke-dasharray", "100");
    anillo.setAttribute("stroke-dashoffset", String(100 - 100 * dibujo));
  }
  $("llamaradas").style.opacity = String(llamarada);
  $("llamaradas").style.transform = `scaleX(${mezcla(0.24, 1, llamarada)})`;
  $("llamaradas").style.transformOrigin = "120px 120px";
  m.querySelector(".bloom").style.opacity = String(luz);
  m.querySelector(".rim").style.opacity = String(luz * 0.92);
  m.querySelector(".franja").style.opacity = String(luz * llamarada);
}

/** Un texto que sube y aparece, o baja y se va. Es el movimiento de toda la pieza. */
function frase(id, t, [a, b], { arriba, entra = 0.62, sale = 0.42, subida = 34, salida = -22 } = {}) {
  const el = $(id);
  if (t < a - 0.02 || t > b + 0.02) return;
  const dentro = suaveSal(Math.max(0, Math.min(1, (t - a) / entra)));
  const fuera = suaveEnt(Math.max(0, Math.min(1, (t - (b - sale)) / sale)));
  const o = dentro * (1 - fuera);
  if (o <= 0.001) return;
  el.style.top = `${arriba}px`;
  pon(el, {
    o,
    y: mezcla(subida, 0, dentro) + mezcla(0, salida, fuera),
    s: mezcla(1.028, 1, dentro),
    desenfoque: mezcla(9, 0, dentro) + fuera * 5,
  });
}

/* ------------------------------------------------------- Las seis escenas */

function escenaHook(t) {
  // La chispa: una línea de luz que se abre a lo ancho y luego florece.
  const p = tramo(t, T.luz);
  if (p > 0 && t < T.anillo[1]) {
    const salir = tramo(t, [T.anillo[0] + 0.18, T.anillo[0] + 0.85]);
    pon($("chispa"), {
      o: Math.min(1, p * 5) * (1 - salir * 0.88),
      s: 1,
      extra: `scale(${mezcla(0.03, 1, expoSal(p))}, ${mezcla(0.02, 1, suaveSal(Math.max(0, p - 0.18) / 0.82))})`,
      y: -190,
    });
  }

  const a = tramo(t, T.anillo);
  // El eclipse se apaga cuando entran los apuntes. Volverá en la escena
  // siguiente para tragárselos, y esa vuelta solo tiene fuerza si antes se ha
  // ido: si se queda ahí de fondo, no vuelve nadie.
  const seVa = suaveEnt(tramo(t, [T.papeles[0] - 0.15, T.papeles[0] + 0.55]));
  if (a > 0 && seVa < 1) {
    const vivo = expoSal(a);
    marca({
      tam: 360,
      y: -190,
      o: Math.min(1, a * 3.2) * (1 - seVa),
      // El anillo se traza en el primer tercio: aparecer de golpe es un logo
      // pegado; trazarse es un logo que llega.
      dibujo: suaveSal(Math.min(1, a / 0.46)),
      luz: suaveSal(Math.min(1, Math.max(0, a - 0.12) / 0.6)),
      llamarada: suaveSal(Math.min(1, Math.max(0, a - 0.3) / 0.62)),
      s: mezcla(1.22, 1, vivo),
      desenfoque: mezcla(18, 0, suaveSal(Math.min(1, a / 0.5))),
    });
  }

  frase("nombre", t, [T.nombre[0], T.frase1[1] + 0.18], { arriba: 1046, subida: 22, sale: 0.32 });
  frase("frase1", t, [T.frase1[0], T.frase1[1] + 0.18], { arriba: 1168, sale: 0.34 });
}

function escenaProblema(t) {
  // La rejilla del fondo: da suelo a los papeles y desaparece con ellos.
  $("rejilla").style.opacity = String(
    0.55 * pico(t, T.papeles[0], T.tragar[1] - 0.15, 0.55, 0.5),
  );

  const tragado = tramo(t, T.tragar);
  for (let i = 0; i < papeles.length; i++) {
    const c = papeles[i];
    const a = T.papeles[0] + c.retraso;
    const p = suaveSal(Math.max(0, Math.min(1, (t - a) / 0.68)));
    if (p <= 0) continue;

    // Llegan de lejos, desenfocados y torcidos, y se posan.
    const x0 = c.desde * 760;
    const y0 = 900 + c.y * 0.4;
    const velocidad = 1 - p; // el desenfoque va con la velocidad, no con el reloj
    let x = mezcla(x0, c.x, p);
    let y = mezcla(y0, c.y, p);
    let s = mezcla(1.9, c.escala, p);
    let giro = mezcla(c.giro * 2.6, c.giro, p);
    let o = Math.min(1, p * 2.2);
    let desenfoque = velocidad * 16;

    if (tragado > 0) {
      // Y se los traga el centro: es la transición hacia ECLIPSE.
      const q = suaveAmbos(Math.min(1, tragado * 1.18 - i * 0.02));
      x = mezcla(x, 0, q);
      y = mezcla(y, 0, q);
      s = mezcla(s, 0.04, q);
      giro = mezcla(giro, giro + 26, q);
      o *= 1 - suaveEnt(Math.min(1, tragado * 1.25));
      desenfoque += q * 22;
    }

    pon(c.el, { o, x, y, s, r: giro, desenfoque });
  }

  frase("frase2", t, [T.frase2[0], T.frase2[1]], { arriba: 330, sale: 0.4 });

  // Mientras se los traga, el eclipse late detrás: es quien se los está comiendo.
  if (tragado > 0) {
    const q = suaveSal(tragado);
    marca({
      tam: 360,
      y: 0,
      o: Math.min(1, tragado * 2.4) * (1 - suaveEnt(Math.max(0, tragado - 0.6) / 0.4)),
      dibujo: 1,
      luz: mezcla(0.2, 1.5, q),
      llamarada: q,
      s: mezcla(0.5, 1.5, suaveEnt(tragado)),
      desenfoque: q * 6,
    });
  }
}

/*
  Cada beat del móvil.

  `pantalla` y `etiqueta` no son el mismo tramo a propósito: mientras ECLIPSE lee
  los apuntes, la etiqueta ya se ha ido pero la pantalla tiene que seguir ahí —es
  lo que se está escaneando—. Tenerlos separados es lo que evita el fotograma en
  negro en mitad del escaneo.
*/
const BEATS = [
  // La pantalla se enciende con el móvil, no con su etiqueta: si no, hay un
  // segundo de teléfono apagado justo cuando aparece, que es lo peor que puede
  // pasar en el plano en el que se presenta el producto.
  { paso: "paso1", pantalla: [T.telefono[0] - 0.05, T.escaneo[1] + 0.1], etiqueta: T.paso1 },
  { paso: "paso2", pantalla: T.paso2, etiqueta: T.paso2 },
  { paso: "paso3", pantalla: T.paso3, etiqueta: T.paso3 },
  { paso: "paso4", pantalla: T.paso4, etiqueta: T.paso4 },
  { paso: "paso5", pantalla: T.paso5, etiqueta: T.paso5 },
  { paso: "paso6", pantalla: T.paso6, etiqueta: T.paso6 },
  { paso: "paso7", pantalla: T.paso7, etiqueta: T.paso7 },
];
const ETIQUETA_ARRIBA = 244;

function escenaProducto(t) {
  const entrada = tramo(t, T.telefono);
  if (entrada <= 0) return;

  const hero = tramo(t, T.hero);
  const salida = tramo(t, [T.hero[1] - 0.55, T.hero[1]]);
  const e = expoSal(entrada);
  /*
    Cuánto se ha abierto ya el plano hero.

    Se completa en la primera mitad del tramo, no al final: lo que queda después
    es el plano sostenido, el móvil entero y quieto con el eclipse detrás. Al
    principio se abría durante los 3,7 segundos enteros y el resultado era que
    en el momento del rótulo el teléfono seguía ocupando el cuadro de arriba
    abajo, y la frase caía encima de la conversación.
  */
  const h = suaveAmbos(Math.min(1, hero / 0.5));

  // Las pantallas: la que toca encendida, y en el corte una se va mientras la
  // otra sube. Es la transición que usa la propia aplicación, no un fundido.
  for (const { paso, pantalla: [a, b] } of BEATS) {
    const p = pantallas[paso];
    if (!p) continue;
    const dentro = suaveSal(Math.max(0, Math.min(1, (t - a) / 0.34)));
    const fuera = suaveEnt(Math.max(0, Math.min(1, (t - (b - 0.26)) / 0.26)));
    const o = dentro * (1 - fuera);
    if (o <= 0.002) continue;
    p.caja.style.opacity = String(o);
    p.caja.style.transform = `translateY(${mezcla(40, 0, dentro) + fuera * -26}px) scale(${mezcla(1.03, 1, dentro)})`;
  }

  /*
    La cámara.

    Va aparte de las pantallas y es CONTINUA: siempre está en el encuadre de un
    paso, o cruzando del de uno al del siguiente. La primera versión la sacaba de
    la media de las pantallas encendidas, y tenía un fallo que no se ve mirando:
    justo en el corte, la que se iba ya estaba a cero y la que venía todavía
    también, así que durante un fotograma no había encuadre y el móvil daba un
    tirón de mil doscientos píxeles. Lo cazó `revisar.mjs`.

    El cruce dura 0,42 s y empieza antes del corte, así que cuando la pantalla
    cambia la cámara ya venía moviéndose. Por eso no parece un pase de
    diapositivas.
  */
  const CRUCE = 0.42;
  let cual = 0;
  while (cual + 1 < BEATS.length && t >= BEATS[cual + 1].pantalla[0]) cual++;
  const aqui = PANTALLAS[BEATS[cual].paso];
  const luego = PANTALLAS[BEATS[Math.min(cual + 1, BEATS.length - 1)].paso];
  const empieza = BEATS[cual].pantalla[0];
  const acaba = cual + 1 < BEATS.length ? BEATS[cual + 1].pantalla[0] : T.hero[0];

  // Dentro de cada paso la cámara sigue acercándose un poco. Es lo que hace que
  // una captura fija parezca rodada.
  const avance = suaveAmbos(Math.max(0, Math.min(1, (t - empieza) / Math.max(0.3, acaba - empieza))));
  const cruce = suaveAmbos(Math.max(0, Math.min(1, (t - (acaba - CRUCE)) / CRUCE)));
  let zoom = mezcla(aqui.zoom * (1 + avance * 0.035), luego.zoom, cruce);
  let mirada = mezcla(aqui.y, luego.y, cruce);

  /*
    El plano hero.

    La cámara se aleja y el móvil vuelve a verse entero, de frente, con el
    eclipse detrás. Es el respiro después de siete primeros planos: todo el
    anuncio ha ido cerrando, y aquí se abre.
  */
  if (hero > 0) {
    const entraHero = suaveSal(Math.min(1, hero / 0.26));
    const vaHero = suaveEnt(Math.max(0, Math.min(1, (t - (T.hero[1] - 0.5)) / 0.5)));
    const ph = pantallas.paso2;
    ph.caja.style.opacity = String(Math.max(Number(ph.caja.style.opacity || 0), entraHero * (1 - vaHero)));
    ph.caja.style.transform = "translateY(0px) scale(1)";
    zoom = mezcla(zoom, 0.86, h);
    mirada = mezcla(mirada, 0.5, h);
  }

  /*
    La cámara.

    Un móvil quieto en el centro es un catálogo. Uno que gira sin parar marea.
    Lo que queda es esto: entra ligeramente de canto y respira —un grado de
    giro, unos píxeles de subida— hasta que en el hero se pone de frente. El
    movimiento tiene un porqué: llegar a mirarlo de frente al final.
  */
  const respira = Math.sin((t - T.telefono[0]) * 0.55);
  const giroY = mezcla(mezcla(-14, -5.2, e) + respira * 1.2, 0, h);
  const giroX = mezcla(2.2 + respira * 0.6, 0, h);
  const escala = mezcla(0.93, 1, e) * zoom * mezcla(1, 1.05, salida);
  const y = alturaDelMovil(zoom, mirada) + mezcla(230, 0, e) + respira * 6;

  pon($("telefono"), {
    o: Math.min(1, entrada * 1.6) * (1 - suaveEnt(salida)),
    y,
    s: escala,
    ry: giroY,
    rx: giroX,
    desenfoque: mezcla(14, 0, e) + salida * 10,
  });

  // El velo del rótulo: solo cuando la cámara está cerca y el móvil llegaría a
  // taparlo.
  $("veloTitular").style.opacity = String(
    Math.max(0, Math.min(1, (zoom - 1.04) / 0.22)) * (1 - h) * Math.min(1, entrada * 2),
  );

  // El escáner: ECLIPSE leyendo los apuntes.
  const lee = tramo(t, T.escaneo);
  if (lee > 0 && lee < 1) {
    $("escaner").style.opacity = String(pico(t, T.escaneo[0], T.escaneo[1], 0.22, 0.3) * 0.95);
    $("escaner").style.top = `${mezcla(-260, CRISTAL.alto + 60, suaveAmbos(lee))}px`;
    $("velo").style.opacity = String(pico(t, T.escaneo[0], T.escaneo[1], 0.3, 0.35) * 0.28);
  }

  // Los cortes entre funciones: un destello de un fotograma y medio. Más que
  // eso es un efecto; esto es solo el parpadeo que tapa el salto.
  for (const { pantalla: [a] } of BEATS.slice(1)) {
    const d = 1 - Math.min(1, Math.abs(t - a) / 0.11);
    if (d > 0) $("corte").style.opacity = String(Math.max(Number($("corte").style.opacity || 0), d * 0.1));
  }

  for (const { paso, etiqueta: [a, b] } of BEATS) {
    frase("paso", t, [a + 0.16, b - 0.02], { arriba: ETIQUETA_ARRIBA, subida: 22, entra: 0.42, sale: 0.28 });
    if (t >= a + 0.14 && t <= b) $("paso").textContent = TEXTOS.pasos[paso];
  }

  if (hero > 0) {
    $("aura").style.opacity = String(h * (1 - suaveEnt(salida)) * 0.76);
    $("aura").style.transform = `scale(${mezcla(0.6, 1, expoSal(hero))})`;
    marca({
      tam: 1900,
      y: -20,
      o: h * (1 - suaveEnt(tramo(t, [T.hero[1] - 0.3, T.hero[1] + 0.35]))),
      dibujo: 1,
      luz: h * 0.75,
      llamarada: h,
      s: mezcla(0.82, 1, expoSal(hero)),
    });
    frase("fraseHero", t, [T.fraseHero[0], T.fraseHero[1] - 0.05], { arriba: 236, sale: 0.4 });
    frase("heroPie", t, [T.fraseHero[0] + 0.28, T.fraseHero[1] - 0.05], { arriba: 340, subida: 18, sale: 0.4 });
  }
}

function escenaCierre(t) {
  const c = tramo(t, [T.cierre[0], T.cierre[0] + 1.1]);
  if (c <= 0) return;
  const e = expoSal(c);

  /*
    El eclipse del cierre NO aparece: es el del plano hero, que se encoge hasta
    quedarse en el logo.

    Antes eran dos eclipses distintos dibujados sobre el mismo sitio, y en el
    segundo 23,95 uno se apagaba y el otro se encendía con otro tamaño: un
    parpadeo de dos fotogramas que no se ve mirando imágenes sueltas y que sí
    se ve en el vídeo. Lo cazó midiendo cuánto cambia cada fotograma respecto
    del anterior; era el único pico aislado de los 839.
  */
  const encoge = suaveAmbos(tramo(t, [T.cierre[0], T.cierre[0] + 1.2]));
  marca({
    tam: mezcla(1900, 300, encoge),
    y: mezcla(-20, -210, encoge),
    // Siempre entero. El cierre EMPIEZA antes de que acabe el hero a propósito
    // —se solapan 0,2 s—, así que este eclipse no tiene que aparecer: ya está
    // ahí. Cualquier cosa que no sea 1 mete un escalón justo en el segundo
    // 24,15, y ese escalón se ve.
    o: 1,
    dibujo: 1,
    luz: mezcla(0.75, 1, e),
    llamarada: 1,
    s: 1,
  });

  frase("nombre", t, [T.cierre[0] + 0.5, FIN + 0.5], { arriba: 1008, subida: 18, sale: 0.01 });
  frase("cierreFrase", t, [T.cierre[0] + 0.74, FIN + 0.5], { arriba: 1120, subida: 16, sale: 0.01 });

  const u = suaveSal(Math.max(0, Math.min(1, (t - T.url[0]) / 0.66)));
  if (u > 0) {
    const caja = $("urlCaja");
    caja.style.top = "1300px";
    pon(caja, { o: u, y: mezcla(20, 0, u), s: mezcla(0.96, 1, u) });
  }
}

/* ------------------------------------------------------------- El cuadro */

export function pintar(t) {
  limpiar();

  // El cielo se enciende cuando nace el eclipse y no antes: el anuncio empieza
  // en negro de verdad.
  $("cielo").style.opacity = String(
    Math.min(1, tramo(t, [T.anillo[0], T.anillo[0] + 1.2]) * 1.2) *
      mezcla(1, 0.55, tramo(t, [T.hero[0], T.hero[1]])),
  );

  escenaHook(t);
  escenaProblema(t);
  escenaProducto(t);
  escenaCierre(t);

  // El polvo. Solo cuando hay luz que lo ilumine.
  const brillo =
    0.55 * pico(t, T.anillo[0], T.frase1[1] + 0.4, 0.9, 0.5) +
    0.85 * pico(t, T.hero[0], FIN, 1.0, 0.0);
  lapiz.clearRect(0, 0, lienzo.ancho, lienzo.alto);
  if (brillo > 0.01) {
    for (const g of polvo) {
      const y = ((g.y - t * g.v) % (lienzo.alto + 200) + lienzo.alto + 200) % (lienzo.alto + 200) - 100;
      const x = g.x + Math.sin(t * 0.34 + g.fase) * g.bal;
      const a = g.alfa * brillo * (0.55 + 0.45 * Math.sin(t * 1.15 + g.fase));
      if (a <= 0.004) continue;
      const luz = lapiz.createRadialGradient(x, y, 0, x, y, g.r * 4.2);
      luz.addColorStop(0, `rgba(226,234,255,${a})`);
      luz.addColorStop(1, "rgba(226,234,255,0)");
      lapiz.fillStyle = luz;
      lapiz.beginPath();
      lapiz.arc(x, y, g.r * 4.2, 0, Math.PI * 2);
      lapiz.fill();
    }
  }

  // El grano, turnándose. Sin él la imagen es demasiado limpia y se le ve el
  // ordenador; con él parece rodada.
  granoCtx.putImageData(granos[Math.floor(t * 30) % granos.length], 0, 0);

  // Negro al empezar. Al final NO: esto se ve en bucle, y cerrar en negro
  // corta el bucle en seco.
  $("fundido").style.opacity = String(1 - Math.min(1, tramo(t, [0.0, 0.24])));
}

/* Lo que el grabador necesita desde fuera. */
window.pintar = pintar;
window.FIN = FIN;
window.listo = (async () => {
  await document.fonts.ready;
  await Promise.all(
    [...document.images].map((i) =>
      i.complete ? Promise.resolve() : new Promise((r) => { i.onload = i.onerror = r; }),
    ),
  );
  pintar(0);
  return true;
})();
