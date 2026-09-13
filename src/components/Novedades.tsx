"use client";

import { useEffect, useState } from "react";
import EclipseMark from "./EclipseMark";
import * as Icon from "./Icons";
import { NOVEDADES, VERSION, type Novedad } from "@/lib/novedades";

/**
 * El aviso de que la aplicación ha cambiado.
 *
 * Sale una vez por versión y se cierra para siempre. Quien entra por primera
 * vez no lo ve: contarle "las novedades" a quien no conocía lo anterior es
 * ruido, así que la primera visita solo apunta la versión y calla.
 */

const CLAVE = "eclipse.version.vista";

export default function Novedades() {
  const [novedad, setNovedad] = useState<Novedad | null>(null);

  useEffect(() => {
    let vista: string | null = null;
    try {
      vista = window.localStorage.getItem(CLAVE);
      window.localStorage.setItem(CLAVE, VERSION);
    } catch {
      // Navegador sin almacenamiento: mejor callar que enseñarlo en cada carga.
      return;
    }

    if (!vista || vista === VERSION) return;
    setNovedad(NOVEDADES.find((n) => n.version === VERSION) ?? null);
  }, []);

  if (!novedad) return null;

  return (
    <div className="scroll-thin fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-void/70 p-3 backdrop-blur-sm sm:items-center">
      <div className="animate-fade-up relative w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)]">
        {/* Cabecera: el logo con su luz, que es lo que hace que esto parezca
            una noticia y no un aviso del sistema. */}
        <div className="relative overflow-hidden px-5 pb-5 pt-7 text-center">
          <div className="aurora pointer-events-none absolute inset-0" aria-hidden />

          <button
            onClick={() => setNovedad(null)}
            aria-label="Cerrar"
            className="absolute right-2.5 top-2.5 z-10 rounded-lg p-1.5 text-faint transition hover:text-ink"
          >
            <Icon.Close width={16} height={16} />
          </button>

          <div className="relative flex justify-center">
            <EclipseMark size={82} />
          </div>

          <p className="relative mt-4 text-[10.5px] uppercase tracking-[0.2em] text-faint">
            Actualización {novedad.version}
          </p>
          <p className="relative mt-1.5 font-serif text-[30px] leading-none text-ink">
            {novedad.nombre}
          </p>
          <h2 className="relative mt-3 text-[15.5px] font-semibold leading-snug text-ink">
            {novedad.titulo}
          </h2>
          <p className="relative mx-auto mt-2 max-w-[19rem] text-[13px] leading-relaxed text-muted">
            {novedad.entrada}
          </p>
        </div>

        <div className="border-t border-line-soft px-5 py-4">
          <ul className="space-y-2.5">
            {novedad.puntos.map((p) => (
              <li key={p} className="flex gap-2.5 text-[13px] leading-snug text-muted">
                <Icon.Check width={15} height={15} className="mt-0.5 shrink-0 text-ok" />
                <span>{p}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => setNovedad(null)}
            className="mt-5 w-full rounded-xl bg-ink py-2.5 text-[14px] font-medium text-void transition hover:opacity-90"
          >
            Empezar a usarlo
          </button>
        </div>
      </div>
    </div>
  );
}
