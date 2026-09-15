"use client";

import { useEffect, type ReactNode } from "react";
import * as Icon from "./Icons";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
  /**
   * Pintar el eclipse de fondo dentro del panel.
   *
   * Lo usan los chats de grupo y de quedada, y solo ellos: Carlos lo quiso ahí
   * y en ningún otro sitio. Un grupo es una sala, y una sala puede tener pared.
   */
  fondo?: boolean;
}

export default function Modal({ open, onClose, title, subtitle, children, wide, fondo }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-fade-up relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        } ${fondo ? "fondo-grupo" : ""}`}
      >
        <div className="flex items-start gap-3 border-b border-line-soft px-5 py-4">
          <div className="flex-1">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-raised hover:text-ink"
            aria-label="Cerrar"
          >
            <Icon.Close width={17} height={17} />
          </button>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4 safe-bottom">{children}</div>
      </div>
    </div>
  );
}
