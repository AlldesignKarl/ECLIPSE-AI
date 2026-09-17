"use client";

import { EMPRESA, enlaceTelefono, enlaceWhatsApp } from "@/lib/config";
import { Revelar, useParallax } from "./movimiento";
import { pedir } from "./peticion";
import Silueta from "./Silueta";

/**
 * Venta al por mayor: la sección que tiene que dejar claro con quién trabajamos.
 * ---------------------------------------------------------------------------
 * Es la que decide si una empresa escribe o se va. Por eso no habla de nosotros
 * sino de lo que el cliente necesita saber antes de hacer un pedido: mínimos,
 * plazos, quién le atiende y cómo se sirve.
 *
 * El aviso grande del final es el único sitio de la web con dos llamadas a la
 * acción juntas, y es a propósito: pedir catálogo y pedir presupuesto son dos
 * momentos distintos de la misma decisión.
 */

const VENTAJAS = [
  {
    titulo: "Pedidos al por mayor",
    texto:
      "Mínimos razonables por referencia y precio por volumen. Puedes empezar con poco y crecer.",
    icono: "cajas",
  },
  {
    titulo: "Atención personalizada",
    texto:
      "Una persona lleva tu cuenta de principio a fin. Sin centralita y sin repetir lo mismo tres veces.",
    icono: "persona",
  },
  {
    titulo: "Producto artesanal",
    texto:
      "Elaboración a mano, control de cada lote y ficha técnica de cada pieza para tu punto de venta.",
    icono: "mano",
  },
  {
    titulo: "Distribución",
    texto:
      "Embalaje preparado para transporte y entrega agrupada. Te decimos el plazo antes de aceptar el pedido.",
    icono: "camion",
  },
  {
    titulo: "Tiendas y empresas",
    texto:
      "Trabajamos con tiendas de museo, souvenir, regalo, gourmet, hoteles y empresas que buscan obsequio corporativo.",
    icono: "tienda",
  },
  {
    titulo: "Catálogo y tarifas",
    texto:
      "Catálogo en PDF con referencias, mínimos y tarifa mayorista actualizada. Te lo mandamos al pedirlo.",
    icono: "documento",
  },
];

function Icono({ nombre }: { nombre: string }) {
  const comun = {
    width: 26,
    height: 26,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (nombre) {
    case "cajas":
      return (
        <svg {...comun}>
          <path d="M3 8l9-4 9 4-9 4-9-4Z" />
          <path d="M3 8v8l9 4 9-4V8" />
          <path d="M12 12v8" />
        </svg>
      );
    case "persona":
      return (
        <svg {...comun}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
        </svg>
      );
    case "mano":
      return (
        <svg {...comun}>
          <path d="M8 12V5a1.5 1.5 0 0 1 3 0v6" />
          <path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11" />
          <path d="M14 11.5V7a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5.2-3L3 14.5a1.6 1.6 0 0 1 2.7-1.7L8 15" />
        </svg>
      );
    case "camion":
      return (
        <svg {...comun}>
          <path d="M2 7h11v9H2z" />
          <path d="M13 10h4l4 3.5V16h-8" />
          <circle cx="6.5" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
      );
    case "tienda":
      return (
        <svg {...comun}>
          <path d="M3 9l1.5-5h15L21 9" />
          <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
          <path d="M5 11v9h14v-9" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    default:
      return (
        <svg {...comun}>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4" />
          <path d="M9 12h6M9 16h6" />
        </svg>
      );
  }
}

export default function PorMayor() {
  const fondo = useParallax<HTMLDivElement>(50);
  const tel = enlaceTelefono();
  const wa = enlaceWhatsApp(
    "Hola, os escribo desde la web. Me gustaría recibir el catálogo mayorista.",
  );

  return (
    <section
      id="mayoristas"
      className="fondo-mayor relative overflow-hidden pb-24 pt-32 sm:pb-32 sm:pt-44"
      aria-labelledby="mayoristas-titulo"
    >
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Revelar>
            <p className="arte-ojal">Venta al por mayor</p>
          </Revelar>
          <Revelar retraso={90}>
            <h2 id="mayoristas-titulo" className="arte-titulo mt-6 text-[var(--arte-marfil)]">
              Trabajamos con <em className="arte-realce">empresas</em>, no con pedidos sueltos.
            </h2>
          </Revelar>
          <Revelar retraso={160}>
            <p className="arte-cuerpo mt-7">
              Tiendas, museos, distribuidores, hoteles y empresas que buscan un regalo con origen.
              Si vendes producto, esto está hecho para ti.
            </p>
          </Revelar>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {VENTAJAS.map((v, i) => (
            <Revelar key={v.titulo} retraso={i * 80}>
              <div className="arte-tarjeta-oscura h-full p-7">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-[var(--arte-borde-claro)] bg-white/5 text-[var(--arte-oro)]">
                  <Icono nombre={v.icono} />
                </span>
                <h3 className="mt-5 font-serif text-xl text-[var(--arte-marfil)]">{v.titulo}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--arte-texto-claro-suave)]">
                  {v.texto}
                </p>
              </div>
            </Revelar>
          ))}
        </div>

        {/* La llamada grande */}
        <Revelar como="escala" retraso={120}>
          <div className="arte-noche arte-grano relative mt-20 overflow-hidden rounded-[1.75rem] border border-[var(--arte-borde-claro)] px-7 py-16 text-center shadow-[var(--arte-sombra-alta)] sm:px-14 sm:py-20">
            <div ref={fondo} className="arte-parallax pointer-events-none absolute inset-x-0 bottom-0 -z-10">
              <Silueta className="h-[34vh] w-full text-[var(--arte-oro)] opacity-[0.12]" conRio={false} />
            </div>

            <p className="arte-ojal justify-center">Empezar es fácil</p>
            <h3 className="arte-titulo mx-auto mt-5 max-w-[18ch] text-[var(--arte-texto-claro)]">
              ¿Quieres trabajar <em className="arte-realce">con nosotros</em>?
            </h3>
            <p className="arte-cuerpo mx-auto mt-6 max-w-xl">
              Cuéntanos qué tipo de negocio tienes y qué buscas. Te preparamos una propuesta con
              producto, cantidades y precio, sin compromiso.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button type="button" onClick={() => pedir({ asunto: "presupuesto" })} className="arte-boton">
                Solicitar presupuesto
              </button>
              <button
                type="button"
                onClick={() => pedir({ asunto: "catalogo" })}
                className="arte-boton-fantasma text-[var(--arte-texto-claro)]"
              >
                Solicitar catálogo
              </button>
            </div>

            {/* Los atajos directos solo salen si hay un número puesto: un botón
                de WhatsApp sin número es un botón que no hace nada. */}
            {(tel || wa) && (
              <p className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--arte-texto-claro-suave)]">
                {tel && (
                  <a href={tel} className="transition-colors hover:text-[var(--arte-oro-claro)]">
                    Llamar a {EMPRESA.telefono}
                  </a>
                )}
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-[var(--arte-oro-claro)]"
                  >
                    Escribir por WhatsApp
                  </a>
                )}
              </p>
            )}
          </div>
        </Revelar>
      </div>
    </section>
  );
}
