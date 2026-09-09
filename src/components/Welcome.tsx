"use client";

import EclipseLogo from "./EclipseLogo";
import type { Mode, Plan } from "@/lib/types";

interface Props {
  plan: Plan;
  onPick: (prompt: string, mode: Mode) => void;
}

const SUGGESTIONS: { text: string; prompt: string; mode: Mode; tag: string }[] = [
  {
    tag: "Investigar",
    text: "¿Qué dice la evidencia científica sobre dormir 8 horas?",
    prompt:
      "¿Qué dice la evidencia científica actual sobre cuántas horas hay que dormir? Busca estudios universitarios recientes y dime qué hay de consenso y qué está en discusión.",
    mode: "search",
  },
  {
    tag: "Explicar",
    text: "Explícame los agujeros negros como si tuviera 15 años",
    prompt:
      "Explícame qué es un agujero negro como si tuviera 15 años, con una analogía buena, y luego añade la versión rigurosa.",
    mode: "chat",
  },
  {
    tag: "Crear",
    text: "Una imagen de un eclipse solar sobre el mar",
    prompt:
      "Un eclipse solar total sobre un mar en calma, corona blanca muy definida, cielo casi negro, reflejo en el agua, fotografía nítida, alto contraste.",
    mode: "image",
  },
  {
    tag: "Escribir",
    text: "Un correo para negociar una subida de sueldo",
    prompt:
      "Escríbeme un correo breve y profesional para pedirle a mi jefe una reunión sobre una subida de sueldo. Llevo dos años en el puesto y he asumido más responsabilidades.",
    mode: "chat",
  },
];

export default function Welcome({ plan, onPick }: Props) {
  return (
    <div className="flex min-h-full flex-col px-5 py-10">
      <div className="m-auto flex w-full flex-col items-center">
      <EclipseLogo size={86} />
      <h1 className="mt-6 text-center text-[26px] font-semibold tracking-[0.16em] text-ink">
        ECLIPSE
      </h1>
      <p className="mt-2 max-w-sm text-center text-[13.5px] leading-relaxed text-muted">
        Pregunta lo que quieras. Busco en la web priorizando universidades y publicaciones
        científicas, leo tus archivos y creo lo que necesites.
      </p>

      <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.text}
            onClick={() => onPick(s.prompt, s.mode)}
            className="group rounded-xl border border-line-soft bg-panel/40 p-3.5 text-left transition hover:border-line hover:bg-panel"
          >
            <span className="text-[10.5px] uppercase tracking-[0.14em] text-faint">{s.tag}</span>
            <span className="mt-1 block text-[13.5px] leading-snug text-ink">{s.text}</span>
          </button>
        ))}
      </div>

      {plan === "free" && (
        <p className="mt-6 text-center text-[11.5px] text-faint">
          Con el plan Pro se añaden vídeo, proyectos de código completos y GitHub.
        </p>
        )}
      </div>
    </div>
  );
}
