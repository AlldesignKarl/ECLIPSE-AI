import { monograma } from "@/lib/config";

/**
 * El sello de la marca: dos letras dentro de un anillo lacrado.
 *
 * Hace de logotipo mientras no haya uno de verdad, y cuando lo haya se cambia
 * este componente y ya está: la cabecera, el pie y el icono del formulario
 * salen todos de aquí.
 */
export default function Sello({ className = "", tamano = 40 }: { className?: string; tamano?: number }) {
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center ${className}`}
      style={{ width: tamano, height: tamano }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full">
        <circle cx="24" cy="24" r="22.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.55" />
        <circle
          cx="24"
          cy="24"
          r="19"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeDasharray="2 4"
          opacity="0.4"
        />
      </svg>
      <span
        className="font-serif leading-none"
        style={{ fontSize: tamano * 0.42, letterSpacing: "0.02em" }}
      >
        {monograma()}
      </span>
    </span>
  );
}
