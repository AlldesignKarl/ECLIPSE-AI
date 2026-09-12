"use client";

import { useMemo, useState } from "react";
import * as Icon from "./Icons";
import Markdown from "./Markdown";
import { guessLanguage } from "@/lib/project";
import { buildPreview } from "@/lib/preview";
import type { GeneratedFile } from "@/lib/types";

interface Props {
  title: string;
  files: GeneratedFile[];
}

/**
 * Los archivos de un proyecto guardado: verlos y descargarlos.
 *
 * El modo código ya no existe, pero las conversaciones antiguas lo tienen
 * dentro. Borrar esto dejaría un hueco donde antes había algo, así que se
 * queda para que lo de ayer se siga pudiendo abrir.
 */
export default function ProjectPanel({ title, files }: Props) {
  const [selected, setSelected] = useState(0);
  const [zipping, setZipping] = useState(false);
  const [viendo, setViendo] = useState(false);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const current = files[Math.min(selected, files.length - 1)];

  // Solo se puede ver funcionando lo que abre un HTML y arranca sin compilar.
  // Ofrecer el botón para un proyecto de React sería enseñar un recuadro gris.
  const vista = useMemo(() => buildPreview(files), [files]);
  const pagina = vista?.funciona ? vista : null;

  if (files.length === 0) return null;

  const download = async () => {
    setZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const file of files) zip.file(file.path, file.content);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  };

  const totalLines = files.reduce((n, f) => n + f.content.split("\n").length, 0);

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-line bg-void/60">
      {/* En móvil no caben el nombre y los tres botones en una línea: el
          nombre manda arriba y los botones bajan a la suya. */}
      <div className="border-b border-line-soft bg-panel/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon.Code width={15} height={15} className="shrink-0 text-halo" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{title}</span>
          <span className="shrink-0 text-[11px] text-faint">
            {files.length} archivo{files.length > 1 ? "s" : ""} · {totalLines} líneas
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          {pagina && (
            <button
              onClick={() => setViendo((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] transition ${
                viendo
                  ? "border-halo/40 bg-raised text-ink"
                  : "border-line text-muted hover:text-ink"
              }`}
            >
              {viendo ? (
                <Icon.Code width={13} height={13} />
              ) : (
                <Icon.Play width={13} height={13} />
              )}
              {viendo ? "Código" : "Ver"}
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={download}
            disabled={zipping}
            className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] text-muted transition hover:text-ink disabled:opacity-50"
          >
            <Icon.Download width={13} height={13} />
            {zipping ? "Comprimiendo…" : "ZIP"}
          </button>
        </div>

        {/* Por qué no se puede ver, entero y sin cortar: es lo que explica que
            no haya botón, y a medias no explica nada. */}
        {!pagina && vista?.motivo && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
            {vista.motivo} Descárgalo con ZIP, o pídeme la misma página en HTML
            sencillo para poder verla aquí.
          </p>
        )}
      </div>

      {viendo && pagina ? (
        <div className="relative">
          <iframe
            title={`Vista previa de ${title}`}
            srcDoc={pagina.html}
            /* Sin `allow-same-origin`: el código va en un origen propio y no
               puede tocar ni la página ni las cookies de ECLIPSE. */
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            className="h-[420px] w-full border-0 bg-white"
          />
          <button
            onClick={() => setPantallaCompleta(true)}
            className="absolute right-2.5 top-2.5 rounded-lg border border-line bg-void/85 px-2.5 py-1.5 text-[11.5px] text-muted backdrop-blur transition hover:text-ink"
          >
            Ampliar
          </button>
        </div>
      ) : (
      <div className="flex flex-col sm:flex-row">
        <ul className="scroll-thin flex max-h-[140px] shrink-0 gap-1 overflow-auto border-b border-line-soft p-2 sm:max-h-[420px] sm:w-52 sm:flex-col sm:border-b-0 sm:border-r">
          {files.map((f, i) => (
            <li key={f.path}>
              <button
                onClick={() => setSelected(i)}
                className={`w-full truncate rounded-md px-2.5 py-1.5 text-left font-mono text-[11.5px] transition ${
                  i === selected ? "bg-raised text-ink" : "text-muted hover:bg-panel hover:text-ink"
                }`}
                title={f.path}
              >
                {f.path}
              </button>
            </li>
          ))}
        </ul>

        <div className="scroll-thin max-h-[420px] min-w-0 flex-1 overflow-auto p-3">
          <Markdown>{`\`\`\`${guessLanguage(current.path)}\n${current.content}\n\`\`\``}</Markdown>
        </div>
      </div>
      )}

      {pantallaCompleta && pagina && (
        <div className="fixed inset-0 z-50 flex flex-col bg-void">
          <div className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
            <Icon.Code width={15} height={15} className="text-halo" />
            <span className="flex-1 truncate text-[13.5px] text-ink">{title}</span>
            <button
              onClick={() => setPantallaCompleta(false)}
              className="rounded-lg p-1.5 text-muted transition hover:text-ink"
              aria-label="Cerrar la vista"
            >
              <Icon.Close width={17} height={17} />
            </button>
          </div>
          <iframe
            title={`Vista previa de ${title}`}
            srcDoc={pagina.html}
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            className="flex-1 w-full border-0 bg-white"
          />
        </div>
      )}
    </div>
  );
}
