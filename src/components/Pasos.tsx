"use client";

import * as Icon from "./Icons";
import type { Paso } from "@/lib/types";

/**
 * Qué está haciendo ECLIPSE, paso a paso.
 *
 * Cuando una respuesta tarda veinte segundos porque está buscando en cuatro
 * sitios, el silencio se parece demasiado a estar roto. Esto lo cuenta: qué
 * herramienta, sobre qué, y si salió bien. Se queda guardado en el mensaje,
 * así que al volver a la conversación sigue estando el rastro de cómo se llegó
 * a esa respuesta, que es la diferencia entre creérsela y tener que fiarse.
 */

const NOMBRES: Record<string, string> = {
  buscar_web: "Buscando",
  crear_archivo: "Creando archivo",
};

function Icono({ nombre, ok }: { nombre: string; ok?: boolean }) {
  if (ok === false) return <Icon.Close width={12} height={12} className="text-danger" />;
  if (ok === true) return <Icon.Check width={12} height={12} className="text-ok" />;

  const Base = nombre === "crear_archivo" ? Icon.Download : Icon.Search;
  return <Base width={12} height={12} className="animate-pulse text-halo" />;
}

export default function Pasos({ pasos, vivos = false }: { pasos: Paso[]; vivos?: boolean }) {
  if (pasos.length === 0) return null;

  return (
    <ul
      className={`space-y-1.5 ${vivos ? "animate-fade-up" : ""}`}
      aria-label="Lo que ha hecho ECLIPSE"
      // Mientras trabaja se va anunciando; terminado, ya no molesta al lector.
      aria-live={vivos ? "polite" : "off"}
    >
      {pasos.map((p, i) => (
        <li key={`${p.nombre}-${i}`} className="flex items-start gap-2 text-[12px] leading-snug">
          <span className="mt-[3px] shrink-0">
            <Icono nombre={p.nombre} ok={p.ok} />
          </span>
          <span className="min-w-0 text-muted">
            <span className="text-ink">{NOMBRES[p.nombre] ?? p.nombre}</span>
            {p.detalle && <span className="text-faint"> · {p.detalle}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
