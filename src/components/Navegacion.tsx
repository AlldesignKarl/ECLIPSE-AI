"use client";

import { useEffect, useState } from "react";

import { EMPRESA, enlaceTelefono } from "@/lib/config";
import { irA, useHaBajado } from "./movimiento";
import { pedir } from "./peticion";
import Sello from "./Sello";

/**
 * La cabecera.
 * ---------------------------------------------------------------------------
 * En la portada no hay barra: la primera pantalla es la imagen y el titular, y
 * una barra opaca encima le quita medio metro de altura. Aparece en cuanto se
 * baja, ya con cristal y con sombra, y a partir de ahí no se va.
 *
 * El menú de móvil se abre a pantalla completa porque un desplegable de seis
 * enlaces en una tira estrecha se toca mal, y bloquea el scroll de detrás
 * mientras está abierto: si no, se mueve la página por debajo del menú y al
 * cerrarlo no sabes dónde estás.
 */

const ENLACES = [
  { id: "historia", texto: "Historia" },
  { id: "ciudad", texto: "Zaragoza" },
  { id: "productos", texto: "Productos" },
  { id: "mayoristas", texto: "Por mayor" },
  { id: "proceso", texto: "Proceso" },
  { id: "contacto", texto: "Contacto" },
];

export default function Navegacion() {
  const bajado = useHaBajado(120);
  const [abierto, setAbierto] = useState(false);
  const tel = enlaceTelefono();

  useEffect(() => {
    if (!abierto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const conEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", conEscape);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", conEscape);
    };
  }, [abierto]);

  const saltar = (id: string) => {
    setAbierto(false);
    irA(id);
  };

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          bajado ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      >
        <div className="arte-cristal-oscuro border-x-0 border-t-0">
          <nav
            aria-label="Principal"
            className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8"
          >
            <button
              type="button"
              onClick={() => irA("portada")}
              className="flex items-center gap-3 text-[var(--arte-oro-claro)]"
            >
              <Sello tamano={34} />
              <span className="font-serif text-lg tracking-tight text-[var(--arte-texto-claro)]">
                {EMPRESA.nombreCorto}
              </span>
            </button>

            <ul className="hidden items-center gap-7 lg:flex">
              {ENLACES.map((e) => (
                <li key={e.id}>
                  <a
                    href={`/#${e.id}`}
                    onClick={(ev) => {
                      ev.preventDefault();
                      saltar(e.id);
                    }}
                    className="text-sm font-medium text-[var(--arte-texto-claro-suave)] transition-colors hover:text-[var(--arte-oro-claro)]"
                  >
                    {e.texto}
                  </a>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3">
              {tel && (
                <a
                  href={tel}
                  className="hidden text-sm font-medium text-[var(--arte-texto-claro-suave)] transition-colors hover:text-[var(--arte-oro-claro)] xl:inline"
                >
                  {EMPRESA.telefono}
                </a>
              )}
              <button
                type="button"
                onClick={() => pedir({ asunto: "catalogo" })}
                className="arte-boton hidden !px-5 !py-2 !text-[0.8rem] sm:inline-flex"
              >
                Solicitar catálogo
              </button>
              <button
                type="button"
                onClick={() => setAbierto(true)}
                aria-label="Abrir el menú"
                aria-expanded={abierto}
                className="grid h-10 w-10 place-items-center rounded-full border border-[var(--arte-borde-claro)] text-[var(--arte-texto-claro)] lg:hidden"
              >
                <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
                  <path d="M0 1h18M0 6h18M0 11h12" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            </div>
          </nav>
        </div>
        <div className="arte-filo h-px" />
      </header>

      {/* El menú de móvil */}
      <div
        className={`fixed inset-0 z-[60] lg:hidden ${abierto ? "" : "pointer-events-none"}`}
        aria-hidden={!abierto}
      >
        <div
          className={`arte-noche absolute inset-0 transition-opacity duration-400 ${
            abierto ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setAbierto(false)}
        />
        <div
          className={`relative flex h-full flex-col justify-between px-7 py-8 transition-all duration-500 ${
            abierto ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-3 text-[var(--arte-oro-claro)]">
              <Sello tamano={34} />
              <span className="font-serif text-lg text-[var(--arte-texto-claro)]">
                {EMPRESA.nombreCorto}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar el menú"
              className="grid h-10 w-10 place-items-center rounded-full border border-[var(--arte-borde-claro)] text-[var(--arte-texto-claro)]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>

          <ul className="flex flex-col gap-1">
            {ENLACES.map((e, i) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => saltar(e.id)}
                  className="w-full border-b border-white/10 py-4 text-left font-serif text-3xl text-[var(--arte-texto-claro)] transition-all duration-500"
                  style={{
                    transitionDelay: abierto ? `${80 + i * 45}ms` : "0ms",
                    opacity: abierto ? 1 : 0,
                    transform: abierto ? "none" : "translateY(12px)",
                  }}
                >
                  {e.texto}
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                pedir({ asunto: "catalogo" });
              }}
              className="arte-boton w-full"
            >
              Solicitar catálogo
            </button>
            {tel && (
              <a href={tel} className="arte-boton-fantasma w-full text-[var(--arte-texto-claro)]">
                Llamar {EMPRESA.telefono}
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
