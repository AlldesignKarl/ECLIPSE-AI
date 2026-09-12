"use client";

/**
 * El eclipse en grande, con luz saliendo por detrás.
 *
 * La luz no gira: cruza muy despacio de un lado a otro, como un foco lejano
 * que se mueve. Girar llamaba demasiado la atención y competía con el logo.
 */
export default function EclipseMark({
  size = 180,
  /**
   * La luz de detrás solo tiene sentido en grande. En el logo de la barra, un
   * resplandor de dos veces su tamaño no parece luz: parece una mancha.
   */
  glow = size >= 80,
}: {
  size?: number;
  glow?: boolean;
}) {
  const flare =
    "M 2 120 C 44 118.4, 62 114, 70 99 C 75.5 110.5, 75.5 129.5, 70 141 C 62 126, 44 121.6, 2 120 Z";

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* La luz que sale por detrás */}
      {glow ? (
        <>
          <div className="eclipse-backlight eclipse-bloom rounded-full" />
          <div className="eclipse-backlight eclipse-streak rounded-full" />
          <div className="eclipse-backlight eclipse-rim rounded-full" />
        </>
      ) : (
        <div className="eclipse-halo absolute inset-0 rounded-full" />
      )}

      <svg viewBox="0 0 240 240" width={size} height={size} className="relative z-10">
        <defs>
          <linearGradient id="mark-flare" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="22%" stopColor="#e8ecf3" stopOpacity="0.72" />
            <stop offset="55%" stopColor="#f6f8fb" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
        </defs>

        <g className="eclipse-flares">
          <path d={flare} fill="url(#mark-flare)" />
          <path d={flare} fill="url(#mark-flare)" transform="translate(240,0) scale(-1,1)" />
        </g>

        <circle cx="120" cy="120" r="58" fill="none" stroke="#fff" strokeWidth="10" />
      </svg>
    </div>
  );
}
