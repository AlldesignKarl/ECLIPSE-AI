"use client";

interface Props {
  size?: number;
  /** Cuando está activo, el eclipse gira y las llamaradas laten. */
  active?: boolean;
  className?: string;
  title?: string;
}

/**
 * El logo de ECLIPSE, redibujado en SVG para que se vea nítido a cualquier
 * tamaño y pueda animarse mientras la IA trabaja.
 */
export default function EclipseLogo({ size = 28, active = false, className = "", title }: Props) {
  // Llamarada horizontal: punta afilada fuera y cuerpo grueso donde toca el anillo.
  const flare =
    "M 2 120 C 44 118.4, 62 114, 70 99 C 75.5 110.5, 75.5 129.5, 70 141 C 62 126, 44 121.6, 2 120 Z";

  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <radialGradient id="ecl-glow" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="80%" stopColor="#cfd6e6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#cfd6e6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ecl-flare" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="22%" stopColor="#e8ecf3" stopOpacity="0.72" />
          <stop offset="55%" stopColor="#f6f8fb" stopOpacity="0.96" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Halo exterior, solo visible cuando trabaja */}
      <circle
        cx="120"
        cy="120"
        r="74"
        fill="url(#ecl-glow)"
        style={
          active
            ? { animation: "eclipse-pulse 2.2s ease-in-out infinite", transformOrigin: "120px 120px" }
            : { opacity: 0.35 }
        }
      />

      {/* Llamaradas horizontales */}
      <g
        style={
          active
            ? {
                animation: "flare-breathe 2.2s ease-in-out infinite",
                transformOrigin: "120px 120px",
              }
            : undefined
        }
      >
        <path d={flare} fill="url(#ecl-flare)" />
        <path d={flare} fill="url(#ecl-flare)" transform="translate(240,0) scale(-1,1)" />
      </g>

      {/* Anillo principal */}
      <circle cx="120" cy="120" r="58" fill="none" stroke="currentColor" strokeWidth="10" />

      {/* Arco que gira mientras piensa */}
      {active && (
        <circle
          cx="120"
          cy="120"
          r="58"
          fill="none"
          stroke="var(--color-void)"
          strokeWidth="10.5"
          strokeLinecap="round"
          strokeDasharray="26 338"
          style={{
            animation: "eclipse-spin 1.15s linear infinite",
            transformOrigin: "120px 120px",
          }}
        />
      )}
    </svg>
  );
}
