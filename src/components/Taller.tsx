"use client";

import { useEscenaFija } from "./movimiento";

/**
 * Cómo se hace una pieza, contado con el scroll.
 * ---------------------------------------------------------------------------
 * Cinco escenas que se van relevando mientras bajas, con la ilustración
 * dibujándose sola cada vez que entra una. Es lo que pidió Carlos: que al bajar
 * se vea cómo se fabrican las cosas.
 *
 * Los dibujos son de línea y están hechos aquí, no son fotos. Dos motivos: no
 * hay fotos del taller todavía, y una ilustración de trazo se puede DIBUJAR
 * delante de quien mira, que es justo el efecto que cuenta un oficio. Cuando
 * haya fotografías reales, cada escena admite una encima sin tocar el resto.
 *
 * La escena mide seis pantallas: 1,2 por paso. Menos se pasa de largo sin leer
 * y más se hace pesado en un móvil, que es donde entra Carlos.
 */

const TRAZO = {
  className: "trazo-paso",
  pathLength: 1,
} as const;

/** Un trazo del dibujo, con su turno dentro de la animación. */
function T({ d, retraso, cerrado }: { d: string; retraso: number; cerrado?: boolean }) {
  return (
    <path
      {...TRAZO}
      d={d}
      style={{ ["--retraso" as string]: `${retraso}ms` }}
      strokeLinejoin={cerrado ? "round" : undefined}
    />
  );
}

function Materia() {
  return (
    <>
      {/* El bloque de barro */}
      <T d="M34 150 L34 108 Q34 96 48 96 L96 96 Q110 96 110 108 L110 150 Z" retraso={0} cerrado />
      <T d="M34 122 Q72 132 110 122" retraso={161} />
      {/* La madeja de lino */}
      <T d="M138 86 m-26 0 a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0" retraso={260} />
      <T d="M116 74 Q138 88 160 74 M116 92 Q138 78 160 92" retraso={396} />
      {/* Los pliegos de papel */}
      <T d="M126 122 L178 132 L170 172 L118 162 Z" retraso={508} cerrado />
      <T d="M132 142 L166 148 M130 154 L162 160" retraso={632} />
      <T d="M24 172 L180 172" retraso={731} />
    </>
  );
}

function Torno() {
  return (
    <>
      {/* La rueda */}
      <T d="M100 132 m-64 0 a64 64 0 1 0 128 0 a64 64 0 1 0 -128 0" retraso={0} />
      <T d="M100 132 m-42 0 a42 42 0 1 0 84 0 a42 42 0 1 0 -84 0" retraso={136} />
      <T d="M100 132 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0" retraso={248} />
      {/* La pieza levantándose */}
      <T d="M76 118 Q68 78 88 56 Q100 46 112 56 Q132 78 124 118" retraso={347} />
      <T d="M88 56 Q100 64 112 56" retraso={471} />
      {/* Las manos */}
      <T d="M40 96 Q58 86 72 96 Q64 112 46 110 Z" retraso={558} cerrado />
      <T d="M160 96 Q142 86 128 96 Q136 112 154 110 Z" retraso={632} cerrado />
    </>
  );
}

function Decorado() {
  return (
    <>
      {/* El azulejo */}
      <T d="M44 60 L156 60 L156 172 L44 172 Z" retraso={0} cerrado />
      <T d="M56 72 L144 72 L144 160 L56 160 Z" retraso={136} />
      {/* El motivo, pintado a mano */}
      <T d="M100 88 L110 110 L134 113 L116 129 L121 153 L100 141 L79 153 L84 129 L66 113 L90 110 Z" retraso={260} cerrado />
      {/* El pincel */}
      <T d="M150 46 L178 18 L190 30 L162 58 Z" retraso={471} cerrado />
      <T d="M150 46 L138 70 L162 58 Z" retraso={595} cerrado />
    </>
  );
}

function Horno() {
  return (
    <>
      <T d="M36 172 L36 96 Q100 36 164 96 L164 172 Z" retraso={0} cerrado />
      <T d="M60 172 L60 112 Q100 76 140 112 L140 172" retraso={173} />
      <T d="M24 172 L176 172" retraso={322} />
      {/* El calor */}
      <T d="M84 148 Q76 134 84 122 Q92 110 84 98" retraso={434} />
      <T d="M100 152 Q92 136 100 122 Q108 108 100 94" retraso={533} />
      <T d="M116 148 Q108 134 116 122 Q124 110 116 98" retraso={632} />
    </>
  );
}

function Embalaje() {
  return (
    <>
      {/* La caja abierta */}
      <T d="M40 96 L100 72 L160 96 L160 156 L100 180 L40 156 Z" retraso={0} cerrado />
      <T d="M40 96 L100 120 L160 96 M100 120 L100 180" retraso={186} />
      {/* La pieza dentro, envuelta */}
      <T d="M84 70 Q84 44 100 36 Q116 44 116 70" retraso={384} />
      {/* La cinta y la etiqueta */}
      <T d="M100 120 L100 180" retraso={508} />
      <T d="M126 140 L150 132 L150 150 L126 158 Z" retraso={607} cerrado />
      <T d="M132 142 L144 138" retraso={706} />
    </>
  );
}

const PASOS = [
  {
    numero: "01",
    titulo: "La materia",
    texto:
      "Barro, lino, papel de algodón, metal. Se elige antes de empezar, porque una pieza no puede ser mejor que aquello de lo que está hecha.",
    dibujo: <Materia />,
  },
  {
    numero: "02",
    titulo: "La forma",
    texto:
      "Torno, molde o costura, según la pieza. Aquí es donde se nota la mano: dos piezas de la misma serie nunca son idénticas, y esa es la gracia.",
    dibujo: <Torno />,
  },
  {
    numero: "03",
    titulo: "El decorado",
    texto:
      "El motivo se pinta a mano, uno por uno. El del manto y el de la basílica son los que más nos piden, y son también los que más tiempo llevan.",
    dibujo: <Decorado />,
  },
  {
    numero: "04",
    titulo: "El horno",
    texto:
      "Cocción, secado o curado. Es el paso que no perdona: lo que sale mal, sale fuera. Por eso las series son cortas y los plazos, los que decimos.",
    dibujo: <Horno />,
  },
  {
    numero: "05",
    titulo: "El embalaje",
    texto:
      "Se revisa pieza a pieza y se embala pensando en el viaje y en tu estantería. Con su etiqueta, lista para poner a la venta el mismo día que llega.",
    dibujo: <Embalaje />,
  },
];

export default function Taller() {
  const { contenedor, paso } = useEscenaFija<HTMLDivElement>(PASOS.length);

  return (
    <section
      id="taller"
      ref={contenedor}
      className="escena arte-crema-fondo relative"
      style={{ height: `${PASOS.length * 120}vh` }}
      aria-labelledby="taller-titulo"
    >
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className="arte-trama pointer-events-none absolute inset-0 opacity-50" />

        <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* El dibujo */}
          <div className="relative mx-auto aspect-square w-[62vw] max-w-md sm:w-[46vw] lg:w-full">
            <div className="absolute inset-0 rounded-[2rem] border border-[var(--arte-borde)] bg-[var(--arte-hueso)] shadow-[var(--arte-sombra)]" />
            {PASOS.map((p, i) => (
              <svg
                key={p.numero}
                viewBox="0 0 200 200"
                className={`absolute inset-0 h-full w-full p-6 text-[var(--arte-azul)] transition-opacity duration-500 ${
                  i === paso ? "escena-activa opacity-100" : "opacity-0"
                }`}
                strokeWidth={1.6}
                aria-hidden={i !== paso}
                role={i === paso ? "img" : undefined}
                aria-label={i === paso ? `${p.titulo}: ilustración del paso` : undefined}
              >
                {p.dibujo}
              </svg>
            ))}

            {/* El número, grande y DETRÁS de la tarjeta (`-z-10`): solo asoma
                el trozo que sobresale. Por delante se comía el dibujo. */}
            <span
              aria-hidden="true"
              className="absolute -bottom-8 -right-4 -z-10 hidden font-serif sm:block text-[6rem] leading-none text-[var(--arte-oro)] opacity-40 transition-all duration-500 sm:-right-10 sm:text-[10rem]"
            >
              {PASOS[paso].numero}
            </span>
          </div>

          {/* El texto */}
          <div>
            <p className="arte-ojal">Cómo se hace</p>
            <h2 id="taller-titulo" className="arte-titulo mt-5 max-w-[14ch] text-[var(--arte-tinta)]">
              De la <em className="arte-realce">materia</em> a tu tienda.
            </h2>

            {/* Cada paso se sustituye en su sitio: sin saltos de altura, que es
                lo que haría que la página diera botes al cambiar de escena. */}
            <div className="relative mt-8 min-h-[13rem] sm:min-h-[11rem]">
              {PASOS.map((p, i) => (
                <div
                  key={p.numero}
                  className={`absolute inset-0 transition-all duration-500 ${
                    i === paso ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
                  }`}
                  aria-hidden={i !== paso}
                >
                  <h3 className="arte-subtitulo text-[var(--arte-tinta)]">
                    <span className="mr-3 text-sm font-semibold tracking-[0.2em] text-[var(--arte-oro)]">
                      {p.numero}
                    </span>
                    {p.titulo}
                  </h3>
                  <p className="arte-cuerpo mt-4 max-w-md">{p.texto}</p>
                </div>
              ))}
            </div>

            {/* Los cinco tramos: cuál va y cuánto queda */}
            <ol className="mt-8 flex gap-2" aria-label="Pasos de fabricación">
              {PASOS.map((p, i) => (
                <li key={p.numero} className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--arte-borde)]">
                  <span
                    className={`block h-full bg-[var(--arte-oro)] transition-all duration-500 ${
                      i < paso ? "w-full" : i === paso ? "w-1/2" : "w-0"
                    }`}
                  />
                  <span className="sr-only">
                    {p.numero} {p.titulo}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
