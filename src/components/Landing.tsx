"use client";

import EclipseMark from "./EclipseMark";
import * as Icon from "./Icons";

interface Props {
  onEnter: () => void;
  price: string;
}

const CAPABILITIES = [
  {
    icon: Icon.Search,
    title: "Busca y contrasta",
    text: "Cuando la pregunta depende de datos reales, busca en la web y prioriza universidades, revistas revisadas por pares y organismos oficiales. Cada respuesta enseña de dónde salió.",
  },
  {
    icon: Icon.Paperclip,
    title: "Lee lo que le des",
    text: "Imágenes, PDF, hojas de cálculo, código. Se lo adjuntas y lo analiza: resume, extrae, compara o te explica lo que no entiendes.",
  },
  {
    icon: Icon.Image,
    title: "Crea imágenes",
    text: "Describe lo que tienes en la cabeza y lo dibuja. Para una idea, una portada o una prueba rápida.",
  },
  {
    icon: Icon.Code,
    title: "Programa de verdad",
    text: "Construye el proyecto archivo por archivo, delante de ti. Al terminar te lo entrega listo para abrir, descargar o subir a tu GitHub.",
  },
];

const FREE = ["Conversación sin límite", "Búsqueda con fuentes", "Imágenes, PDF y archivos", "Crear imágenes"];
const PRO = ["Todo lo del plan Gratis", "Generación de vídeo", "Modo código con GitHub", "Modo Profundo", "Respuestas aceleradas"];

export default function Landing({ onEnter, price }: Props) {
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
              href="#planes"
              className="rounded-xl border border-line px-6 py-3 text-[14.5px] text-muted transition hover:border-halo/30 hover:text-ink"
            >
              Ver los planes
            </a>
          </div>

          <p className="mt-4 text-[12px] text-faint">Sin tarjeta. Sin registro para probar.</p>
        </div>
      </header>

      {/* -------------------------------------------------- Qué sabe hacer */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">Qué sabe hacer</h2>

        <div className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-line-soft bg-line-soft sm:grid-cols-2">
          {CAPABILITIES.map((c) => (
            <article key={c.title} className="bg-void p-6">
              <c.icon width={19} height={19} className="text-halo" />
              <h3 className="mt-3.5 text-[15px] font-medium text-ink">{c.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{c.text}</p>
            </article>
          ))}
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

      {/* ----------------------------------------------------------- Planes */}
      <section id="planes" className="mx-auto max-w-5xl px-5 pb-16">
        <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">Planes</h2>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line-soft bg-panel/30 p-6">
            <div className="text-[15px] font-medium text-ink">Gratis</div>
            <div className="mt-1 text-[28px] font-semibold text-ink">0 €</div>
            <p className="mt-1 text-[12.5px] text-faint">Para siempre</p>

            <ul className="mt-5 space-y-2.5">
              {FREE.map((f) => (
                <li key={f} className="flex gap-2.5 text-[13.5px] text-muted">
                  <Icon.Check width={15} height={15} className="mt-0.5 shrink-0 text-faint" />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={onEnter}
              className="mt-6 w-full rounded-xl border border-line py-2.5 text-[13.5px] text-ink transition hover:border-halo/40"
            >
              Empezar
            </button>
          </div>

          <div className="rounded-2xl border border-pro/30 bg-gradient-to-b from-pro/10 to-transparent p-6">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-medium text-ink">Pro</span>
              <Icon.Sparkle width={15} height={15} className="text-pro" />
            </div>
            <div className="mt-1 text-[28px] font-semibold text-ink">{price}</div>
            <p className="mt-1 text-[12.5px] text-faint">Al mes · cancelas cuando quieras</p>

            <ul className="mt-5 space-y-2.5">
              {PRO.map((f) => (
                <li key={f} className="flex gap-2.5 text-[13.5px] text-ink">
                  <Icon.Check width={15} height={15} className="mt-0.5 shrink-0 text-pro" />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={onEnter}
              className="mt-6 w-full rounded-xl bg-ink py-2.5 text-[13.5px] font-medium text-void transition hover:opacity-90"
            >
              Empezar y mejorar dentro
            </button>
          </div>
        </div>
      </section>

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
