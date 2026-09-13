"use client";

import { useMemo, useState } from "react";
import EclipseLogo from "./EclipseLogo";
import * as Icon from "./Icons";
import Markdown from "./Markdown";
import { proseOnly } from "@/lib/project";
import ProjectPanel from "./ProjectPanel";
import Pasos from "./Pasos";
import Sources from "./Sources";
import type { Message } from "@/lib/types";

interface Props {
  message: Message;
  streaming?: boolean;
  showThinking: boolean;
  onRetry?: () => void;
  /** Mandarle a ECLIPSE el error de la vista previa para que lo corrija. */
  onArreglar?: (fallo: string) => void;
  /** Pedirle que continúe una respuesta que se quedó a medias. */
  onContinuar?: () => void;
}

export default function MessageItem({
  message,
  streaming,
  showThinking,
  onRetry,
  onArreglar,
  onContinuar,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [openThinking, setOpenThinking] = useState(false);

  /**
   * En modo bot el texto lleva los archivos dentro. Se enseña solo la
   * explicación: los archivos ya tienen su panel justo debajo, y así la
   * conversación se lee de un vistazo en vez de a base de scroll.
   */
  const enCodigo = streaming
    ? message.mode === "code"
    : Boolean(message.artifacts?.some((a) => a.type === "code" && a.files?.length));

  const texto = useMemo(
    () => (enCodigo ? proseOnly(message.content) : message.content),
    [enCodigo, message.content],
  );

  /**
   * A partir de dónde se recorta.
   *
   * Trescientas letras son cinco o seis líneas en un móvil: suficiente para
   * reconocer lo que escribiste, y poco para que entierre la respuesta. El
   * margen extra evita recortar un mensaje que se pasa por dos palabras y
   * dejar un "Leer más" que casi no enseña nada nuevo.
   */
  const TOPE = 320;
  const largo = message.role === "user" && message.content.length > TOPE + 120;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* portapapeles bloqueado */
    }
  };

  if (message.role === "user") {
    return (
      <div className="animate-fade-up flex justify-end px-4 py-3">
        <div className="max-w-[85%] sm:max-w-[75%]">
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap justify-end gap-2">
              {message.attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-line-soft bg-panel px-2.5 py-1.5 text-[11.5px] text-muted"
                >
                  {a.kind === "image" && a.data ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:${a.mime};base64,${a.data}`}
                      alt={a.name}
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <span className="text-[10px] font-semibold uppercase">
                      {a.kind === "pdf" ? "PDF" : a.kind === "video" ? "VID" : "TXT"}
                    </span>
                  )}
                  <span className="max-w-[160px] truncate">{a.name}</span>
                </div>
              ))}
            </div>
          )}
          {message.content && (
            <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-tuyo-borde bg-tuyo px-4 py-2.5 text-[15.5px] leading-relaxed text-ink">
              {/*
                Un mensaje muy largo —un texto pegado para que lo revise, un
                error entero— empujaba la respuesta fuera de la pantalla y
                obligaba a hacer scroll para llegar a lo que importa. Se recorta
                y se deja abrirlo, que es lo que hace todo el mundo.
              */}
              {largo && !abierto ? `${message.content.slice(0, TOPE).trimEnd()}…` : message.content}

              {largo && (
                <button
                  onClick={() => setAbierto((v) => !v)}
                  className="mt-1.5 block text-[13px] font-medium text-halo underline underline-offset-2 transition hover:text-ink"
                >
                  {abierto ? "Mostrar menos" : "Leer más"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up px-4 py-3">
      <div className="flex gap-3">
        <EclipseLogo size={26} className="mt-0.5 shrink-0" active={streaming} />

        <div className="min-w-0 flex-1">
          {/* Razonamiento resumido */}
          {showThinking && message.thinking && (
            <div className="mb-2.5">
              <button
                onClick={() => setOpenThinking(!openThinking)}
                className="flex items-center gap-1.5 text-[11.5px] text-faint transition hover:text-muted"
              >
                <Icon.Brain width={13} height={13} />
                {openThinking ? "Ocultar razonamiento" : "Ver razonamiento"}
              </button>
              {openThinking && (
                <div className="mt-1.5 whitespace-pre-wrap rounded-lg border border-line-soft bg-panel/40 p-3 text-[12.5px] leading-relaxed text-muted">
                  {message.thinking}
                </div>
              )}
            </div>
          )}

          {texto ? (
            <div className={streaming ? "stream-caret" : undefined}>
              <Markdown>{texto}</Markdown>
            </div>
          ) : null}

          {message.error && (
            <div className="mt-2 rounded-xl border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-[13px] text-danger">
              {message.error}
            </div>
          )}

          {/*
            Se quedó a medias por longitud. Sin decirlo, el archivo incompleto
            parece un fallo cualquiera; dicho, es un botón.
          */}
          {!streaming && message.cortado && onContinuar && (
            <div className="mt-3 rounded-xl border border-line bg-panel/50 px-3.5 py-3">
              <p className="text-[12.5px] leading-snug text-muted">
                La respuesta se ha quedado a medias porque era muy larga.
              </p>
              <button
                onClick={onContinuar}
                className="mt-2 flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] text-ink transition hover:border-halo/40"
              >
                <Icon.Refresh width={13} height={13} />
                Que siga desde donde lo dejó
              </button>
            </div>
          )}

          {message.pasos && message.pasos.length > 0 && (
            <div className="mt-3 rounded-xl border border-line-soft bg-panel/30 px-3 py-2.5">
              <Pasos pasos={message.pasos} />
            </div>
          )}

          {message.sources && message.sources.length > 0 && <Sources sources={message.sources} />}

          {message.artifacts?.map((art, i) => {
            if (art.type === "image" && art.url)
              return (
                <figure key={i} className="mt-3.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={art.url}
                    alt={art.prompt ?? "Imagen generada"}
                    className="w-full max-w-lg rounded-xl border border-line-soft"
                  />
                  <figcaption className="mt-1.5 flex items-center gap-3 text-[11.5px] text-faint">
                    <a href={art.url} download="eclipse-imagen.png" className="hover:text-ink">
                      Descargar
                    </a>
                    {art.prompt && <span className="truncate">{art.prompt}</span>}
                  </figcaption>
                </figure>
              );

            if (art.type === "video" && art.url)
              return (
                <figure key={i} className="mt-3.5">
                  <video
                    src={art.url}
                    controls
                    playsInline
                    className="w-full max-w-lg rounded-xl border border-line-soft"
                  />
                  <figcaption className="mt-1.5 text-[11.5px] text-faint">
                    <a href={art.url} download="eclipse-video.mp4" className="hover:text-ink">
                      Descargar vídeo
                    </a>
                  </figcaption>
                </figure>
              );

            if (art.type === "file" && art.url)
              return (
                <a
                  key={i}
                  href={art.url}
                  download={art.title ?? "eclipse.txt"}
                  className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-panel/60 px-3.5 py-3 transition hover:border-halo/35 hover:bg-panel"
                >
                  <Icon.Download width={17} height={17} className="shrink-0 text-halo" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-ink">{art.title}</span>
                    <span className="text-[11.5px] text-faint">Pulsa para descargar</span>
                  </span>
                </a>
              );

            if (art.type === "code" && art.files?.length)
              return (
                <ProjectPanel
                  key={i}
                  title={art.title ?? "proyecto"}
                  files={art.files}
                  onArreglar={onArreglar}
                />
              );

            return null;
          })}

          {!streaming && (message.content || message.artifacts?.length) && (
            <div className="mt-2.5 flex items-center gap-1">
              <button
                onClick={copy}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] text-faint transition hover:bg-panel hover:text-ink"
              >
                {copied ? <Icon.Check width={13} height={13} /> : <Icon.Copy width={13} height={13} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] text-faint transition hover:bg-panel hover:text-ink"
                >
                  <Icon.Refresh width={13} height={13} />
                  Reintentar
                </button>
              )}
              {message.elapsedMs !== undefined && (
                <span className="ml-1 text-[11px] text-faint">
                  {(message.elapsedMs / 1000).toFixed(1)}s
                </span>
              )}
              {/* Qué modelo contestó. Cuando una respuesta sale floja, esto es
                  la diferencia entre saberlo y adivinarlo. */}
              {message.modelo && (
                <span
                  className="ml-1 max-w-[40%] truncate text-[11px] text-faint/70"
                  title={`Respondido por ${message.modelo}`}
                >
                  · {message.modelo.split("/").pop()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
