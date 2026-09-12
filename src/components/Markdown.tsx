"use client";

import { Children, Fragment, memo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

function CodeBlock({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = ref.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* el navegador puede bloquear el portapapeles */
    }
  };

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 z-10 rounded-md border border-line bg-panel/90 px-2 py-1 text-[11px] text-muted opacity-0 backdrop-blur transition hover:text-ink focus:opacity-100 group-hover:opacity-100"
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
      <pre ref={ref}>{children}</pre>
    </div>
  );
}

/**
 * Los modelos escriben `<br>` dentro de las celdas de una tabla, que es la
 * única forma que da Markdown de partir una línea ahí. Como no interpretamos
 * HTML —y no queremos hacerlo, que viene de un modelo— esas etiquetas salían
 * escritas tal cual en medio del texto. Aquí las convertimos en saltos de
 * verdad, tocando solo el texto y sin abrir la puerta a ningún HTML.
 */
function withLineBreaks(children: ReactNode): ReactNode {
  return Children.map(children, (child, index) => {
    if (typeof child !== "string") return child;
    if (!/<br\s*\/?>/i.test(child)) return child;

    const pieces = child.split(/<br\s*\/?>/i);
    return (
      <Fragment key={index}>
        {pieces.map((piece, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {piece}
          </Fragment>
        ))}
      </Fragment>
    );
  });
}

function MarkdownInner({ children }: { children: string }) {
  return (
    <div className="prose-eclipse">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          // Las tablas anchas se desplazan de lado en vez de aplastarse.
          table: ({ children }) => (
            <div className="table-scroll">
              <table>{children}</table>
            </div>
          ),
          td: ({ children }) => <td>{withLineBreaks(children)}</td>,
          th: ({ children }) => <th>{withLineBreaks(children)}</th>,
          p: ({ children }) => <p>{withLineBreaks(children)}</p>,
          li: ({ children }) => <li>{withLineBreaks(children)}</li>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Renderizar markdown es caro: solo repetimos si cambia el texto. */
export default memo(MarkdownInner);
