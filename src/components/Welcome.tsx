"use client";

import EclipseMark from "./EclipseMark";
import type { Mode, Plan } from "@/lib/types";

interface Props {
  plan: Plan;
  mode: Mode;
}

/*
  La bienvenida, sin preguntas hechas.

  Antes había cuatro tarjetas con ejemplos: "explícame los agujeros negros",
  "un bot de Discord"... La idea era enseñar de qué es capaz, pero el efecto
  era el contrario. Quien entra ya sabe a qué viene, y encontrarse cuatro
  preguntas que no son la suya le estrecha el sitio en vez de abrirlo: parece
  un menú de lo único que se puede pedir. Carlos lo dijo corto: quita las
  preguntas del inicio.

  Queda el nombre, la marca y una frase de qué sabe hacer. Lo demás se escribe
  abajo, que es donde se escribe.
*/
const TEXTOS: Record<Mode, { titulo: string; entrada: string }> = {
  chat: {
    titulo: "ECLIPSE",
    entrada:
      "Pregunta lo que quieras. Busco en la web priorizando universidades y publicaciones científicas, leo tus archivos y creo lo que necesites.",
  },
  code: {
    titulo: "ECLIPSE CODE",
    entrada:
      "Dime qué quieres que programe y te lo entrego entero: los archivos, la vista previa para verlo funcionando y el ZIP para descargarlo.",
  },
};

export default function Welcome({ plan, mode }: Props) {
  const { titulo, entrada } = TEXTOS[mode];

  return (
    <div className="flex min-h-[68dvh] flex-col px-5 py-10">
      <div className="m-auto flex w-full flex-col items-center">
        <EclipseMark size={86} />
        <h1 className="mt-6 text-center text-[26px] font-semibold tracking-[0.16em] text-ink">
          {titulo}
        </h1>
        <p className="mt-3 max-w-sm text-center text-[13.5px] leading-relaxed text-muted">
          {entrada}
        </p>

        {mode === "code" && plan !== "pro" && (
          <p className="mt-6 text-center text-[11.5px] text-faint">
            ECLIPSE CODE forma parte del plan Pro.
          </p>
        )}
      </div>
    </div>
  );
}
