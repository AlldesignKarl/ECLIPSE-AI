"use client";

import { useState } from "react";
import * as Icon from "./Icons";
import Markdown from "./Markdown";
import { guessLanguage } from "@/lib/project";
import type { GeneratedFile } from "@/lib/types";

interface Props {
  title: string;
  files: GeneratedFile[];
  onPush: (files: GeneratedFile[], title: string) => void;
}

/** Los archivos que ha generado la IA: verlos, descargarlos o subirlos a GitHub. */
export default function ProjectPanel({ title, files, onPush }: Props) {
  const [selected, setSelected] = useState(0);
  const [zipping, setZipping] = useState(false);
  const current = files[Math.min(selected, files.length - 1)];

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
      <div className="flex items-center gap-2 border-b border-line-soft bg-panel/60 px-3 py-2">
        <Icon.Code width={15} height={15} className="text-halo" />
        <span className="truncate text-[13px] font-medium text-ink">{title}</span>
        <span className="text-[11px] text-faint">
          {files.length} archivo{files.length > 1 ? "s" : ""} · {totalLines} líneas
        </span>
        <div className="flex-1" />
        <button
          onClick={download}
          disabled={zipping}
          className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] text-muted transition hover:text-ink disabled:opacity-50"
        >
          <Icon.Download width={13} height={13} />
          {zipping ? "Comprimiendo…" : "ZIP"}
        </button>
        <button
          onClick={() => onPush(files, title)}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[11.5px] text-ink transition hover:border-halo/40"
        >
          <Icon.Github width={13} height={13} />
          GitHub
        </button>
      </div>

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
    </div>
  );
}
