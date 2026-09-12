"use client";

import { useEffect, useRef, useState } from "react";
import { dictadoDisponible, dictar, type Dictado } from "@/lib/dictado";
import * as Icon from "./Icons";
import { humanSize } from "@/lib/files";
import type { Attachment, Mode, Plan, Speed } from "@/lib/types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  plan: Plan;
  speed: Speed;
  onSpeedChange: (s: Speed) => void;
  deepSearch: boolean;
  onDeepSearch: (v: boolean) => void;
  attachments: Attachment[];
  onFiles: (files: FileList | null) => void;
  onRemoveAttachment: (id: string) => void;
  onProNeeded: () => void;
}

const MODES: {
  id: Mode;
  label: string;
  icon: typeof Icon.Search;
  pro: boolean;
  hint: string;
}[] = [
  { id: "chat", label: "Chat", icon: Icon.Sparkle, pro: false, hint: "Conversación general" },
  { id: "search", label: "Investigar", icon: Icon.Search, pro: false, hint: "Busca y contrasta fuentes" },
  { id: "image", label: "Imagen", icon: Icon.Image, pro: false, hint: "Crear una imagen" },
  { id: "code", label: "Código", icon: Icon.Code, pro: true, hint: "Proyectos completos" },
  { id: "video", label: "Vídeo", icon: Icon.Video, pro: true, hint: "Generar vídeo" },
];

const SPEEDS: { id: Speed; label: string; icon: typeof Icon.Bolt }[] = [
  { id: "rapido", label: "Rápido", icon: Icon.Bolt },
  { id: "equilibrado", label: "Equilibrado", icon: Icon.Sparkle },
  { id: "profundo", label: "Profundo", icon: Icon.Brain },
];

const PLACEHOLDERS: Record<Mode, string> = {
  chat: "Pregunta lo que quieras…",
  search: "¿Qué quieres que investigue?",
  image: "Describe la imagen que quieres crear…",
  code: "Describe la aplicación que quieres construir…",
  video: "Describe el vídeo: plano, movimiento, estilo…",
};

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  mode,
  onModeChange,
  plan,
  speed,
  onSpeedChange,
  deepSearch,
  onDeepSearch,
  attachments,
  onFiles,
  onRemoveAttachment,
  onProNeeded,
}: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  /* ---------------------------- Dictado ---------------------------- */
  const [puedeDictar, setPuedeDictar] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [avisoVoz, setAvisoVoz] = useState<string | null>(null);
  const dictadoRef = useRef<Dictado | null>(null);
  // Lo que había escrito antes de empezar a hablar: el dictado se añade
  // detrás en vez de pisarlo.
  const baseRef = useRef("");

  // El botón solo aparece donde el navegador sabe hacerlo.
  useEffect(() => setPuedeDictar(dictadoDisponible()), []);

  // Al desmontar, soltar el micrófono.
  useEffect(() => () => dictadoRef.current?.parar(), []);

  const alternarVoz = () => {
    if (escuchando) {
      dictadoRef.current?.parar();
      dictadoRef.current = null;
      setEscuchando(false);
      return;
    }

    setAvisoVoz(null);
    baseRef.current = value ? `${value.trimEnd()} ` : "";

    const sesion = dictar({
      onTexto: ({ firme, parcial }) => {
        if (firme) baseRef.current += firme;
        onChange((baseRef.current + parcial).replace(/\s+/g, " ").trimStart());
      },
      onFin: () => {
        dictadoRef.current = null;
        setEscuchando(false);
      },
      onError: (mensaje) => setAvisoVoz(mensaje),
    });

    if (!sesion) {
      setAvisoVoz("Este navegador no sabe dictar. Prueba con Chrome.");
      return;
    }
    dictadoRef.current = sesion;
    setEscuchando(true);
  };

  // La caja crece con el texto, hasta un tope.
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const submit = () => {
    if (busy || (!value.trim() && attachments.length === 0)) return;
    onSend();
  };

  return (
    <div className="px-3 pb-3 safe-bottom sm:px-4 sm:pb-4">
      <div className="mx-auto w-full max-w-3xl">
        {/* Selector de modo */}
        <div className="scroll-thin mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {MODES.map((m) => {
            const locked = m.pro && plan !== "pro";
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                title={locked ? `${m.hint} · Plan Pro` : m.hint}
                onClick={() => (locked ? onProNeeded() : onModeChange(m.id))}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition ${
                  active
                    ? "border-halo/35 bg-raised text-ink"
                    : "border-line-soft bg-panel/50 text-muted hover:border-line hover:text-ink"
                }`}
              >
                <m.icon width={14} height={14} className={locked ? "text-pro" : undefined} />
                {m.label}
                {locked && <span className="text-[10px] font-semibold text-pro">PRO</span>}
              </button>
            );
          })}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
          className={`rounded-2xl border bg-panel/80 shadow-[0_10px_40px_-24px_rgba(0,0,0,0.9)] backdrop-blur transition ${
            dragging ? "border-halo/50 bg-raised" : "border-line focus-within:border-halo/30"
          }`}
        >
          {/* Adjuntos */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-line-soft p-2.5">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-line-soft bg-raised px-2.5 py-1.5"
                >
                  {a.kind === "image" && a.data ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:${a.mime};base64,${a.data}`}
                      alt=""
                      className="h-7 w-7 rounded object-cover"
                    />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded bg-panel text-[9px] font-semibold uppercase text-muted">
                      {a.kind === "pdf" ? "PDF" : a.kind === "video" ? "VID" : "TXT"}
                    </span>
                  )}
                  <span className="max-w-[140px] truncate text-[12px] text-ink">{a.name}</span>
                  <span className="text-[10.5px] text-faint">{humanSize(a.size)}</span>
                  <button
                    onClick={() => onRemoveAttachment(a.id)}
                    className="rounded p-0.5 text-faint transition hover:text-danger"
                    aria-label={`Quitar ${a.name}`}
                  >
                    <Icon.Close width={13} height={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {avisoVoz && (
            <div className="flex items-start gap-2 border-b border-line-soft px-3.5 py-2 text-[12px] leading-relaxed text-danger">
              <span className="flex-1">{avisoVoz}</span>
              <button
                onClick={() => setAvisoVoz(null)}
                className="shrink-0 rounded p-0.5 text-faint transition hover:text-ink"
                aria-label="Cerrar aviso"
              >
                <Icon.Close width={13} height={13} />
              </button>
            </div>
          )}

          <textarea
            ref={textarea}
            value={value}
            rows={1}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            onPaste={(e) => {
              const files = e.clipboardData?.files;
              if (files && files.length > 0) {
                e.preventDefault();
                onFiles(files);
              }
            }}
            placeholder={escuchando ? "Te escucho… habla y lo escribo" : PLACEHOLDERS[mode]}
            className="scroll-thin max-h-[220px] w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-faint"
          />

          <div className="flex items-center gap-1.5 px-2.5 pb-2.5">
            {/* Galería y archivos. El móvil pide permiso a las fotos al abrirlo. */}
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,video/*,application/pdf,text/*,.md,.csv,.json,.ts,.tsx,.js,.py,.yml,.yaml"
              className="hidden"
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {/* `capture` abre la cámara directamente: es el "escanear". */}
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="rounded-lg p-2 text-muted transition hover:bg-raised hover:text-ink"
              aria-label="Adjuntar de la galería"
              title="Fotos, vídeos, PDF o texto"
            >
              <Icon.Paperclip width={17} height={17} />
            </button>
            <button
              onClick={() => cameraInput.current?.click()}
              className="rounded-lg p-2 text-muted transition hover:bg-raised hover:text-ink"
              aria-label="Escanear con la cámara"
              title="Escanear con la cámara"
            >
              <Icon.Camera width={17} height={17} />
            </button>

            {puedeDictar && (
              <button
                onClick={alternarVoz}
                aria-label={escuchando ? "Dejar de dictar" : "Dictar por voz"}
                aria-pressed={escuchando}
                title={escuchando ? "Dejar de dictar" : "Dictar por voz"}
                className={`relative rounded-lg p-2 transition ${
                  escuchando
                    ? "bg-danger/15 text-danger"
                    : "text-muted hover:bg-raised hover:text-ink"
                }`}
              >
                <Icon.Mic width={17} height={17} />
                {escuchando && (
                  <span className="mic-latido absolute inset-0 rounded-lg border border-danger/50" />
                )}
              </button>
            )}

            {/* Velocidad */}
            <div className="flex items-center rounded-lg border border-line-soft bg-void/40 p-0.5">
              {SPEEDS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSpeedChange(s.id)}
                  title={s.label}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] transition ${
                    speed === s.id ? "bg-raised text-ink" : "text-faint hover:text-muted"
                  }`}
                >
                  <s.icon width={13} height={13} />
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              ))}
            </div>

            {mode !== "image" && mode !== "video" && (
              <button
                onClick={() => onDeepSearch(!deepSearch)}
                title="Obligar a buscar en la web y priorizar fuentes académicas"
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] transition ${
                  deepSearch
                    ? "border-halo/35 bg-raised text-ink"
                    : "border-transparent text-faint hover:text-muted"
                }`}
              >
                <Icon.Search width={13} height={13} />
                <span className="hidden sm:inline">Fuentes</span>
              </button>
            )}

            <div className="flex-1" />

            {busy ? (
              <button
                onClick={onStop}
                className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-raised text-ink transition hover:border-danger/50 hover:text-danger"
                aria-label="Detener"
              >
                <Icon.Stop width={15} height={15} />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!value.trim() && attachments.length === 0}
                className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-void transition disabled:cursor-not-allowed disabled:bg-line disabled:text-faint"
                aria-label="Enviar"
              >
                <Icon.Send width={17} height={17} />
              </button>
            )}
          </div>
        </div>

        <p className="mt-2 text-center text-[11px] text-faint">
          ECLIPSE puede equivocarse. Comprueba los datos importantes en las fuentes.
        </p>
      </div>
    </div>
  );
}
