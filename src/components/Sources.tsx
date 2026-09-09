"use client";

import { useState } from "react";
import * as Icon from "./Icons";
import type { Source } from "@/lib/types";

function trustColor(trust: number) {
  if (trust >= 88) return "text-ok border-ok/25 bg-ok/8";
  if (trust >= 70) return "text-halo border-line bg-raised";
  return "text-muted border-line-soft bg-panel";
}

/** Fuentes consultadas, ordenadas de más fiable a menos. */
export default function Sources({ sources }: { sources: Source[] }) {
  const [expanded, setExpanded] = useState(false);
  if (sources.length === 0) return null;

  const visible = expanded ? sources : sources.slice(0, 4);
  const academic = sources.filter((s) => s.trust >= 88).length;

  return (
    <div className="mt-3.5 rounded-xl border border-line-soft bg-panel/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-[11.5px] text-faint">
        <Icon.Search width={13} height={13} />
        <span>
          {sources.length} {sources.length === 1 ? "fuente" : "fuentes"}
        </span>
        {academic > 0 && (
          <span className="text-ok">
            · {academic} académica{academic > 1 ? "s" : ""} u oficial{academic > 1 ? "es" : ""}
          </span>
        )}
      </div>

      <ul className="space-y-1.5">
        {visible.map((s, i) => (
          <li key={s.url + i}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-raised"
            >
              <span
                className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${trustColor(s.trust)}`}
              >
                {s.label}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-ink group-hover:underline">
                  {s.title}
                </span>
                <span className="block truncate text-[11px] text-faint">{s.domain}</span>
              </span>
              <Icon.External
                width={12}
                height={12}
                className="mt-1 shrink-0 text-faint opacity-0 transition group-hover:opacity-100"
              />
            </a>
          </li>
        ))}
      </ul>

      {sources.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 px-2 text-[11.5px] text-muted transition hover:text-ink"
        >
          {expanded ? "Ver menos" : `Ver las ${sources.length} fuentes`}
        </button>
      )}
    </div>
  );
}
