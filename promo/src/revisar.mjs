/*
  EL REVISOR
  ===========================================================================
  Recorre el anuncio entero y comprueba, fotograma a fotograma, las cosas que
  no se pueden mirar a ojo en 840 imágenes:

  1. Que ningún texto se salga del cuadro ni se corte.
  2. Que ningún texto invada la zona donde TikTok, Reels y Shorts pintan sus
     propios botones y su descripción: lo que caiga ahí, no se lee.
  3. Que no haya un fotograma en el que no pasa nada —negro con todo apagado—
     en mitad del anuncio.
  4. Que el móvil no dé saltos: se mide cuánto se mueve de un fotograma al
     siguiente y se avisa si alguno se sale de lo que ya hace la escena.

  Falla con código 1 si encuentra algo. Se lanza solo, y conviene lanzarlo
  después de cambiar cualquier tiempo o cualquier frase.

    node promo/src/revisar.mjs
*/
import { FIN } from "./guion.js";
import { FPS, SUBMUESTRAS } from "./ajustes.mjs";
import { abrirLienzo } from "./lienzo.mjs";

/* El cuadro, y lo que dentro del cuadro no sirve.
   Arriba se van unos 200 píxeles por el nombre de la cuenta; abajo, unos 380
   por la descripción y los botones; a la derecha, unos 150 por la columna de
   corazones. Un rótulo ahí existe y no se lee. */
const CUADRO = { ancho: 1080, alto: 1920 };
const SEGURO = { arriba: 205, abajo: 1545, izquierda: 24, derecha: 1056 };

const TEXTOS = ["frase1", "frase2", "fraseHero", "heroPie", "nombre", "cierreFrase", "urlCaja", "paso"];

const main = async () => {
  const { pagina, cerrar } = await abrirLienzo();
  const quejas = [];
  const avisos = [];

  const total = Math.round(FIN * FPS * SUBMUESTRAS);
  let anterior = null;
  const saltos = [];

  for (let n = 0; n < total; n++) {
    const t = n / (FPS * SUBMUESTRAS);
    const medida = await pagina.evaluate(
      ([seg, ids]) => {
        window.pintar(seg);
        const salida = { t: seg, textos: [], luz: 0, movil: null };

        for (const id of ids) {
          const el = document.getElementById(id);
          if (!el) continue;
          const o = Number(getComputedStyle(el).opacity);
          if (o < 0.06) continue;
          const r = el.getBoundingClientRect();
          // Dónde está la letra de verdad, no la caja: la caja mide 960 de
          // ancho siempre y el texto va centrado dentro.
          const rango = document.createRange();
          rango.selectNodeContents(el);
          const letra = rango.getBoundingClientRect();
          rango.detach?.();
          salida.textos.push({
            id,
            o,
            caja: { x: r.left, y: r.top, x2: r.right, y2: r.bottom },
            letra: { x: letra.left, y: letra.top, x2: letra.right, y2: letra.bottom },
            desborda: el.scrollWidth > el.clientWidth + 1,
          });
        }

        const tel = document.getElementById("telefono");
        if (Number(getComputedStyle(tel).opacity) > 0.05) {
          const r = tel.getBoundingClientRect();
          salida.movil = { cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, alto: r.height };
        }

        // Cuánta luz hay en el cuadro, a ojo: la suma de opacidades de lo que
        // debería verse. Sirve para cazar un fotograma vacío.
        for (const id of ["marca", "telefono", "papeles", ...ids]) {
          const el = document.getElementById(id);
          if (el) salida.luz += Number(getComputedStyle(el).opacity) || 0;
        }
        return salida;
      },
      [t, TEXTOS],
    );

    for (const tx of medida.textos) {
      const l = tx.letra;
      if (l.x < 0 || l.x2 > CUADRO.ancho || l.y < 0 || l.y2 > CUADRO.alto)
        quejas.push(`t=${t.toFixed(2)} · «${tx.id}» se sale del cuadro (${Math.round(l.x)}…${Math.round(l.x2)} × ${Math.round(l.y)}…${Math.round(l.y2)})`);
      else if (
        l.x < SEGURO.izquierda || l.x2 > SEGURO.derecha ||
        l.y < SEGURO.arriba || l.y2 > SEGURO.abajo
      )
        avisos.push(`t=${t.toFixed(2)} · «${tx.id}» pisa la zona de los botones de la red (${Math.round(l.x)}…${Math.round(l.x2)} × ${Math.round(l.y)}…${Math.round(l.y2)})`);
      if (tx.desborda) quejas.push(`t=${t.toFixed(2)} · «${tx.id}» no le cabe el texto: se corta`);
    }

    // 0,7 s de margen al principio y al final: ahí el negro es el guion.
    if (medida.luz < 0.04 && t > 0.7 && t < FIN - 0.4)
      quejas.push(`t=${t.toFixed(2)} · fotograma vacío: no se ve nada`);

    if (medida.movil && anterior?.movil) {
      const d = Math.hypot(medida.movil.cx - anterior.movil.cx, medida.movil.cy - anterior.movil.cy)
        + Math.abs(medida.movil.alto - anterior.movil.alto);
      saltos.push({ t, d });
    }
    anterior = medida;
  }

  await cerrar();

  /*
    Los saltos del móvil.

    No vale con poner un número fijo: en el hero la cámara se mueve mucho más
    que en el resto y estaría bien que así fuera. Lo que se busca es un
    fotograma que se salga de lo que hacen sus vecinos, que es lo que se ve como
    un tirón.
  */
  const tirones = [];
  for (let i = 2; i < saltos.length - 2; i++) {
    const vecinos = [saltos[i - 2].d, saltos[i - 1].d, saltos[i + 1].d, saltos[i + 2].d];
    const media = vecinos.reduce((a, b) => a + b, 0) / vecinos.length;
    if (saltos[i].d > Math.max(12, media * 3.2 + 6)) tirones.push(saltos[i]);
  }
  for (const s of tirones)
    avisos.push(`t=${s.t.toFixed(2)} · el móvil salta ${s.d.toFixed(1)} px de golpe`);

  const maximo = saltos.reduce((a, b) => (b.d > a.d ? b : a), { d: 0, t: 0 });
  console.log(`\nRevisados ${total} fotogramas de ${FIN} s.`);
  console.log(`Movimiento máximo del móvil entre fotogramas: ${maximo.d.toFixed(1)} px (t=${maximo.t.toFixed(2)})`);

  if (avisos.length) {
    console.log(`\n${avisos.length} aviso(s):`);
    for (const a of avisos.slice(0, 25)) console.log("  ·", a);
    if (avisos.length > 25) console.log(`  … y ${avisos.length - 25} más`);
  }
  if (quejas.length) {
    console.log(`\n${quejas.length} PROBLEMA(S):`);
    for (const q of quejas.slice(0, 25)) console.log("  ✗", q);
    if (quejas.length > 25) console.log(`  … y ${quejas.length - 25} más`);
    process.exit(1);
  }
  console.log("\nTodo en su sitio: ni un texto cortado, ni uno fuera del cuadro, ni un fotograma vacío.");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
