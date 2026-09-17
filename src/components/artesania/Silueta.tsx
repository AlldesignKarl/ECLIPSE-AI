/**
 * La silueta de la ciudad, dibujada.
 * ---------------------------------------------------------------------------
 * Es una interpretación —torres, cúpulas y el río— y no el calco de ningún
 * edificio: la web tiene que tener identidad propia, no ser una postal.
 *
 * Va en SVG y no en fotografía por dos motivos que se notan: pesa poco más de
 * un kilobyte y se pinta con `currentColor`, así que la misma pieza sirve en
 * oro sobre la sección nocturna y en azul sobre la crema sin duplicar archivos.
 * Y no cuesta ni una petición de red, que es justo lo que se paga en una
 * portada a pantalla completa.
 */

/** Una torre con su chapitel y su bola. */
function Torre({ x, alto, ancho = 42 }: { x: number; alto: number; ancho?: number }) {
  const mitad = ancho / 2;
  const base = 230;
  return (
    <g>
      <path d={`M${x - mitad} ${base} L${x - mitad} ${alto + 34} L${x} ${alto} L${x + mitad} ${alto + 34} L${x + mitad} ${base} Z`} />
      <circle cx={x} cy={alto - 9} r={5} />
      <rect x={x - mitad - 4} y={alto + 34} width={ancho + 8} height={7} rx={2} />
      {/* Los dos vanos: sin ellos una torre es un triángulo sobre un rectángulo. */}
      <rect x={x - 7} y={alto + 56} width={14} height={26} rx={7} opacity={0.45} />
      <rect x={x - 7} y={alto + 100} width={14} height={26} rx={7} opacity={0.45} />
    </g>
  );
}

/** Una cúpula con su linterna. */
function Cupula({ x, base, r, linterna = true }: { x: number; base: number; r: number; linterna?: boolean }) {
  return (
    <g>
      <path
        d={`M${x - r} ${base} Q${x - r} ${base - r * 1.45} ${x} ${base - r * 1.75} Q${x + r} ${base - r * 1.45} ${x + r} ${base} Z`}
      />
      {linterna && (
        <>
          <rect x={x - r * 0.26} y={base - r * 2.25} width={r * 0.52} height={r * 0.55} rx={2} />
          <circle cx={x} cy={base - r * 2.42} r={r * 0.15} />
        </>
      )}
      <rect x={x - r - 5} y={base - 3} width={r * 2 + 10} height={8} rx={3} />
    </g>
  );
}

export default function Silueta({
  className = "",
  conRio = true,
  "aria-hidden": oculta = true,
}: {
  className?: string;
  conRio?: boolean;
  "aria-hidden"?: boolean;
}) {
  // Los arcos de la fachada, repetidos. Escritos a mano serían treinta líneas
  // iguales y un número mal puesto no se vería.
  const arcos = Array.from({ length: 13 }, (_, i) => 200 + i * 62);

  return (
    <svg
      viewBox="0 0 1200 300"
      className={className}
      fill="currentColor"
      aria-hidden={oculta}
      role={oculta ? undefined : "img"}
      preserveAspectRatio="xMidYMax meet"
    >
      {!oculta && <title>Silueta de las torres y cúpulas de la ciudad</title>}

      {/* El cuerpo del edificio */}
      <rect x={150} y={228} width={900} height={52} />
      {arcos.map((x) => (
        <path
          key={x}
          d={`M${x} 280 L${x} 252 Q${x + 15} 238 ${x + 30} 252 L${x + 30} 280 Z`}
          opacity={0.35}
        />
      ))}

      {/* Las cuatro torres, las de fuera más bajas: da profundidad */}
      <Torre x={196} alto={92} />
      <Torre x={372} alto={62} />
      <Torre x={828} alto={62} />
      <Torre x={1004} alto={92} />

      {/* Las cúpulas: la grande en el centro y dos escoltas */}
      <Cupula x={600} base={228} r={62} />
      <Cupula x={470} base={232} r={34} />
      <Cupula x={730} base={232} r={34} />
      <Cupula x={530} base={236} r={20} linterna={false} />
      <Cupula x={670} base={236} r={20} linterna={false} />

      {conRio && (
        <>
          {/* El río: el reflejo invertido y en trazos, que es como se ve el agua */}
          <g opacity={0.22}>
            <rect x={150} y={284} width={900} height={3} rx={1.5} />
            <rect x={230} y={292} width={420} height={2} rx={1} />
            <rect x={700} y={292} width={260} height={2} rx={1} />
            <rect x={320} y={298} width={520} height={2} rx={1} />
          </g>
        </>
      )}
    </svg>
  );
}
