"use client";

import { Revelar, useProgreso } from "./movimiento";
import { pedir } from "./peticion";

/**
 * Cómo se trabaja con nosotros, paso a paso.
 * ---------------------------------------------------------------------------
 * El hilo dorado de la izquierda se va llenando según baja el scroll y el paso
 * en el que estás se enciende. Es la parte más "de historia" de la web y la que
 * más fácil se pasa de frenada, así que el movimiento es UNO: encender. Sin
 * giros, sin zoom y sin que los pasos entren desde los lados.
 *
 * El avance se calcula con `useProgreso`, que redondea a centésimas: sin ese
 * redondeo React repintaría cinco tarjetas sesenta veces por segundo para
 * mover una línea dos píxeles.
 */

const PASOS = [
  {
    numero: "01",
    titulo: "Contacta",
    texto:
      "Escríbenos por el formulario, por correo o por teléfono. Te contestamos con nombre y apellidos, no con un número de ticket.",
  },
  {
    numero: "02",
    titulo: "Cuéntanos qué necesitas",
    texto:
      "Qué tipo de negocio tienes, qué producto encaja contigo y qué volumen manejas. Con eso ya sabemos por dónde ir.",
  },
  {
    numero: "03",
    titulo: "Seleccionamos los productos",
    texto:
      "Te proponemos las referencias que mejor funcionan en tu tipo de tienda, con precios por volumen y mínimos claros.",
  },
  {
    numero: "04",
    titulo: "Preparamos tu pedido",
    texto:
      "Se elabora, se revisa pieza a pieza y se embala pensando en el transporte y en cómo va a llegar a tu estantería.",
  },
  {
    numero: "05",
    titulo: "Lo enviamos",
    texto:
      "Sale con su albarán y su seguimiento, y te avisamos. Si algo llega mal, se repone: eso no se discute.",
  },
];

export default function Proceso() {
  const { ref, progreso } = useProgreso<HTMLDivElement>();

  // El hilo va por delante del scroll (×1.35) para que llegue abajo cuando el
  // último paso está en pantalla y no media pantalla después.
  const avance = Math.min(100, Math.round(progreso * 135));
  const activos = Math.round((avance / 100) * PASOS.length);

  return (
    <section
      id="proceso"
      className="fondo-proceso arte-grano relative overflow-hidden py-24 sm:py-32"
      aria-labelledby="proceso-titulo"
    >
      <div className="arte-filo absolute inset-x-0 top-0 h-px" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Revelar>
              <p className="arte-ojal">El proceso</p>
            </Revelar>
            <Revelar retraso={90}>
              <h2 id="proceso-titulo" className="arte-titulo mt-6 max-w-[12ch]">
                De la primera pregunta al <em className="arte-realce">pedido servido</em>.
              </h2>
            </Revelar>
            <Revelar retraso={160}>
              <p className="arte-cuerpo mt-7 max-w-md">
                Cinco pasos, sin intermediarios y sin letra pequeña. La mayoría de los pedidos
                empiezan con un correo de tres líneas.
              </p>
            </Revelar>
            <Revelar retraso={220}>
              <button type="button" onClick={() => pedir({ asunto: "informacion" })} className="arte-boton mt-9">
                Empezar ahora
              </button>
            </Revelar>
          </div>

          <div ref={ref} className="relative pl-12 sm:pl-16">
            {/* El hilo. Decorativo: lo que cuenta son los pasos, que son una
                lista ordenada de verdad. */}
            <span
              aria-hidden="true"
              className="arte-hilo absolute left-[0.4rem] top-2 bottom-2 w-px sm:left-[0.9rem]"
              style={{ ["--avance" as string]: `${avance}%` }}
            />

            <ol className="space-y-12 sm:space-y-16">
              {PASOS.map((paso, i) => {
                const encendido = i < activos;
                return (
                  <li key={paso.numero} className="relative">
                    <span
                      aria-hidden="true"
                      className={`absolute -left-12 top-3 h-3 w-3 rounded-full border transition-all duration-700 sm:-left-16 ${
                        encendido
                          ? "scale-125 border-[var(--arte-oro)] bg-[var(--arte-oro)] shadow-[0_0_18px_rgba(201,162,39,0.7)]"
                          : "border-white/25 bg-[var(--arte-noche)]"
                      }`}
                      style={{ marginLeft: "-0.1rem" }}
                    />
                    <Revelar retraso={i * 60}>
                      <div
                        className={`transition-opacity duration-700 ${encendido ? "opacity-100" : "opacity-45"}`}
                      >
                        <span className="arte-cifra block">{paso.numero}</span>
                        <h3 className="arte-subtitulo mt-3 text-[var(--arte-texto-claro)]">
                          {paso.titulo}
                        </h3>
                        <p className="arte-cuerpo mt-3 max-w-lg">{paso.texto}</p>
                      </div>
                    </Revelar>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
