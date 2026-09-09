"use client";

import Modal from "./Modal";
import * as Icon from "./Icons";
import type { Plan } from "@/lib/types";

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

export default function SettingsDialog({
  open,
  onClose,
  plan,
  capabilities,
  providerLabel,
  showThinking,
  onShowThinking,
  onClearAll,
  conversationCount,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Ajustes">
      <div className="space-y-5">
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
