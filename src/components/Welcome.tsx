"use client";

import { useEffect, useState } from "react";
import EclipseMark from "./EclipseMark";
import * as Icon from "./Icons";
import type { Mode, Plan } from "@/lib/types";

interface Props {
  plan: Plan;
  mode: Mode;
  /** Abre el catálogo de Conexiones desde el aviso de la tienda. */
  onConectar?: () => void;
}

/** Lo dicho una vez, dicho está: si lo aparta, no vuelve. */
const APARTADO = "eclipse.aviso-conexiones";

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

/**
 * El aviso de "conecta tu tienda", al empezar una conversación.
 *
 * Existe porque lo mejor que hace ECLIPSE era invisible. Conexiones está en el
 * menú, y quien no lo abre no se entera de que su tienda puede contarle las
 * ventas del mes o de que su dominio puede revisarse desde aquí. Alguien que
 * entra a preguntar algo suelto no va a encontrarlo nunca solo.
 *
 * Con dos cuidados. Solo sale si no tiene nada conectado —enseñarle a alguien
 * cómo conectar lo que ya conectó es ruido—, y se puede apartar para siempre
 * con un toque. Un aviso que vuelve después de haberlo cerrado deja de ser un
 * aviso y pasa a ser publicidad.
 */
function AvisoConexiones({ plan, onConectar }: { plan: Plan; onConectar?: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let vivo = true;
    try {
      if (window.localStorage.getItem(APARTADO) === "1") return;
    } catch {
      /* sin almacenamiento se enseña igual */
    }

    // Se pregunta si ya tiene algo conectado. Si la petición falla —sin cuenta,
    // sin servidor— no se enseña nada: es mejor callarse que insistir.
    void fetch("/api/conexiones")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { servicios?: { conectado: boolean }[] } | null) => {
        if (!vivo || !d?.servicios) return;
        setVisible(!d.servicios.some((s) => s.conectado));
      })
      .catch(() => {});

    return () => {
      vivo = false;
    };
  }, []);

  function apartar() {
    setVisible(false);
    try {
      window.localStorage.setItem(APARTADO, "1");
    } catch {
      /* volverá a salir, que tampoco es grave */
    }
  }

  if (!visible) return null;

  return (
    <div className="mt-8 w-full max-w-md rounded-2xl border border-line-soft bg-panel/40 p-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-raised text-muted">
          <Icon.Plug width={16} height={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium text-ink">
            ¿Tienes una tienda online, una web o un negocio?
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Conéctala a ECLIPSE y le preguntas por aquí: cómo van las ventas, qué se ha quedado sin
            stock, qué le pasa al dominio o por qué no sale en Google. Se conecta una vez, en un
            minuto, y empieza en solo lectura: mirar sí, tocar solo si tú lo autorizas.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={onConectar}
              className="rounded-lg bg-raised px-3 py-1.5 text-[12.5px] text-ink transition hover:brightness-110"
            >
              Ver cómo se conecta
            </button>
            <button
              onClick={apartar}
              className="rounded-lg px-2.5 py-1.5 text-[12.5px] text-faint transition hover:text-muted"
            >
              Ahora no
            </button>
          </div>
          {plan !== "pro" && (
            <p className="mt-2 text-[11.5px] text-faint">Las conexiones son del plan Pro.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Welcome({ plan, mode, onConectar }: Props) {
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

        {mode === "chat" && <AvisoConexiones plan={plan} onConectar={onConectar} />}

        {mode === "code" && plan !== "pro" && (
          <p className="mt-6 text-center text-[11.5px] text-faint">
            ECLIPSE CODE forma parte del plan Pro.
          </p>
        )}
      </div>
    </div>
  );
}
