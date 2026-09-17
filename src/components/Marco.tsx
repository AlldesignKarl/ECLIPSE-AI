import type { Tono } from "@/lib/productos";

/**
 * El hueco de una fotografía, con o sin fotografía dentro.
 * ---------------------------------------------------------------------------
 * Mientras no haya fotos de producto —y hoy no las hay— pinta una lámina de
 * color con su motivo y su grano. La diferencia con un rectángulo gris no es
 * estética: un sitio con huecos grises parece roto, y a una empresa que entra a
 * comprar al por mayor le importa lo que parece.
 *
 * El día que lleguen las fotos se cambia `imagen: null` por una ruta en
 * `lib/productos.ts` y esto pinta la foto. Ni un componente cambia.
 *
 * Se usa `<img>` y no `next/image` a propósito: las fotos las va a poner una
 * persona, no un desarrollador, y pueden acabar en `public/` o en un servidor
 * de otro sitio. `next/image` con un dominio ajeno sin declarar no falla en
 * desarrollo y sí en producción, que es el peor sitio donde enterarse. Lo que
 * de verdad cuesta —cargar lo que no se ve— lo arregla `loading="lazy"`.
 */

/** El motivo de oficio que se dibuja en la lámina cuando no hay foto. */
export type Motivo = "torno" | "telar" | "sello" | "arco";

function Dibujo({ motivo }: { motivo: Motivo }) {
  const trazo = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg viewBox="0 0 200 200" className="relative h-[62%] w-[62%] opacity-35" aria-hidden="true">
      {motivo === "torno" && (
        <g {...trazo}>
          {/* Un torno: círculos que se van abriendo, como la pieza al girar */}
          {[18, 34, 50, 66, 82].map((r, i) => (
            <circle key={r} cx={100} cy={100} r={r} opacity={1 - i * 0.14} />
          ))}
          <path d="M100 18 L100 182 M18 100 L182 100" opacity={0.25} />
        </g>
      )}
      {motivo === "telar" && (
        <g {...trazo}>
          {Array.from({ length: 9 }, (_, i) => 30 + i * 17.5).map((v) => (
            <path key={`v${v}`} d={`M${v} 26 L${v} 174`} opacity={0.75} />
          ))}
          {Array.from({ length: 5 }, (_, i) => 44 + i * 28).map((h) => (
            <path key={`h${h}`} d={`M26 ${h} Q100 ${h - 14} 174 ${h}`} />
          ))}
        </g>
      )}
      {motivo === "sello" && (
        <g {...trazo}>
          <circle cx={100} cy={100} r={72} />
          <circle cx={100} cy={100} r={58} opacity={0.5} />
          <path d="M100 52 L118 88 L158 94 L129 122 L136 162 L100 143 L64 162 L71 122 L42 94 L82 88 Z" />
        </g>
      )}
      {motivo === "arco" && (
        <g {...trazo}>
          <path d="M42 176 L42 96 Q100 36 158 96 L158 176" />
          <path d="M66 176 L66 106 Q100 70 134 106 L134 176" opacity={0.6} />
          <path d="M28 176 L172 176" />
        </g>
      )}
    </svg>
  );
}

export default function Marco({
  imagen,
  alt,
  tono = "azul",
  motivo = "sello",
  className = "",
  prioridad = false,
}: {
  imagen: string | null;
  /** Lo que se leería en voz alta. Obligatorio: una imagen sin alt no existe
   *  para quien usa lector de pantalla, y Google la lee igual. */
  alt: string;
  tono?: Tono;
  motivo?: Motivo;
  className?: string;
  /** La de la portada se carga cuanto antes; las demás cuando toque. */
  prioridad?: boolean;
}) {
  return (
    <div className={`arte-marco arte-grano ${className}`}>
      {imagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imagen}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          loading={prioridad ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={prioridad ? "high" : "auto"}
        />
      ) : (
        <div className="arte-lamina" data-tono={tono} role="img" aria-label={alt}>
          {/* Viñeta y filo interior. Son dos capas de nada y son lo que separa
              un degradado plano de algo que parece una lámina impresa. */}
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 20%, transparent 40%, rgba(10,20,48,0.38) 100%)",
            }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-3 rounded-[0.6rem] border border-white/15 sm:inset-5"
          />
          <Dibujo motivo={motivo} />
          {process.env.NODE_ENV !== "production" && (
            <span className="absolute bottom-2 right-3 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white/80">
              foto pendiente
            </span>
          )}
        </div>
      )}
    </div>
  );
}
