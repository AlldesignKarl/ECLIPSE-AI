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
}

export default function MessageItem({
  message,
  streaming,
  showThinking,
  onRetry,
}: Props) {
  const [copied, setCopied] = useState(false);
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
            <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-line bg-panel px-4 py-2.5 text-[14.5px] leading-relaxed text-ink">
              {message.content}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
