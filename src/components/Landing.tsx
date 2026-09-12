"use client";

import EclipseMark from "./EclipseMark";
import LandingShowcase from "./LandingShowcase";
import * as Icon from "./Icons";

interface Props {
  onEnter: () => void;
}

/**
 * Lo que la gente pregunta antes de probar algo nuevo. Sirve a quien llega y,
 * de paso, es el único contenido con sustancia que un buscador puede leer:
 * una portada de cuatro frases no tiene nada que indexar.
 */
const PREGUNTAS = [
  {
    q: "¿Qué es ECLIPSE?",
    a: "Un asistente de inteligencia artificial al que puedes preguntarle cualquier cosa. Responde, busca en la web cuando hace falta, lee las imágenes y los documentos que le pases, crea imágenes y te ayuda a escribir.",
  },
  {
    q: "¿Es gratis?",
    a: "Sí. El plan Gratis no caduca y no pide tarjeta: conversar, buscar con fuentes, analizar archivos y crear imágenes están incluidos. El plan Pro añade la creación de bots, el modo Profundo y respuestas más rápidas.",
  },
  {
    q: "¿Hay que registrarse?",
    a: "Para probarlo no. La cuenta con correo y contraseña sirve para que tu plan te acompañe si entras desde otro dispositivo.",
  },
  {
    q: "¿Qué hace con lo que le escribo?",
    a: "Las conversaciones se guardan en tu propio dispositivo, no en un servidor. Al servidor solo viaja el mensaje que estás preguntando, para poder responderte.",
  },
  {
    q: "¿En qué se diferencia de otros asistentes?",
    a: "En que prefiere decir «no lo sé» a quedar bien. Distingue lo que es un hecho contrastado de lo que es una estimación suya, y cuando busca en internet enseña de dónde ha sacado cada cosa, ordenado por fiabilidad.",
  },
  {
    q: "¿Puedo hablarle en vez de escribir?",
    a: "Sí. El botón del micrófono en la caja de escribir pasa tu voz a texto, lo revisas y lo envías.",
  },
];

export default function Landing({ onEnter }: Props) {
  return (
    <div className="scroll-thin min-h-dvh overflow-y-auto bg-void">
      {/* ---------------------------------------------------------- Hero */}
      <header className="relative overflow-hidden">
        <div className="grid-lines pointer-events-none absolute inset-0" aria-hidden />
        <div className="aurora pointer-events-none absolute inset-0" aria-hidden />

        <nav className="relative mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-5">
          <EclipseMark size={26} />
          <span className="flex-1 text-[14px] font-semibold tracking-[0.16em]">ECLIPSE</span>
          <button
            onClick={onEnter}
            className="rounded-full border border-line px-4 py-1.5 text-[13px] text-muted transition hover:border-halo/40 hover:text-ink"
          >
            Entrar
          </button>
        </nav>

        <div className="relative mx-auto flex max-w-2xl flex-col items-center px-5 pb-20 pt-10 text-center sm:pt-16">
          <EclipseMark size={168} />

          <h1 className="mt-10 font-serif text-[38px] font-medium leading-[1.08] tracking-[-0.015em] text-ink sm:text-[52px]">
            Pregunta cualquier cosa.
            <br />
            <span className="text-muted italic">Con las fuentes delante.</span>
          </h1>

          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted">
            ECLIPSE responde, investiga, lee tus archivos, crea imágenes y programa.
            Y cuando algo no lo sabe con certeza, te lo dice en vez de inventárselo.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <button
              onClick={onEnter}
              className="rounded-xl bg-ink px-6 py-3 text-[14.5px] font-medium text-void transition hover:opacity-90"
            >
              Empezar gratis
            </button>
            <a
              href="#preguntas"
              className="rounded-xl border border-line px-6 py-3 text-[14.5px] text-muted transition hover:border-halo/30 hover:text-ink"
            >
              Cómo funciona
            </a>
          </div>

          <p className="mt-4 text-[12px] text-faint">Sin tarjeta. Sin registro para probar.</p>
        </div>
      </header>

      <LandingShowcase />

      {/* ---------------------------------------------------- Colaboración */}
      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="relative overflow-hidden rounded-2xl border border-line-soft bg-panel/25 px-6 py-10 text-center sm:py-12">
          {/* La misma luz del logo, muy bajita, para que la firma no quede plana */}
          <div className="marca-luz pointer-events-none absolute inset-0" aria-hidden />

          <div className="relative">
            <div className="flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-line-soft sm:w-14" aria-hidden />
              <span className="text-[10.5px] uppercase tracking-[0.24em] text-faint">
                En colaboración con
              </span>
              <span className="h-px w-8 bg-line-soft sm:w-14" aria-hidden />
            </div>

            <p className="marca-firma mt-5 font-serif text-[32px] font-medium leading-none tracking-[-0.01em] text-ink sm:text-[44px]">
              Alldesign<span className="italic">Karl</span>
            </p>

            <p className="mx-auto mt-4 max-w-md text-[13px] leading-relaxed text-muted">
              Diseño y dirección de marca. La identidad de ECLIPSE —el eclipse, la tipografía y
              esta luz— sale de su estudio.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- Honestidad */}
      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="rounded-2xl border border-line-soft bg-panel/40 p-7 sm:p-9">
          <h2 className="font-serif text-[23px] font-medium leading-snug text-ink sm:text-[26px]">
            Prefiere decir “no lo sé” antes que quedar bien
          </h2>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">
            La mayoría de asistentes rellenan los huecos cuando no saben algo: se inventan una
            cifra, una cita o un enlace que suena verosímil. ECLIPSE está construido al revés.
            Separa lo que es un hecho contrastado de lo que es consenso mayoritario y de lo que
            es una estimación suya, y cuando algo conviene verificar, te dice dónde hacerlo.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------ Preguntas */}
      <section id="preguntas" className="mx-auto max-w-5xl px-5 pb-16">
        <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">Preguntas frecuentes</h2>

        <div className="mt-7 divide-y divide-line-soft overflow-hidden rounded-2xl border border-line-soft">
          {PREGUNTAS.map((p) => (
            <details key={p.q} className="group bg-panel/25 open:bg-panel/40">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-[14.5px] font-medium text-ink">
                <span className="flex-1">{p.q}</span>
                <span className="text-faint transition group-open:rotate-45" aria-hidden>
                  <Icon.Plus width={16} height={16} />
                </span>
              </summary>
              <p className="px-5 pb-5 text-[13.5px] leading-relaxed text-muted">{p.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Las mismas preguntas, en el formato que Google sabe leer. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: PREGUNTAS.map((p) => ({
              "@type": "Question",
              name: p.q,
              acceptedAnswer: { "@type": "Answer", text: p.a },
            })),
          }),
        }}
      />

      {/* ------------------------------------------------------------- Pie */}
      <footer className="border-t border-line-soft">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <EclipseMark size={20} />
            <span className="text-[13px] tracking-[0.14em] text-muted">ECLIPSE</span>
          </div>
          <p className="flex-1 text-[12px] text-faint sm:text-right">
            Un producto de <span className="text-muted">Eclipse</span>, fundada por{" "}
            <span className="text-muted">Carlos Lafuente Pueyo</span>.
          </p>
        </div>
      </footer>
    </div>
  );
}
