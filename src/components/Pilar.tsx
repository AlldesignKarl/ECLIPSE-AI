"use client";

import { useEscenaFija } from "./movimiento";

/**
 * El Pilar, dibujándose mientras bajas.
 * ---------------------------------------------------------------------------
 * Es la escena que pidió Carlos: bajas —con el ratón o con el dedo, da igual—
 * y la basílica se va trazando sola, línea a línea, hasta encenderse en oro.
 * No hay vídeo, no hay foto y no hay librería de animación: son caminos SVG con
 * `pathLength="1"` cuyo `stroke-dashoffset` cuelga de una variable CSS que se
 * mueve con el scroll. Pesa menos de lo que ocupa esta explicación.
 *
 * La escena mide cinco pantallas de alto y por dentro va un `sticky`: lo que se
 * mueve no es el dibujo, es la página por detrás. Por eso funciona igual con
 * dedo, con rueda, con barra espaciadora o con las flechas del teclado, sin
 * secuestrar el scroll de nadie —que es lo que hace insoportables la mitad de
 * las webs que intentan esto—.
 */

/** Una torre con su chapitel, dibujada de una sola pasada. */
function Torre({ x, alto, i, f }: { x: number; alto: number; i: number; f: number }) {
  const w = 26;
  return (
    <>
      <path
        className="trazo"
        style={{ ["--i" as string]: i, ["--f" as string]: f }}
        pathLength={1}
        d={`M${x - w} 340 L${x - w} ${alto + 34} L${x} ${alto} L${x + w} ${alto + 34} L${x + w} 340`}
      />
      <path
        className="trazo"
        style={{ ["--i" as string]: f - 0.02, ["--f" as string]: f + 0.03 }}
        pathLength={1}
        d={`M${x - w - 5} ${alto + 34} L${x + w + 5} ${alto + 34}`}
      />
      <circle
        className="trazo"
        style={{ ["--i" as string]: f, ["--f" as string]: f + 0.04 }}
        pathLength={1}
        cx={x}
        cy={alto - 9}
        r={5}
      />
    </>
  );
}

/** Una cúpula con su tambor. */
function Cupula({ x, r, i, f }: { x: number; r: number; i: number; f: number }) {
  return (
    <>
      <path
        className="trazo"
        style={{ ["--i" as string]: i, ["--f" as string]: f }}
        pathLength={1}
        d={`M${x - r} 300 Q${x - r} ${300 - r * 1.45} ${x} ${300 - r * 1.75} Q${x + r} ${300 - r * 1.45} ${x + r} 300`}
      />
      <path
        className="trazo"
        style={{ ["--i" as string]: i + 0.01, ["--f" as string]: f + 0.02 }}
        pathLength={1}
        d={`M${x - r - 6} 300 L${x + r + 6} 300`}
      />
    </>
  );
}

const ARCOS = Array.from({ length: 12 }, (_, i) => 210 + i * 62);

export default function Pilar() {
  const { contenedor } = useEscenaFija<HTMLDivElement>();

  return (
    <section
      id="pilar"
      ref={contenedor}
      className="escena arte-noche relative"
      style={{ height: "500vh" }}
      aria-labelledby="pilar-titulo"
    >
      {/* Lo que se queda quieto mientras la página sigue bajando */}
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="arte-grano pointer-events-none absolute inset-0" />

        {/* El halo, que crece con la escena */}
        <div
          className="acerca pointer-events-none absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(232,207,132,0.28), rgba(201,162,39,0.1) 45%, transparent 70%)",
            opacity: "calc(0.25 + var(--p) * 0.75)",
          }}
        />

        {/* Seis chispas de polvo en suspensión. Seis, no mil: esto tiene que ir
            fino en un móvil de hace cuatro años. */}
        {[
          [14, 26, 0],
          [78, 18, 1.4],
          [32, 72, 2.8],
          [88, 64, 0.7],
          [58, 12, 3.6],
          [8, 58, 2.1],
        ].map(([x, y, retraso]) => (
          <span
            key={`${x}-${y}`}
            aria-hidden="true"
            className="chispa pointer-events-none absolute h-1 w-1 rounded-full bg-[var(--arte-oro-claro)]"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${retraso}s` }}
          />
        ))}

        {/* El dibujo */}
        {/* El dibujo vive en la mitad de abajo y con ALTURA fija (`h-[40vh]`).
            Con altura automática crecía con el ancho de la pantalla y en un
            portátil se comía el texto de arriba. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[16vh] px-4 sm:bottom-[9vh]">
          <svg
            viewBox="0 0 1200 420"
            className="mx-auto h-[40vh] w-full max-w-5xl scale-[1.3] text-[var(--arte-oro-claro)] sm:scale-100"
            strokeWidth={1.6}
            aria-hidden="true"
          >
            {/* El suelo y el cuerpo */}
            <path className="trazo" style={{ ["--i" as string]: 0.04, ["--f" as string]: 0.16 }} pathLength={1} d="M120 340 L1080 340" />
            <path className="trazo" style={{ ["--i" as string]: 0.1, ["--f" as string]: 0.22 }} pathLength={1} d="M170 300 L1030 300" />

            {/* Los arcos de la fachada */}
            {ARCOS.map((x, n) => (
              <path
                key={x}
                className="trazo"
                style={{ ["--i" as string]: 0.16 + n * 0.008, ["--f" as string]: 0.22 + n * 0.008 }}
                pathLength={1}
                d={`M${x} 340 L${x} 318 Q${x + 18} 302 ${x + 36} 318 L${x + 36} 340`}
              />
            ))}

            {/* Las cuatro torres */}
            <Torre x={215} alto={120} i={0.3} f={0.42} />
            <Torre x={380} alto={86} i={0.34} f={0.46} />
            <Torre x={820} alto={86} i={0.38} f={0.5} />
            <Torre x={985} alto={120} i={0.42} f={0.54} />

            {/* Las cúpulas */}
            <Cupula x={600} r={70} i={0.52} f={0.66} />
            <Cupula x={470} r={34} i={0.58} f={0.68} />
            <Cupula x={730} r={34} i={0.6} f={0.7} />

            {/* La linterna y la cruz de arriba del todo */}
            <path className="trazo" style={{ ["--i" as string]: 0.66, ["--f" as string]: 0.72 }} pathLength={1} d="M582 178 L582 152 L618 152 L618 178" />
            <path className="trazo" style={{ ["--i" as string]: 0.7, ["--f" as string]: 0.76 }} pathLength={1} d="M600 152 L600 126 M588 138 L612 138" />

            {/* El Ebro */}
            <path className="trazo" style={{ ["--i" as string]: 0.74, ["--f" as string]: 0.88 }} pathLength={1} d="M100 372 C320 362 520 384 740 370 C920 358 1060 376 1130 366" opacity={0.75} />
            <path className="trazo" style={{ ["--i" as string]: 0.78, ["--f" as string]: 0.92 }} pathLength={1} d="M200 392 C400 384 620 400 820 390" opacity={0.5} />
            <path className="trazo" style={{ ["--i" as string]: 0.82, ["--f" as string]: 0.96 }} pathLength={1} d="M340 408 C520 402 700 414 880 406" opacity={0.35} />
          </svg>
        </div>

        {/* Las tres frases, que se relevan, en la mitad de arriba */}
        <div className="absolute inset-x-0 top-[15vh] z-10 px-6 text-center sm:top-[18vh]">
          <h2 id="pilar-titulo" className="sr-only">
            Zaragoza y la basílica del Pilar
          </h2>

          <p
            className="tramo arte-ojal justify-center"
            style={{ ["--i" as string]: 0.02, ["--f" as string]: 0.1, ["--oi" as string]: 0.22, ["--of" as string]: 0.3 }}
          >
            De dónde sale todo
          </p>

          <p
            className="tramo arte-display absolute inset-x-0 top-0 mx-auto max-w-[14ch] text-[var(--arte-texto-claro)]"
            style={{ ["--i" as string]: 0.06, ["--f" as string]: 0.16, ["--oi" as string]: 0.26, ["--of" as string]: 0.34 }}
          >
            Aquí empieza todo.
          </p>

          <p
            className="tramo arte-titulo absolute inset-x-0 top-0 mx-auto max-w-[18ch] text-[var(--arte-texto-claro)]"
            style={{ ["--i" as string]: 0.4, ["--f" as string]: 0.5, ["--oi" as string]: 0.64, ["--of" as string]: 0.72 }}
          >
            Cuatro torres, una cúpula y un río.
          </p>

          <p
            className="tramo arte-titulo absolute inset-x-0 top-0 mx-auto max-w-[20ch] text-[var(--arte-texto-claro)]"
            style={{ ["--i" as string]: 0.8, ["--f" as string]: 0.9 }}
          >
            Lo que sale de aquí, lleva la <em className="arte-realce">ciudad</em> dentro.
          </p>
        </div>

        {/* Cuánto queda de escena. Sin esto, una sección de cinco pantallas se
            siente como un scroll roto: pasa algo pero no sabes cuánto falta. */}
        <div className="absolute bottom-8 left-1/2 h-px w-24 -translate-x-1/2 bg-white/15" aria-hidden="true">
          <span
            className="block h-px bg-[var(--arte-oro)]"
            style={{ width: "calc(var(--p) * 100%)" }}
          />
        </div>
      </div>
    </section>
  );
}
