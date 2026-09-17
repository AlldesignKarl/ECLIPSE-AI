"use client";

import { useEffect, useRef } from "react";

import { EMPRESA } from "@/lib/config";
import { Revelar, irA, useParallax } from "./movimiento";
import { pedir } from "./peticion";
import Silueta from "./Silueta";

/**
 * La portada: la primera pantalla y el primer movimiento.
 * ---------------------------------------------------------------------------
 * Tiene cuatro planos que se mueven a velocidades distintas —el halo, la
 * silueta, el velo y el texto—, que es lo que hace que al bajar parezca una
 * cámara y no una página.
 *
 * La salida (cuánto se ha bajado de esta primera pantalla) se escribe en una
 * variable CSS y NO en el estado de React. Repintar React en cada fotograma de
 * scroll es exactamente lo que hace que un móvil de gama media vaya a tirones;
 * escribir una variable lo resuelve el compositor sin tocar el árbol.
 *
 * `100svh` y no `100vh`: en el móvil, `vh` cuenta con la barra del navegador
 * escondida, así que la portada se sale por abajo y el botón queda cortado.
 */
export default function Portada() {
  const seccion = useRef<HTMLElement>(null);
  const halo = useParallax<HTMLDivElement>(90);
  const skyline = useParallax<HTMLDivElement>(-40);

  useEffect(() => {
    const el = seccion.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let pendiente = false;
    const pintar = () => {
      pendiente = false;
      const salida = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
      el.style.setProperty("--salida", salida.toFixed(3));
    };
    const alScroll = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(pintar);
    };
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll, { passive: true });
    pintar();
    return () => {
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", alScroll);
    };
  }, []);

  const titulo = EMPRESA.reclamo.split(" ");

  return (
    <section
      id="portada"
      ref={seccion}
      className="fondo-portada arte-grano relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden"
      style={{ ["--salida" as string]: 0 }}
    >
      {/* El halo: el sol detrás de la ciudad, que es de donde sale el oro */}
      <div ref={halo} className="arte-parallax pointer-events-none absolute inset-0 -z-10">
        <div
          className="arte-latido absolute left-1/2 top-[38%] h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(242,221,166,0.42), rgba(212,168,79,0.16) 46%, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: "linear-gradient(180deg, transparent, rgba(5,8,23,0.94))" }}
        />
      </div>

      {/* La ciudad, al fondo y a su ritmo.

          La máscara la desvanece por arriba: sin ella, las torres cortan el
          párrafo por la mitad y el texto se lee sobre picos de oro. Y el velo de
          debajo oscurece SOLO el lado del texto, que es la diferencia entre una
          imagen de fondo y una imagen que estorba. */}
      <div
        ref={skyline}
        className="arte-parallax pointer-events-none absolute inset-x-0 bottom-0 -z-10"
        style={{
          opacity: "calc(1 - var(--salida) * 0.55)",
          maskImage: "linear-gradient(180deg, transparent, #000 42%)",
          WebkitMaskImage: "linear-gradient(180deg, transparent, #000 42%)",
        }}
      >
        <Silueta className="h-[44vh] w-full text-[var(--arte-oro)] opacity-[0.16] sm:h-[52vh]" />
      </div>

      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(95deg, rgba(5,8,23,0.86) 0%, rgba(5,8,23,0.58) 38%, transparent 68%)",
        }}
      />

      <div
        className="relative mx-auto w-full max-w-7xl px-5 pb-20 pt-32 sm:px-8 sm:pb-28"
        style={{
          opacity: "calc(1 - var(--salida) * 1.15)",
          transform: "translateY(calc(var(--salida) * -70px))",
        }}
      >
        <Revelar>
          <p className="arte-ojal">Artesanía de Zaragoza · Venta al por mayor</p>
        </Revelar>

        <h1 className="arte-display mt-6 max-w-[15ch] text-[var(--arte-texto-claro)]">
          {titulo.map((palabra, i) => (
            <Revelar key={`${palabra}-${i}`} as="span" retraso={120 + i * 110} className="mr-[0.28em] inline-block">
              {/* La última palabra en oro: el reclamo entero en dorado sería un
                  cartel; una sola palabra es una marca. */}
              {i === titulo.length - 1 ? <em className="arte-realce not-italic">{palabra}</em> : palabra}
            </Revelar>
          ))}
        </h1>

        <Revelar retraso={480}>
          <p className="arte-cuerpo mt-7 max-w-xl">
            Creamos y distribuimos producto artesanal de Zaragoza para tiendas, museos,
            distribuidores y empresas. Series cortas, hechas a mano, servidas al por mayor con
            trato directo.
          </p>
        </Revelar>

        <Revelar retraso={620}>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={() => pedir({ asunto: "catalogo" })} className="arte-boton">
              Solicitar catálogo
            </button>
            <button
              type="button"
              onClick={() => irA("productos")}
              className="arte-boton-fantasma text-[var(--arte-texto-claro)]"
            >
              Ver productos
            </button>
          </div>
        </Revelar>
      </div>

      {/* El aviso de que hay más abajo. Se apaga en cuanto se empieza a bajar:
          un indicador que sigue diciendo "sigue bajando" cuando ya estás
          bajando es ruido. */}
      <div
        className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex"
        style={{ opacity: "calc(1 - var(--salida) * 3)" }}
      >
        <span className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--arte-texto-claro-suave)]">
          Baja
        </span>
        <span className="relative block h-10 w-px overflow-hidden bg-white/15">
          <span className="arte-gota absolute inset-x-0 top-0 block h-4 bg-[var(--arte-oro)]" />
        </span>
      </div>
    </section>
  );
}
