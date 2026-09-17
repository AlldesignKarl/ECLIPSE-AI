"use client";

import { useState } from "react";

import { CATEGORIAS, ordenados, type Producto } from "@/lib/productos";
import Marco, { type Motivo } from "./Marco";
import { Revelar } from "./movimiento";
import { pedir } from "./peticion";

/**
 * El catálogo.
 * ---------------------------------------------------------------------------
 * Tres decisiones que lo separan de una cuadrícula:
 *
 * - Los destacados ocupan el doble. Una rejilla de diez piezas iguales se mira
 *   como una lista; con dos piezas grandes, el ojo entra por algún sitio.
 * - El filtro REMONTA la rejilla (`key={categoria}`). Así las tarjetas vuelven a
 *   entrar con su animación escalonada en vez de cambiar de golpe, que es lo
 *   que hace que filtrar se sienta como pasar de página.
 * - El botón de cada tarjeta no abre un formulario aparte: lleva al de abajo
 *   con el producto ya escrito dentro. Un formulario menos que rellenar es más
 *   solicitudes que llegan.
 */

/** A cada categoría, su dibujo de oficio cuando todavía no hay fotografía. */
const MOTIVOS: Record<string, Motivo> = {
  Cerámica: "torno",
  Textil: "telar",
  Papelería: "sello",
  Gourmet: "sello",
  Recuerdo: "arco",
};

function Tarjeta({ producto, retraso }: { producto: Producto; retraso: number }) {
  const grande = Boolean(producto.destacado);

  return (
    <Revelar
      retraso={retraso}
      className={grande ? "sm:col-span-2 sm:row-span-2" : ""}
      as="article"
    >
      <div className="arte-tarjeta flex h-full flex-col">
        {/*
          La destacada ocupa dos filas, así que su texto corto dejaba un hueco
          blanco enorme debajo. Con la foto creciendo (`flex-1`) el hueco se lo
          come la imagen, que es lo que se quería enseñar grande.
        */}
        <Marco
          imagen={producto.imagen}
          alt={`${producto.nombre} — ${producto.categoria}`}
          tono={producto.tono}
          motivo={MOTIVOS[producto.categoria] ?? "sello"}
          className={grande ? "w-full flex-1 min-h-[16rem] sm:min-h-[22rem]" : "aspect-[5/4] w-full"}
        />

        {/* En la destacada el texto NO crece: si los dos crecen, se reparten el
            hueco y la tarjeta grande vuelve a terminar en medio metro de papel
            en blanco debajo del botón. */}
        <div className={`flex flex-col p-6 ${grande ? "" : "flex-1"}`}>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--arte-oro)]">
            {producto.categoria}
          </p>
          <h3
            className={`mt-2 font-serif text-[var(--arte-tinta)] ${grande ? "text-3xl" : "text-2xl"}`}
          >
            {producto.nombre}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[var(--arte-texto-suave)]">
            {producto.descripcion}
          </p>
          <p className="mt-4 border-t border-[var(--arte-borde)] pt-4 text-xs leading-relaxed text-[var(--arte-texto-suave)]">
            {producto.detalle}
          </p>

          <button
            type="button"
            onClick={() => pedir({ asunto: "informacion", producto: producto.nombre })}
            className="group mt-6 inline-flex items-center gap-2 self-start text-sm font-semibold text-[var(--arte-azul)] transition-colors hover:text-[var(--arte-oro)]"
          >
            Solicitar información
            <span
              aria-hidden="true"
              className="inline-block transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </button>
        </div>
      </div>
    </Revelar>
  );
}

export default function Catalogo() {
  const [categoria, setCategoria] = useState<string | null>(null);
  const lista = ordenados(categoria ?? undefined);

  return (
    <section id="productos" className="relative bg-[var(--arte-hueso)] py-24 sm:py-32" aria-labelledby="productos-titulo">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Revelar>
              <p className="arte-ojal">Catálogo</p>
            </Revelar>
            <Revelar retraso={90}>
              <h2 id="productos-titulo" className="arte-titulo mt-6 max-w-[16ch] text-[var(--arte-tinta)]">
                Piezas pensadas para <em className="arte-realce">vender bien</em>.
              </h2>
            </Revelar>
          </div>
          <Revelar retraso={160}>
            <p className="arte-cuerpo max-w-sm lg:text-right">
              Todo se sirve al por mayor, con mínimos por referencia y posibilidad de
              personalizar embalaje y etiqueta con tu marca.
            </p>
          </Revelar>
        </div>

        {/* El filtro. `aria-pressed` porque son botones que se quedan pulsados:
            sin él, quien usa lector de pantalla no sabe cuál está activo. */}
        <Revelar retraso={200}>
          <div className="mt-12 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
            <button
              type="button"
              onClick={() => setCategoria(null)}
              aria-pressed={categoria === null}
              className={`rounded-full border px-5 py-2 text-sm font-medium transition-all duration-300 ${
                categoria === null
                  ? "border-[var(--arte-tinta)] bg-[var(--arte-tinta)] text-[var(--arte-crema)]"
                  : "border-[var(--arte-borde)] text-[var(--arte-texto-suave)] hover:border-[var(--arte-oro)] hover:text-[var(--arte-tinta)]"
              }`}
            >
              Todo
            </button>
            {CATEGORIAS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoria(c)}
                aria-pressed={categoria === c}
                className={`rounded-full border px-5 py-2 text-sm font-medium transition-all duration-300 ${
                  categoria === c
                    ? "border-[var(--arte-tinta)] bg-[var(--arte-tinta)] text-[var(--arte-crema)]"
                    : "border-[var(--arte-borde)] text-[var(--arte-texto-suave)] hover:border-[var(--arte-oro)] hover:text-[var(--arte-tinta)]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </Revelar>

        <div
          key={categoria ?? "todo"}
          className="mt-10 grid auto-rows-[auto] gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {lista.map((p, i) => (
            <Tarjeta key={p.id} producto={p} retraso={i * 70} />
          ))}
        </div>

        <Revelar retraso={120}>
          <div className="mt-14 flex flex-col items-center gap-4 rounded-[1.5rem] border border-[var(--arte-borde)] bg-[var(--arte-crema)] px-8 py-10 text-center">
            <p className="font-serif text-2xl text-[var(--arte-tinta)]">
              El catálogo completo tiene más referencias de las que caben aquí.
            </p>
            <p className="arte-cuerpo max-w-xl">
              Te lo mandamos en PDF con precios por volumen, mínimos y plazos de entrega.
            </p>
            <button type="button" onClick={() => pedir({ asunto: "catalogo" })} className="arte-boton mt-2">
              Solicitar catálogo completo
            </button>
          </div>
        </Revelar>
      </div>
    </section>
  );
}
