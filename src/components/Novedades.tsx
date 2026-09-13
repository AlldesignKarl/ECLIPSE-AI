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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-void/70 p-3 backdrop-blur-sm sm:items-center">
      <div className="animate-fade-up w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)]">
        <div className="flex items-start gap-3">
          <EclipseMark size={38} />
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-pro">
              Nueva versión · {novedad.version}
            </p>
            <h2 className="mt-1 text-[17px] font-semibold leading-snug text-ink">
              {novedad.titulo}
            </h2>
          </div>
          <button
            onClick={() => setNovedad(null)}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1.5 text-faint transition hover:text-ink"
          >
            <Icon.Close width={16} height={16} />
          </button>
        </div>

        <ul className="mt-4 space-y-2.5">
          {novedad.puntos.map((p) => (
            <li key={p} className="flex gap-2.5 text-[13.5px] leading-snug text-muted">
              <Icon.Check width={15} height={15} className="mt-0.5 shrink-0 text-ok" />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => setNovedad(null)}
          className="mt-5 w-full rounded-xl bg-ink py-2.5 text-[14px] font-medium text-void transition hover:opacity-90"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
