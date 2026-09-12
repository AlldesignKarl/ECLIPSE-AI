"use client";

import type { ReactNode } from "react";
import * as Icon from "./Icons";

/**
 * Las capacidades de ECLIPSE contadas en grande.
 *
 * Cuatro tarjetas en una rejilla se leen de un vistazo y no se leen: la gente
 * pasa de largo. Así que cada capacidad ocupa su propio bloque, con su titular,
 * una maqueta de la pantalla real y la lista de lo que incluye. Se tarda más en
 * bajar, pero se entiende qué hace la aplicación sin tener que entrar.
 *
 * Las maquetas están dibujadas con HTML, no son capturas: pesan nada, se leen
 * nítidas en cualquier pantalla y no se quedan viejas cada vez que cambia un
 * color de la interfaz.
 */

/* ---------------------------------------------------------------- Piezas */

/** El marco de ventana en el que vive cada maqueta. */
function Ventana({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-2 border-b border-line-soft bg-panel/60 px-3.5 py-2.5">
        <span className="h-2 w-2 rounded-full bg-line" aria-hidden />
        <span className="h-2 w-2 rounded-full bg-line" aria-hidden />
        <span className="h-2 w-2 rounded-full bg-line" aria-hidden />
        <span className="ml-1.5 truncate text-[11px] text-faint">{titulo}</span>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

/** Lo que le escribe el usuario, arriba de cada maqueta. */
function Pregunta({ children }: { children: ReactNode }) {
  return (
    <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-raised px-3.5 py-2.5 text-[12.5px] leading-snug text-ink">
      {children}
    </div>
  );
}

/** Renglones grises que hacen de texto sin tener que escribir un párrafo falso. */
function Renglones({ anchos }: { anchos: string[] }) {
  return (
    <div className="space-y-2">
      {anchos.map((w, i) => (
        <div key={i} className="h-2 rounded-full bg-line-soft" style={{ width: w }} aria-hidden />
      ))}
    </div>
  );
}

function Respuesta({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex gap-2.5">
      <span className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border-[2.5px] border-halo/70" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------- Maquetas */

function MaquetaFuentes() {
  const fuentes = [
    { dominio: "nature.com", nivel: "Alta", ancho: "72%" },
    { dominio: "who.int", nivel: "Alta", ancho: "58%" },
    { dominio: "nih.gov", nivel: "Alta", ancho: "65%" },
  ];

  return (
    <Ventana titulo="ECLIPSE · Investigar">
      <Pregunta>¿Cuántas horas hay que dormir, según la evidencia?</Pregunta>

      <Respuesta>
        <Renglones anchos={["100%", "92%", "76%"]} />

        <div className="mt-4 rounded-xl border border-line-soft bg-panel/50 p-3">
          <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-faint">
            <Icon.Search width={12} height={12} />
            3 fuentes
          </div>

          <div className="mt-2.5 space-y-2">
            {fuentes.map((f) => (
              <div key={f.dominio} className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" aria-hidden />
                <span className="text-[11.5px] text-ink">{f.dominio}</span>
                <span className="h-1.5 flex-1 rounded-full bg-line-soft" style={{ maxWidth: f.ancho }} aria-hidden />
                <span className="shrink-0 rounded-full border border-line px-1.5 py-px text-[9.5px] text-muted">
                  {f.nivel}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Respuesta>
    </Ventana>
  );
}

function MaquetaArchivos() {
  const archivos = [
    { icono: Icon.Paperclip, nombre: "factura-marzo.pdf", peso: "184 KB" },
    { icono: Icon.Image, nombre: "pizarra.jpg", peso: "2,1 MB" },
  ];

  return (
    <Ventana titulo="ECLIPSE · Archivos">
      <div className="flex flex-wrap justify-end gap-2">
        {archivos.map((a) => (
          <div
            key={a.nombre}
            className="flex items-center gap-2 rounded-xl border border-line bg-raised px-2.5 py-2"
          >
            <a.icono width={14} height={14} className="shrink-0 text-halo" />
            <span className="text-[11.5px] text-ink">{a.nombre}</span>
            <span className="text-[10px] text-faint">{a.peso}</span>
          </div>
        ))}
      </div>

      <div className="mt-2.5">
        <Pregunta>Sácame el total y la fecha de vencimiento</Pregunta>
      </div>

      <Respuesta>
        <Renglones anchos={["96%", "70%"]} />

        <div className="mt-3.5 overflow-hidden rounded-xl border border-line-soft">
          {[
            ["Total", "1.248,60 €"],
            ["Vencimiento", "14 de abril"],
            ["Estado", "Pendiente"],
          ].map(([k, v], i) => (
            <div
              key={k}
              className={`flex items-center justify-between px-3 py-2 text-[11.5px] ${
                i % 2 ? "bg-panel/30" : "bg-panel/60"
              }`}
            >
              <span className="text-muted">{k}</span>
              <span className="text-ink">{v}</span>
            </div>
          ))}
        </div>
      </Respuesta>
    </Ventana>
  );
}

function MaquetaImagenes() {
  /* Cada baldosa es un degradado: sugiere la imagen sin inventarse una falsa. */
  const baldosas = [
    "radial-gradient(70% 70% at 50% 42%, #f4f6fb 0%, #9aa6c8 18%, #2b3348 44%, #090b12 78%)",
    "linear-gradient(160deg, #1b2340 0%, #4d3c7a 45%, #c9a6ff 100%)",
    "radial-gradient(60% 60% at 30% 30%, #ffd9a8 0%, #b4632a 40%, #14101a 82%)",
  ];

  return (
    <Ventana titulo="ECLIPSE · Imagen">
      <Pregunta>Un eclipse solar sobre el mar, muy contrastado</Pregunta>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {baldosas.map((b, i) => (
          <div
            key={i}
            className="aspect-square rounded-xl border border-line-soft"
            style={{ background: b }}
            aria-hidden
          />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10.5px] text-faint">
        <Icon.Download width={12} height={12} />
        Descargar en calidad completa
      </div>
    </Ventana>
  );
}

function MaquetaBots() {
  const ficheros = [
    { nombre: "index.js", nota: "el bot" },
    { nombre: "comandos/sorteo.js", nota: "el comando" },
    { nombre: "package.json", nota: "dependencias" },
    { nombre: ".env.ejemplo", nota: "tu token, fuera del código" },
  ];

  return (
    <Ventana titulo="ECLIPSE · Bot">
      <Pregunta>Un bot de Discord que haga sorteos entre quien reaccione</Pregunta>

      <Respuesta>
        <div className="overflow-hidden rounded-xl border border-line-soft bg-panel/50">
          {ficheros.map((f) => (
            <div
              key={f.nombre}
              className="flex items-center gap-2.5 border-b border-line-soft px-3 py-2 last:border-b-0"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-[2px] bg-halo/60" aria-hidden />
              <span className="font-mono text-[11px] text-ink">{f.nombre}</span>
              <span className="truncate text-[10.5px] text-faint">{f.nota}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 text-[10.5px] text-faint">
          <Icon.Check width={12} height={12} className="text-ok" />Y los pasos para ponerlo en marcha
        </div>
      </Respuesta>
    </Ventana>
  );
}

/* --------------------------------------------------------------- Bloques */

interface Bloque {
  titular: string;
  maqueta: ReactNode;
  frase: string;
  /** La segunda mitad de la frase, en gris: es lo que le da el ritmo. */
  fraseGris: string;
  incluye: string[];
}

const BLOQUES: Bloque[] = [
  {
    titular: "Busca en la web y te enseña de dónde lo saca",
    maqueta: <MaquetaFuentes />,
    frase: "Cada respuesta llega con sus fuentes delante,",
    fraseGris: "ordenadas por fiabilidad.",
    incluye: [
      "Universidades y revistas revisadas por pares",
      "Organismos oficiales",
      "Enlace a cada fuente",
      "Aviso cuando no hay consenso",
    ],
  },
  {
    titular: "Lee los archivos que le pases",
    maqueta: <MaquetaArchivos />,
    frase: "Le adjuntas el documento y te devuelve lo que necesitas,",
    fraseGris: "no un resumen genérico.",
    incluye: ["PDF y documentos", "Fotos y capturas", "Hojas de cálculo", "Escanear con la cámara"],
  },
  {
    titular: "Crea imágenes desde una frase",
    maqueta: <MaquetaImagenes />,
    frase: "Describes lo que tienes en la cabeza y lo dibuja,",
    fraseGris: "las veces que haga falta.",
    incluye: ["Varias versiones a la vez", "Descarga en calidad completa", "Sin marcas de agua"],
  },
  {
    titular: "Construye bots que funcionan de verdad",
    maqueta: <MaquetaBots />,
    frase: "Te monta el proyecto entero, archivo por archivo,",
    fraseGris: "con los pasos para arrancarlo.",
    incluye: ["Discord y Telegram", "Tus claves fuera del código", "Explicado para no programadores"],
  },
];

export default function LandingShowcase() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
      <h2 className="text-[13px] uppercase tracking-[0.16em] text-faint">Qué sabe hacer</h2>

      <div className="mt-12 space-y-24 sm:space-y-32">
        {BLOQUES.map((b) => (
          <article key={b.titular}>
            <h3 className="max-w-2xl text-[30px] font-semibold leading-[1.08] tracking-[-0.022em] text-ink sm:text-[44px]">
              {b.titular}
            </h3>

            <div className="mt-8 sm:mt-10">{b.maqueta}</div>

            <p className="mt-8 max-w-3xl text-[22px] font-medium leading-[1.25] tracking-[-0.015em] text-ink sm:mt-10 sm:text-[30px]">
              {b.frase} <span className="text-faint">{b.fraseGris}</span>
            </p>

            <div className="mt-8 border-t border-line-soft pt-6">
              <span className="text-[13px] text-faint">Incluye</span>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {b.incluye.map((i) => (
                  <li key={i} className="text-[14.5px] font-medium leading-snug text-ink">
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
