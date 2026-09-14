"use client";

import { useCallback, useEffect, useState } from "react";
import Modal from "./Modal";
import * as Icon from "./Icons";

/**
 * La biblioteca: entrar a mirar y salir con una idea.
 *
 * El diseño va detrás de una sola cosa: que las imágenes se vean grandes y no
 * compitan con nada. Sin bordes, sin tarjetas, sin sombras: una cuadrícula y
 * ya. Todo lo que se añade alrededor de una foto es algo que le quita sitio.
 *
 * Y cada imagen lleva su autor y su licencia al abrirla, que es lo que permite
 * usarla de verdad. Una biblioteca donde no se sabe qué se puede hacer con lo
 * que hay dentro es un escaparate.
 */

interface Imagen {
  id: string;
  titulo: string;
  url: string;
  miniatura: string;
  autor: string;
  licencia: string;
  origen: string;
  fuente: string;
  ancho?: number;
  alto?: number;
}

interface Estante {
  id: string;
  nombre: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Para pedirle a ECLIPSE algo parecido a lo que se está mirando. */
  onInspirar?: (prompt: string) => void;
}

export default function BibliotecaDialog({ open, onClose, onInspirar }: Props) {
  const [estantes, setEstantes] = useState<Estante[]>([]);
  const [estante, setEstante] = useState("arquitectura");
  const [busca, setBusca] = useState("");
  const [escrito, setEscrito] = useState("");
  const [imagenes, setImagenes] = useState<Imagen[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mirando, setMirando] = useState<Imagen | null>(null);

  const cargar = useCallback(async (opciones: { estante?: string; busca?: string }) => {
    setCargando(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (opciones.busca) p.set("busca", opciones.busca);
      else p.set("estante", opciones.estante ?? "arquitectura");

      const r = await fetch(`/api/biblioteca?${p}`);
      const d = (await r.json()) as { imagenes?: Imagen[]; estantes?: Estante[]; error?: string };
      setEstantes(d.estantes ?? []);
      setImagenes(d.imagenes ?? []);
      if (!r.ok) setError(d.error ?? "No se ha podido abrir la biblioteca.");
      else if (!d.imagenes?.length) setError("No hay nada con eso. Prueba con otras palabras.");
    } catch {
      setError("No se ha podido abrir la biblioteca.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (open) void cargar({ estante });
    // Al cerrarla se olvida lo que se estaba mirando, no la búsqueda.
    if (!open) setMirando(null);
  }, [open, estante, cargar]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Biblioteca"
      subtitle="Imágenes para inspirarte. Todas de uso libre, con su autor y su licencia."
      wide
    >
      <div className="space-y-4">
        {/* Buscar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusca(escrito);
            void cargar({ busca: escrito });
          }}
          className="relative"
        >
          <Icon.Search
            width={15}
            height={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={escrito}
            onChange={(e) => setEscrito(e.target.value)}
            placeholder="Busca lo que quieras: catedrales, tipografía, tormentas…"
            className="w-full rounded-xl border border-line bg-panel py-2.5 pl-9 pr-3 text-[14px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
          />
        </form>

        {/* Estantes */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {estantes.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                setBusca("");
                setEscrito("");
                setEstante(e.id);
              }}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] transition ${
                !busca && estante === e.id
                  ? "bg-raised text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              {e.nombre}
            </button>
          ))}
        </div>

        {cargando && <p className="py-8 text-center text-[13px] text-faint">Buscando…</p>}
        {error && !cargando && (
          <p className="py-8 text-center text-[13px] leading-relaxed text-muted">{error}</p>
        )}

        {/* La cuadrícula. Dos columnas en el móvil, tres en pantalla grande. */}
        {!cargando && imagenes.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {imagenes.map((img) => (
              <button
                key={img.id}
                onClick={() => setMirando(img)}
                className="group relative aspect-square overflow-hidden rounded-lg bg-panel"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.miniatura}
                  alt={img.titulo}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                />
              </button>
            ))}
          </div>
        )}

        <p className="border-t border-line-soft pt-4 text-[11.5px] leading-relaxed text-faint">
          Las imágenes vienen de Openverse, el buscador de obra con licencia libre de Wikimedia:
          museos, archivos y fotógrafos que han dado permiso para reutilizarlas. Por eso puedes
          usarlas de verdad, respetando el autor y la licencia que pone en cada una.
        </p>
      </div>

      {/* Una imagen, en grande */}
      {mirando && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/92 p-3"
          onClick={() => setMirando(null)}
        >
          <div className="flex justify-end">
            <button
              onClick={() => setMirando(null)}
              aria-label="Cerrar"
              className="rounded-lg p-2 text-white/70 transition hover:text-white"
            >
              <Icon.Close width={20} height={20} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mirando.url}
              alt={mirando.titulo}
              className="max-h-full max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div
            className="mt-3 rounded-xl bg-white/8 p-3.5 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[13.5px] font-medium leading-snug text-white">{mirando.titulo}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/60">
              {mirando.autor} · {mirando.licencia} · vía {mirando.fuente}
              {mirando.ancho && mirando.alto ? ` · ${mirando.ancho}×${mirando.alto}` : ""}
            </p>

            <div className="mt-3 flex gap-2">
              <a
                href={mirando.origen}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-white/20 px-3 py-2 text-[12.5px] text-white/80 transition hover:text-white"
              >
                Ver el original
                <Icon.External width={13} height={13} />
              </a>
              {onInspirar && (
                <button
                  onClick={() => {
                    onInspirar(
                      `Créame una imagen inspirada en esto, con mi propio giro: «${mirando.titulo}». Que sea original, no una copia.`,
                    );
                    setMirando(null);
                    onClose();
                  }}
                  className="flex-1 rounded-xl bg-white py-2 text-[12.5px] font-medium text-black transition hover:opacity-90"
                >
                  Crear algo así
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
