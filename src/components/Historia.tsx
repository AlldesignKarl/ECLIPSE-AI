"use client";

import Marco from "./Marco";
import { Revelar, useParallax } from "./movimiento";

/**
 * La historia: la frase que explica de qué va esto.
 * ---------------------------------------------------------------------------
 * Va sobre crema y no sobre blanco. El blanco puro después de la portada
 * nocturna es un fogonazo; la crema mantiene el papel, que es de lo que habla
 * la sección.
 *
 * La fotografía sube más despacio que el texto (parallax al revés): así al
 * bajar parece que la página tira del texto y la imagen se queda, que es el
 * movimiento que da sensación de profundidad sin marear.
 */

const PILARES = [
  {
    titulo: "Hecho a mano",
    texto:
      "Cada pieza pasa por las manos de alguien que sabe hacerla. No hay dos idénticas, y esa es la gracia.",
  },
  {
    titulo: "Materiales nobles",
    texto:
      "Barro, lino, papel de algodón, metal. Materia prima que envejece bien y se nota al tocarla.",
  },
  {
    titulo: "Series cortas",
    texto:
      "Producciones limitadas y control de cada lote. Lo que llega a tu tienda no está en todas partes.",
  },
];

export default function Historia() {
  const foto = useParallax<HTMLDivElement>(-70);
  const apunte = useParallax<HTMLDivElement>(48);

  return (
    <section
      id="historia"
      className="arte-crema-fondo relative overflow-hidden py-24 sm:py-32"
      aria-labelledby="historia-titulo"
    >
      <div className="arte-trama pointer-events-none absolute inset-0 opacity-60" />

      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-20">
        <div>
          <Revelar>
            <p className="arte-ojal">Quiénes somos</p>
          </Revelar>

          <Revelar retraso={90}>
            <h2 id="historia-titulo" className="arte-titulo mt-6 max-w-[16ch] text-[var(--arte-tinta)]">
              La artesanía no se fabrica. <em className="arte-realce">Se crea.</em>
            </h2>
          </Revelar>

          <Revelar retraso={180}>
            <p className="arte-cuerpo mt-7 max-w-xl">
              Detrás de cada pieza hay un oficio que se aprende despacio: el punto del esmalte, la
              tensión del hilo, el pliegue que solo sale a la tercera. Eso no se acelera, y por eso
              no intentamos parecer una fábrica.
            </p>
          </Revelar>

          <Revelar retraso={240}>
            <p className="arte-cuerpo mt-4 max-w-xl">
              Lo que sí hacemos es lo que una empresa necesita para trabajar tranquila: plazos
              claros, lotes constantes, embalaje cuidado y una persona al otro lado del teléfono
              que conoce el producto.
            </p>
          </Revelar>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {PILARES.map((p, i) => (
              <Revelar key={p.titulo} retraso={300 + i * 110}>
                <div className="border-t border-[var(--arte-borde)] pt-5">
                  <h3 className="font-serif text-lg text-[var(--arte-tinta)]">{p.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--arte-texto-suave)]">{p.texto}</p>
                </div>
              </Revelar>
            ))}
          </div>
        </div>

        <div className="relative">
          <Revelar como="escala">
            <div ref={foto} className="arte-parallax">
              <Marco
                imagen={null}
                alt="Taller artesano: manos trabajando una pieza"
                tono="terracota"
                motivo="torno"
                className="aspect-[4/5] w-full rounded-[1.5rem] shadow-[var(--arte-sombra-alta)]"
              />
            </div>
          </Revelar>

          {/* La nota manuscrita encima de la foto: el detalle que convierte dos
              columnas en una composición. En móvil se coloca debajo, porque
              encima taparía media imagen. */}
          <Revelar retraso={260} className="relative z-10 -mt-10 sm:absolute sm:-bottom-10 sm:-left-10 sm:mt-0 sm:max-w-xs">
            <div ref={apunte} className="arte-parallax arte-cristal rounded-2xl p-6">
              <p className="font-serif text-xl leading-snug text-[var(--arte-tinta)]">
                “Si se nota que está hecho a mano, está bien hecho.”
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[var(--arte-texto-suave)]">
                Del taller
              </p>
            </div>
          </Revelar>
        </div>
      </div>
    </section>
  );
}
