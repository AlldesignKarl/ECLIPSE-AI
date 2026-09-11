"use client";

import { useState } from "react";
import Modal from "./Modal";
import * as Icon from "./Icons";
import type { Plan } from "@/lib/types";

export type KeySource = "entorno" | "dispositivo" | "ninguna";

export interface Capabilities {
  chat: boolean;
  image: boolean;
  video: boolean;
  github: boolean;
  proCodeConfigured: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  capabilities: Capabilities;
  providerLabel: string;
  keySource: KeySource;
  onKeyChange: (source: KeySource) => void;
  showThinking: boolean;
  onShowThinking: (v: boolean) => void;
  onClearAll: () => void;
  conversationCount: number;
}

function Row({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <span
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-ok" : "bg-line"}`}
        aria-hidden
      />
      <span className="flex-1">
        <span className="block text-[13px] text-ink">{label}</span>
        <span className="block text-[11.5px] text-faint">{ok ? "Listo" : hint}</span>
      </span>
    </li>
  );
}

/** Permite pegar la clave de Google sin pasar por el panel del hosting. */
function KeyBox({
  source,
  onChange,
}: {
  source: KeySource;
  onChange: (s: KeySource) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: value }),
      });
      const data = (await res.json()) as { source?: KeySource; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar.");
      setValue("");
      onChange(data.source ?? "dispositivo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  const forget = async () => {
    setBusy(true);
    await fetch("/api/key", { method: "DELETE" }).catch(() => {});
    onChange("ninguna");
    setBusy(false);
  };

  if (source === "entorno")
    return (
      <div className="rounded-xl border border-ok/25 bg-ok/8 px-3.5 py-3">
        <div className="flex items-center gap-2 text-[13px] text-ink">
          <Icon.Check width={14} height={14} className="text-ok" />
          Clave configurada en el servidor
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          Viene de las variables de entorno, así que vale para todo el mundo que entre.
        </p>
      </div>
    );

  if (source === "dispositivo")
    return (
      <div className="rounded-xl border border-line-soft bg-panel/40 px-3.5 py-3">
        <div className="flex items-center gap-2 text-[13px] text-ink">
          <Icon.Check width={14} height={14} className="text-ok" />
          Clave guardada en este dispositivo
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
          Guardada en una cookie de tu navegador. Si entras desde otro móvil u ordenador,
          tendrás que volver a pegarla allí.
        </p>
        <button
          onClick={forget}
          disabled={busy}
          className="mt-2 text-[12px] text-faint transition hover:text-danger"
        >
          Olvidar la clave
        </button>
      </div>
    );

  return (
    <div className="rounded-xl border border-pro/30 bg-gradient-to-b from-pro/10 to-transparent p-3.5">
      <div className="text-[13.5px] font-medium text-ink">Conecta la IA</div>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">
        ECLIPSE necesita una clave de Google para responder. Es gratis y no pide tarjeta:
        entra en{" "}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-halo underline underline-offset-2"
        >
          aistudio.google.com/apikey
        </a>
        , pulsa <strong className="text-ink">Create API key</strong> y pégala aquí.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && value.trim() && save()}
          type="password"
          placeholder="AIza…"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-line bg-panel px-3.5 py-2.5 font-mono text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-pro/45"
        />
        <button
          onClick={save}
          disabled={busy || !value.trim()}
          className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-void transition disabled:bg-line disabled:text-faint"
        >
          {busy ? "…" : "Guardar"}
        </button>
      </div>

      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      <p className="mt-2 text-[11px] leading-relaxed text-faint">
        Se comprueba con Google antes de guardarla, y se queda en una cookie segura de tu
        navegador: no la ve nadie más.
      </p>
    </div>
  );
}

export default function SettingsDialog({
  open,
  onClose,
  plan,
  capabilities,
  providerLabel,
  keySource,
  onKeyChange,
  showThinking,
  onShowThinking,
  onClearAll,
  conversationCount,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Ajustes">
      <div className="space-y-5">
        <KeyBox source={keySource} onChange={onKeyChange} />

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={showThinking}
            onChange={(e) => onShowThinking(e.target.checked)}
            className="h-4 w-4 accent-white"
          />
          <span>
            <span className="block text-[13.5px] text-ink">Mostrar el razonamiento</span>
            <span className="block text-[11.5px] text-faint">
              Añade un desplegable con el resumen de cómo ha pensado la respuesta.
            </span>
          </span>
        </label>

        <div>
          <div className="mb-1 text-[11.5px] uppercase tracking-wide text-faint">
            Estado del servidor
          </div>
          <ul>
            <Row
              ok={capabilities.chat}
              label={`Motor de la IA · ${providerLabel}`}
              hint="Falta GOOGLE_API_KEY (gratis) o ANTHROPIC_API_KEY"
            />
            <Row
              ok={capabilities.image}
              label="Generación de imágenes"
              hint="Falta GOOGLE_API_KEY u OPENAI_API_KEY"
            />
            <Row
              ok={capabilities.video}
              label="Generación de vídeo (Pro)"
              hint="Veo necesita una cuenta de Google de pago"
            />
            <Row
              ok={capabilities.proCodeConfigured}
              label="Activación del plan Pro"
              hint="Falta PRO_ACCESS_CODE"
            />
          </ul>
        </div>

        <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
          <div className="flex items-center gap-2 text-[13px] text-ink">
            <Icon.Sparkle width={14} height={14} className={plan === "pro" ? "text-pro" : "text-faint"} />
            Plan {plan === "pro" ? "Pro" : "Gratis"}
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
            Las conversaciones se guardan solo en este dispositivo ({conversationCount} guardadas). No
            se envían a ningún servidor salvo el mensaje que estás preguntando.
          </p>
        </div>

        <p className="text-[11.5px] leading-relaxed text-faint">
          ECLIPSE es un producto de <span className="text-muted">Eclipse</span>, empresa fundada por{" "}
          <span className="text-muted">Carlos Lafuente Pueyo</span>.
        </p>

        <button
          onClick={() => {
            if (confirm("¿Borrar todas las conversaciones? No se puede deshacer.")) onClearAll();
          }}
          className="flex items-center gap-2 text-[12.5px] text-faint transition hover:text-danger"
        >
          <Icon.Trash width={14} height={14} />
          Borrar todas las conversaciones
        </button>
      </div>
    </Modal>
  );
}
