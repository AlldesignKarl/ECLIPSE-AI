"use client";

import Marco from "./Marco";
import Silueta from "./Silueta";
import { Revelar, useParallax } from "./movimiento";

/**
 * Zaragoza y El Pilar: de dónde sale el producto.
 * ---------------------------------------------------------------------------
 * Es la sección oscura de la web, y va aquí a propósito: después de la crema
 * de la historia, entrar en negro azulado se siente como bajar la luz de una
 * sala antes de enseñar una pieza.
 *
 * La silueta ocupa el fondo entero y se mueve al revés que el texto. Está en
 * SVG, así que a pantalla completa en un monitor grande sigue con el filo
 * limpio: una fotografía escalada ahí se vería pastosa.
 */

const CLAVES = [
  { dato: "Zaragoza", pie: "Origen y taller" },
  { dato: "El Pilar", pie: "Motivo e inspiración" },
  { dato: "Series cortas", pie: "Producción controlada" },
];

const CINTA = [
  "El Pilar",
  "Ebro",
  "Oficio",
  "Aragón",
  "Hecho a mano",
  "Series cortas",
  "Al por mayor",
];

export default function Ciudad() {
  const fondo = useParallax<HTMLDivElement>(70);
  const foto = useParallax<HTMLDivElement>(-55);

  return (
    <section
      id="ciudad"
      className="fondo-ciudad arte-grano relative isolate overflow-hidden pt-24 sm:pt-32"
      aria-labelledby="ciudad-titulo"
    >
      <div className="arte-filo absolute inset-x-0 top-0 h-px" />

      <div ref={fondo} className="arte-parallax pointer-events-none absolute inset-x-0 bottom-0 -z-10">
        <Silueta className="h-[60vh] w-full text-[var(--arte-cielo)] opacity-[0.1]" conRio />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-20">
          <div>
            <Revelar>
              <p className="arte-ojal">Zaragoza · El Pilar</p>
            </Revelar>

            <Revelar retraso={90}>
              <h2 id="ciudad-titulo" className="arte-titulo mt-6 max-w-[14ch]">
                Del Ebro al <em className="arte-realce">escaparate</em> de tu tienda.
              </h2>
            </Revelar>

            <Revelar retraso={170}>
              <p className="arte-cuerpo mt-7 max-w-xl">
                Trabajamos con lo que tenemos delante: una ciudad con una basílica que se reconoce
                en cualquier estantería del mundo, un río que la parte en dos y un oficio que lleva
                aquí generaciones. De ahí salen los motivos, los colores y las piezas.
              </p>
            </Revelar>

            <Revelar retraso={230}>
              <p className="arte-cuerpo mt-4 max-w-xl">
                No es una etiqueta de origen puesta encima: es lo que se vende. Quien compra una de
                estas piezas se lleva la ciudad, y quien la vende en su tienda lo sabe.
              </p>
            </Revelar>

            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[var(--arte-borde-claro)] bg-white/10 sm:grid-cols-3">
              {CLAVES.map((c, i) => (
                <Revelar key={c.dato} retraso={280 + i * 100}>
                  <div className="h-full bg-[rgba(10,20,48,0.55)] px-6 py-7">
                    <p className="font-serif text-2xl text-[var(--arte-oro-claro)]">{c.dato}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--arte-texto-claro-suave)]">
                      {c.pie}
                    </p>
                  </div>
                </Revelar>
              ))}
            </div>
          </div>

          <Revelar como="escala" retraso={120}>
            <div ref={foto} className="arte-parallax relative">
              <Marco
                imagen={null}
                alt="La basílica del Pilar sobre el Ebro"
                tono="azul"
                motivo="arco"
                className="aspect-[3/4] w-full rounded-[1.5rem] border border-[var(--arte-borde-claro)]"
              />
              <div className="arte-cristal-oscuro absolute -bottom-6 left-1/2 w-[82%] -translate-x-1/2 rounded-2xl px-6 py-4 text-center">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--arte-oro-claro)]">
                  Producto con origen
                </p>
              </div>
            </div>
          </Revelar>
        </div>
      </div>

      {/* La cinta: pasa despacio y sin fin, como el letrero de un taller. Está
          marcada como decorativa para que un lector de pantalla no la lea siete
          veces seguidas. */}
      {/*
        La cinta ya no es un adorno: es la BISAGRA entre el acto azul de la
        ciudad y el marfil del catálogo. Por eso va en marfil con las palabras
        en azul y pegada al borde de abajo de la sección: el cambio de color no
        se disimula con un degradado, se enseña.
      */}
      <div className="bisagra-clara relative mt-20 overflow-hidden border-t border-[var(--arte-borde-claro)] py-6" aria-hidden="true">
        <div className="arte-cinta flex w-max items-center gap-10 whitespace-nowrap">
          {[0, 1].map((vuelta) => (
            <div key={vuelta} className="flex items-center gap-10">
              {CINTA.map((palabra) => (
                <span key={`${vuelta}-${palabra}`} className="flex items-center gap-10">
                  <span className="font-serif text-2xl text-[var(--arte-azul)] sm:text-3xl">
                    {palabra}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--arte-oro)]" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
