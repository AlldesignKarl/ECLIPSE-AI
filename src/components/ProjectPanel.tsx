"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Icon from "./Icons";
import Markdown from "./Markdown";
import { guessLanguage, trozoDelError } from "@/lib/project";
import { buildPreview } from "@/lib/preview";
import type { GeneratedFile } from "@/lib/types";

interface Props {
  title: string;
  files: GeneratedFile[];
  /** Pedirle a ECLIPSE que arregle lo que ha fallado al verlo. */
  onArreglar?: (fallo: string) => void;
  /** La respuesta se quedó a medias: este archivo está incompleto. */
  aMedias?: boolean;
}

/**
 * Los archivos de un proyecto guardado: verlos y descargarlos.
 *
 * El modo código ya no existe, pero las conversaciones antiguas lo tienen
 * dentro. Borrar esto dejaría un hueco donde antes había algo, así que se
 * queda para que lo de ayer se siga pudiendo abrir.
 */
export default function ProjectPanel({ title, files, onArreglar, aMedias }: Props) {
  /**
   * Lo que ha fallado al abrir la vista previa, si ha fallado algo.
   *
   * Llega desde dentro del marco, que es quien lo ve. Un error en el código
   * generado no lo puede arreglar el usuario a mano: lo tiene que arreglar
   * quien lo escribió, así que aquí solo hace falta un botón que se lo diga.
   */
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    const alLlegar = (e: MessageEvent) => {
      const d = e.data as { eclipse?: string; titulo?: string; detalle?: string };
      if (d?.eclipse !== "fallo-vista-previa") return;
      setFallo(`${d.titulo ?? "Error"}: ${d.detalle ?? ""}`.trim());
    };
    window.addEventListener("message", alLlegar);
    return () => window.removeEventListener("message", alLlegar);
  }, []);

  /*
    La vista previa solo existe mientras se ve.

    Un proyecto abierto es una página entera corriendo: su bucle de animación,
    su escena 3D, su contexto de WebGL. Eso no se para al bajar el dedo, y en
    una conversación con tres o cuatro proyectos abiertos el móvil acaba con
    cuatro escenas 3D a la vez. Los navegadores de móvil aguantan muy pocos
    contextos de WebGL, y cuando se pasan no avisan: cierran la pestaña.

    Así que el marco se desmonta al salir de pantalla y se vuelve a montar al
    volver. Se deja un margen generoso para que al desplazarse despacio no se
    reinicie en la cara del usuario.
  */
  const caja = useRef<HTMLDivElement>(null);
  const [enPantalla, setEnPantalla] = useState(true);

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo || typeof IntersectionObserver === "undefined") return;

    const observador = new IntersectionObserver(
      ([entrada]) => setEnPantalla(entrada.isIntersecting),
      { rootMargin: "600px 0px" },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const [selected, setSelected] = useState(0);
  const [zipping, setZipping] = useState(false);
  const [viendo, setViendo] = useState(false);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const current = files[Math.min(selected, files.length - 1)];

  // Solo se puede ver funcionando lo que abre un HTML y arranca sin compilar.
  // Ofrecer el botón para un proyecto de React sería enseñar un recuadro gris.
  const vista = useMemo(() => buildPreview(files), [files]);
  /*
    Un archivo que se cortó a medias no se ofrece para ver.

    Lo que pasaba si no: el archivo acaba en mitad de una línea, la vista previa
    da un error de sintaxis en la última línea escrita, el usuario da a
    "arréglalo" creyendo que hay un fallo que corregir, y ECLIPSE reescribe el
    archivo entero y se vuelve a cortar por el mismo sitio. Un bucle que no
    lleva a ninguna parte, porque no hay nada roto: falta el final.
  */
  const pagina = vista?.funciona && !aMedias ? vista : null;

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
    <div ref={caja} className="mt-4 overflow-hidden rounded-xl border border-line bg-void/60">
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

        {/*
          El código ha fallado al abrirlo. Quien lo puede arreglar es quien lo
          escribió, así que el botón manda el error de vuelta con el archivo.
          Pedirle al usuario que abra el código y busque la línea 278 sería
          pedirle que haga de programador para usar una aplicación que existe
          justamente para que no tenga que serlo.
        */}
        {fallo && onArreglar && (
          <div className="mt-2.5 rounded-xl border border-danger/30 bg-danger/8 p-3">
            <p className="text-[12px] leading-snug text-danger">{fallo}</p>
            <button
              onClick={() => {
                onArreglar(fallo + trozoDelError(files, fallo));
                setFallo(null);
              }}
              className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-danger/40 px-2.5 py-1.5 text-[12px] text-ink transition hover:bg-danger/15"
            >
              <Icon.Refresh width={13} height={13} />
              Pídele a ECLIPSE que lo arregle
            </button>
          </div>
        )}

        {aMedias && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
            Este archivo está incompleto: la respuesta se cortó antes de
            terminarlo. No se puede ver hasta que esté entero — dale a «Que siga
            desde donde lo dejó», aquí debajo.
          </p>
        )}

        {/* Por qué no se puede ver, entero y sin cortar: es lo que explica que
            no haya botón, y a medias no explica nada. */}
        {!pagina && !aMedias && vista?.motivo && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
            {vista.motivo} Descárgalo con ZIP, o pídeme la misma página en HTML
            sencillo para poder verla aquí.
          </p>
        )}
      </div>

      {viendo && pagina ? (
        <div className="relative">
          {enPantalla && !pantallaCompleta ? (
            <iframe
              title={`Vista previa de ${title}`}
              srcDoc={pagina.html}
              /* Sin `allow-same-origin`: el código va en un origen propio y no
                 puede tocar ni la página ni las cookies de ECLIPSE. */
              sandbox="allow-scripts allow-forms allow-popups allow-modals"
              className="h-[420px] w-full border-0 bg-white"
            />
          ) : (
            // El hueco se queda del mismo alto: si no, la conversación pega un
            // salto justo cuando el usuario está desplazándose por ella.
            <div className="h-[420px] w-full bg-panel/40" aria-hidden />
          )}
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
