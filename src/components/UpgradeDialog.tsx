"use client";

import { useState } from "react";
import Modal from "./Modal";
import * as Icon from "./Icons";
import type { Plan } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  onPlanChange: (plan: Plan) => void;
  proCodeConfigured: boolean;
}

const FREE = [
  "Conversación ilimitada con razonamiento",
  "Búsqueda web con prioridad a fuentes académicas",
  "Analizar imágenes, PDF y archivos de texto",
  "Crear imágenes",
  "Redactar, resumir, traducir y dar ideas",
];

const PRO = [
  "Todo lo del plan Gratis",
  "Generación de vídeo",
  "Modo código: proyectos completos, listos para ejecutar",
  "Subir esos proyectos directamente a GitHub",
  "Modo Profundo con el máximo razonamiento",
  "Respuestas aceleradas (modo rápido)",
];

export default function UpgradeDialog({ open, onClose, plan, onPlanChange, proCodeConfigured }: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { plan?: Plan; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo activar.");
      onPlanChange(data.plan ?? "pro");
      setCode("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar.");
    } finally {
      setBusy(false);
    }
  };

  const downgrade = async () => {
    setBusy(true);
    await fetch("/api/pro", { method: "DELETE" }).catch(() => {});
    onPlanChange("free");
    setBusy(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={plan === "pro" ? "Tu plan Pro" : "Mejorar a Pro"}
      subtitle={
        plan === "pro"
          ? "Tienes todas las funciones desbloqueadas."
          : "Desbloquea vídeo, código y el máximo razonamiento."
      }
      wide
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line-soft bg-panel/40 p-4">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-[14px] font-semibold text-ink">Gratis</span>
            {plan === "free" && (
              <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">
                Tu plan
              </span>
            )}
          </div>
          <ul className="space-y-2">
            {FREE.map((f) => (
              <li key={f} className="flex gap-2 text-[12.5px] leading-snug text-muted">
                <Icon.Check width={14} height={14} className="mt-0.5 shrink-0 text-faint" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-pro/30 bg-gradient-to-b from-pro/10 to-transparent p-4">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-[14px] font-semibold text-ink">Pro</span>
            <Icon.Sparkle width={14} height={14} className="text-pro" />
            {plan === "pro" && (
              <span className="rounded-full border border-pro/40 px-2 py-0.5 text-[10px] text-pro">
                Activo
              </span>
            )}
          </div>
          <ul className="space-y-2">
            {PRO.map((f) => (
              <li key={f} className="flex gap-2 text-[12.5px] leading-snug text-ink">
                <Icon.Check width={14} height={14} className="mt-0.5 shrink-0 text-pro" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {plan === "free" ? (
        <div className="mt-4">
          <label className="mb-1.5 block text-[12px] text-muted">Código de acceso Pro</label>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && code.trim() && activate()}
              type="password"
              placeholder="Introduce tu código"
              className="flex-1 rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[13.5px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
            />
            <button
              onClick={activate}
              disabled={busy || !code.trim()}
              className="rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-void transition disabled:bg-line disabled:text-faint"
            >
              {busy ? "…" : "Activar"}
            </button>
          </div>
          {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
          {!proCodeConfigured && (
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-faint">
              Este servidor todavía no tiene código Pro. Define la variable de entorno{" "}
              <code className="rounded bg-raised px-1 py-0.5">PRO_ACCESS_CODE</code> con la clave que
              quieras y reinicia el despliegue.
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={downgrade}
          disabled={busy}
          className="mt-4 text-[12.5px] text-faint transition hover:text-danger"
        >
          Volver al plan gratuito
        </button>
      )}
    </Modal>
  );
}
