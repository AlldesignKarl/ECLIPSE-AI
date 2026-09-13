"use client";

import EclipseMark from "./EclipseMark";
import type { Mode, Plan } from "@/lib/types";

interface Props {
  plan: Plan;
  mode: Mode;
  onPick: (prompt: string) => void;
}

const SUGERENCIAS_CHAT: { text: string; prompt: string; tag: string }[] = [
  {
    tag: "Investigar",
    text: "¿Qué dice la evidencia científica sobre dormir 8 horas?",
    prompt:
      "¿Qué dice la evidencia científica actual sobre cuántas horas hay que dormir? Busca estudios recientes y dime qué hay de consenso y qué está en discusión.",
  },
  {
    tag: "Crear",
    text: "Una imagen de un eclipse solar sobre el mar",
    prompt:
      "Créame una imagen de un eclipse solar total sobre un mar en calma, corona blanca muy definida, cielo casi negro y reflejo en el agua.",
  },
  {
    tag: "Explicar",
    text: "Explícame los agujeros negros como si tuviera 15 años",
    prompt:
      "Explícame qué es un agujero negro como si tuviera 15 años, con una analogía buena, y luego añade la versión rigurosa.",
  },
  {
    tag: "Escribir",
    text: "Un correo para negociar una subida de sueldo",
    prompt:
      "Escríbeme un correo breve y profesional para pedirle a mi jefe una reunión sobre una subida de sueldo. Llevo dos años en el puesto y he asumido más responsabilidades.",
  },
];

const SUGERENCIAS_CODE: { text: string; prompt: string; tag: string }[] = [
  {
    tag: "Web",
    text: "La página de un restaurante, con carta y reservas",
    prompt:
      "Créame la página web de un restaurante: portada con las especialidades, carta con precios, sobre nosotros y reservas con teléfono, correo y horarios. Que quede preciosa.",
  },
  {
    tag: "Herramienta",
    text: "Una calculadora de hipotecas que funcione",
    prompt:
      "Una calculadora de hipotecas en una sola página: capital, plazo e interés, con la cuota mensual, el total de intereses y una tabla de amortización.",
  },
  {
    tag: "Juego",
    text: "El juego de la serpiente, jugable en el móvil",
    prompt:
      "El juego de la serpiente en una página, jugable con el dedo en el móvil y con las flechas en el ordenador, con puntuación y récord guardado.",
  },
  {
    tag: "Bot",
    text: "Un bot de Discord que haga sorteos",
    prompt:
      "Un bot de Discord que organice sorteos entre quien reaccione a un mensaje, con el token en una variable de entorno y los pasos para arrancarlo.",
  },
];

/** Lo que cambia entre un sitio y el otro, junto para poder compararlo. */
const TEXTOS: Record<Mode, { titulo: string; entrada: string; sugerencias: typeof SUGERENCIAS_CHAT }> = {
  chat: {
    titulo: "ECLIPSE",
    entrada:
      "Pregunta lo que quieras. Busco en la web priorizando universidades y publicaciones científicas, leo tus archivos y creo lo que necesites.",
    sugerencias: SUGERENCIAS_CHAT,
  },
  code: {
    titulo: "ECLIPSE CODE",
    entrada:
      "Dime qué quieres que programe y te lo entrego entero: los archivos, la vista previa para verlo funcionando y el ZIP para descargarlo.",
    sugerencias: SUGERENCIAS_CODE,
  },
};

export default function Welcome({ plan, mode, onPick }: Props) {
  const { titulo, entrada, sugerencias } = TEXTOS[mode];

  return (
    <div className="flex min-h-full flex-col px-5 py-10">
      <div className="m-auto flex w-full flex-col items-center">
      <EclipseMark size={86} />
      <h1 className="mt-6 text-center text-[26px] font-semibold tracking-[0.16em] text-ink">
        {titulo}
      </h1>
      <p className="mt-2 max-w-sm text-center text-[13.5px] leading-relaxed text-muted">
        {entrada}
      </p>

      <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {sugerencias.map((s) => (
          <button
            key={s.text}
            onClick={() => onPick(s.prompt)}
            className="group rounded-xl border border-line-soft bg-panel/40 p-3.5 text-left transition hover:border-line hover:bg-panel"
          >
            <span className="text-[10.5px] uppercase tracking-[0.14em] text-faint">{s.tag}</span>
            <span className="mt-1 block text-[13.5px] leading-snug text-ink">{s.text}</span>
          </button>
        ))}
      </div>

      {mode === "chat" && (
        <p className="mt-6 text-center text-[11.5px] text-faint">
          Pídele lo que quieras: busca, crea imágenes y escribe archivos sin cambiar de sitio.
        </p>
      )}
      {mode === "code" && plan !== "pro" && (
        <p className="mt-6 text-center text-[11.5px] text-faint">
          ECLIPSE CODE forma parte del plan Pro.
        </p>
      )}
      </div>
    </div>
  );
}
