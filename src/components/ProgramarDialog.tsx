"use client";

import { useCallback, useEffect, useState } from "react";
import Modal from "./Modal";
import * as Icon from "./Icons";
import type { Plan } from "@/lib/types";

/**
 * Programar: encargarle algo a ECLIPSE para que lo haga solo.
 *
 * La pantalla tiene un trabajo difícil: explicar sin explicar. Quien entra aquí
 * no sabe que esto existe, así que en vez de un formulario en blanco —que es
 * pedirle que se invente de qué sirve— se le enseñan encargos hechos, tomados
 * de lo que la gente pide de verdad. Se toca uno, se cambia una palabra y ya
 * está funcionando.
 *
 * Y una cosa que se dice a la cara y no en letra pequeña: esto se prepara de
 * madrugada. Prometer una hora exacta que no se puede cumplir es peor que
 * prometer el día, que sí se cumple.
 */

interface Cuando {
  tipo: "diario" | "laborables" | "semanal";
  dia?: number;
}

interface Tarea {
  id: string;
  titulo: string;
  instruccion: string;
  cuando: Cuando;
  activa: boolean;
  creada: number;
  ultima?: number;
  ultimoFallo?: string;
}

interface Resultado {
  id: string;
  tareaId: string;
  titulo: string;
  texto: string;
  hecha: number;
  nueva: boolean;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const textoDe = (c: Cuando) =>
  c.tipo === "diario"
    ? "Cada día"
    : c.tipo === "laborables"
      ? "De lunes a viernes"
      : `Cada ${DIAS[c.dia ?? 1]}`;

/** Encargos de ejemplo, sacados de lo que la gente pide de verdad. */
const EJEMPLOS: { icono: string; titulo: string; instruccion: string; cuando: Cuando }[] = [
  {
    icono: "📋",
    titulo: "Mi día",
    instruccion:
      "Hazme un resumen corto para empezar el día: qué tiempo hace hoy donde vivo, y una cosa que esté pasando en el mundo que merezca la pena saber.",
    cuando: { tipo: "laborables" },
  },
  {
    icono: "🛒",
    titulo: "Cómo va la tienda",
    instruccion:
      "Mira mi tienda conectada: cuántos pedidos ha habido desde ayer, cuánto suman, y si algún producto se ha quedado sin stock. Si algo pinta mal, dímelo el primero.",
    cuando: { tipo: "diario" },
  },
  {
    icono: "🎉",
    titulo: "Planes de fin de semana",
    instruccion:
      "Búscame tres planes para este fin de semana cerca de donde vivo: uno barato, uno para hacer con gente y uno tranquilo. Con el día y el sitio.",
    cuando: { tipo: "semanal", dia: 4 },
  },
  {
    icono: "📚",
    titulo: "Lectura del sábado",
    instruccion:
      "Encuéntrame un artículo largo y bueno, publicado esta semana, sobre tecnología o diseño. Dime de qué va en tres líneas y por qué merece la pena.",
    cuando: { tipo: "semanal", dia: 6 },
  },
  {
    icono: "🗂️",
    titulo: "Lo que tengo pendiente",
    instruccion:
      "Mira mis tareas en Notion y dime qué tengo pendiente, ordenado por lo que más urge. Si algo lleva demasiado tiempo parado, señálalo.",
    cuando: { tipo: "semanal", dia: 1 },
  },
  {
    icono: "🔍",
    titulo: "Revisión de la web",
    instruccion:
      "Audítame el SEO de mi web y dime si ha cambiado algo a peor desde la última vez. Solo lo que haya que arreglar, ordenado por lo que más mueve la aguja.",
    cuando: { tipo: "semanal", dia: 1 },
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  onUpgrade: () => void;
  /** Para apagar el punto del menú cuando ya se han visto. */
  onLeidos?: () => void;
}

export default function ProgramarDialog({ open, onClose, plan, onUpgrade, onLeidos }: Props) {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [problema, setProblema] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  /** Cuántos encargos quedan por hacer hoy, y si se están haciendo ahora. */
  const [porHacer, setPorHacer] = useState(0);
  const [haciendo, setHaciendo] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/tareas");
      const d = (await r.json()) as {
        tareas?: Tarea[];
        resultados?: Resultado[];
        pendientes?: number;
        error?: string;
      };
      setTareas(d.tareas ?? []);
      setResultados(d.resultados ?? []);
      setPorHacer(d.pendientes ?? 0);
      setProblema(r.ok ? null : (d.error ?? null));
      return d.pendientes ?? 0;
    } catch {
      setProblema("No se ha podido cargar.");
      return 0;
    } finally {
      setCargando(false);
    }
  }, []);

  /**
   * Ponerse al día, de uno en uno y enseñándolo.
   *
   * Antes esto iba dentro de la propia carga: la pantalla se quedaba en blanco
   * mientras el servidor hacía cuatro llamadas al motor seguidas, y el hosting
   * la cortaba a los sesenta segundos sin entregar nada. Ahora la lista aparece
   * al instante y los partes van cayendo mientras se miran.
   */
  const ponerseAlDia = useCallback(async (cuantos: number) => {
    // Tope de vueltas por si algo se atasca: el servidor no puede hacer que
    // esto gire para siempre.
    for (let i = 0; i < Math.min(cuantos, 12); i++) {
      try {
        const r = await fetch("/api/tareas?hacer=1", { method: "POST" });
        if (!r.ok) break;
        const d = (await r.json()) as {
          hecha?: { tarea: string } | null;
          quedan?: number;
          tareas?: Tarea[];
          resultados?: Resultado[];
        };
        if (d.tareas) setTareas(d.tareas);
        if (d.resultados) setResultados(d.resultados);
        setPorHacer(d.quedan ?? 0);
        setHaciendo(d.quedan ? "siguiente" : null);
        if (!d.hecha || !d.quedan) break;
      } catch {
        break;
      }
    }
    setHaciendo(null);
  }, []);

  useEffect(() => {
    if (!open || plan !== "pro") return;
    void (async () => {
      const quedan = await recargar();
      await fetch("/api/tareas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leidos: true }),
      }).catch(() => {});
      onLeidos?.();
      if (quedan > 0) {
        setHaciendo("primero");
        await ponerseAlDia(quedan);
      }
    })();
  }, [open, plan, recargar, ponerseAlDia, onLeidos]);

  const sinLeer = resultados.filter((r) => r.nueva).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Programar"
      subtitle={
        tareas.length
          ? `${tareas.length === 1 ? "Un encargo" : `${tareas.length} encargos`}. ECLIPSE los hace solo y te los deja aquí.`
          : "Déjale dicho algo una vez y lo hace solo, cada día o cada semana."
      }
      wide
    >
      <div className="space-y-5">
        {plan !== "pro" ? (
          <div className="rounded-xl border border-pro/25 bg-gradient-to-r from-pro/10 to-transparent p-4">
            <div className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
              <Icon.Sparkle width={15} height={15} className="text-pro" />
              Programar es del plan Pro
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Le dejas dicho una vez qué quieres saber y te lo encuentras hecho: cómo va tu tienda,
              planes para el finde, lo que tienes pendiente. Sin pedírselo cada vez.
            </p>
            <button
              onClick={onUpgrade}
              className="mt-3 rounded-xl bg-ink px-4 py-2 text-[13px] font-medium text-void transition hover:opacity-90"
            >
              Ver el plan Pro
            </button>
          </div>
        ) : problema ? (
          <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
            <p className="text-[12.5px] leading-relaxed text-muted">{problema}</p>
          </div>
        ) : null}

        {plan === "pro" && !problema && (
          <>
            {/*
              Mientras se pone al día.

              Decirlo importa más de lo que parece: un encargo tarda medio
              minuto y sin este aviso lo que se ve es una pantalla que no hace
              nada, que es exactamente lo que la gente llama "está roto".
            */}
            {haciendo && (
              <div className="flex items-center gap-2.5 rounded-xl border border-line-soft bg-panel/40 px-3.5 py-3">
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-line border-t-pro" />
                <span className="text-[12.5px] text-muted">
                  Haciendo {porHacer === 1 ? "el encargo que queda" : `los ${porHacer} encargos de hoy`}
                  … tarda un momento; puedes cerrar esto y volver luego.
                </span>
              </div>
            )}

            {resultados.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-2 text-[11.5px] uppercase tracking-wide text-faint">
                  Lo que ha hecho
                  {sinLeer > 0 && (
                    <span className="rounded-md bg-pro/15 px-1.5 py-0.5 text-[10px] font-semibold text-pro">
                      {sinLeer} nuevo{sinLeer > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {resultados.map((r) => (
                    <ResultadoTarjeta
                      key={r.id}
                      resultado={r}
                      abierto={abierto === r.id}
                      onAbrir={() => setAbierto(abierto === r.id ? null : r.id)}
                      onBorrar={async () => {
                        await fetch(`/api/tareas?resultado=${r.id}`, { method: "DELETE" });
                        void recargar();
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">
                Tus encargos
              </div>
              {tareas.length === 0 && !cargando && (
                <p className="mb-2.5 text-[12.5px] leading-relaxed text-muted">
                  Todavía no tienes ninguno. Toca uno de los de abajo para empezar: se pueden
                  cambiar después.
                </p>
              )}
              <div className="space-y-2">
                {tareas.map((t) => (
                  <TareaTarjeta key={t.id} tarea={t} onCambio={() => void recargar()} />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[11.5px] uppercase tracking-wide text-faint">
                Para empezar
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {EJEMPLOS.map((e) => (
                  <button
                    key={e.titulo}
                    disabled={creando}
                    onClick={async () => {
                      setCreando(true);
                      await fetch("/api/tareas", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(e),
                      }).catch(() => {});
                      setCreando(false);
                      void recargar();
                    }}
                    className="rounded-xl border border-line-soft bg-panel/40 p-3 text-left transition hover:border-line hover:bg-panel disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                      <span aria-hidden>{e.icono}</span>
                      {e.titulo}
                    </span>
                    <span className="mt-1 block text-[11.5px] leading-snug text-muted">
                      {e.instruccion.slice(0, 90)}…
                    </span>
                    <span className="mt-1.5 block text-[10.5px] uppercase tracking-wide text-faint">
                      {textoDe(e.cuando)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <NuevoEncargo onCreado={() => void recargar()} />

            <p className="border-t border-line-soft pt-4 text-[11.5px] leading-relaxed text-faint">
              Los encargos se preparan de madrugada y los tienes aquí al levantarte. Si algún día el
              reloj falla, se hacen en cuanto abres la aplicación: por eso a veces tarda un momento
              en cargar esta pantalla.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

function ResultadoTarjeta({
  resultado,
  abierto,
  onAbrir,
  onBorrar,
}: {
  resultado: Resultado;
  abierto: boolean;
  onAbrir: () => void;
  onBorrar: () => void;
}) {
  const fecha = new Date(resultado.hecha).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  return (
    <div
      className={`rounded-xl border p-3.5 transition ${
        resultado.nueva ? "border-pro/30 bg-pro/5" : "border-line-soft bg-panel/40"
      }`}
    >
      <button onClick={onAbrir} className="flex w-full items-start gap-2.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[13.5px] font-medium text-ink">{resultado.titulo}</span>
            {resultado.nueva && <span className="h-1.5 w-1.5 rounded-full bg-pro" aria-hidden />}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-faint">{fecha}</span>
          {!abierto && (
            <span className="mt-1 block text-[12px] leading-snug text-muted">
              {resultado.texto.slice(0, 110)}…
            </span>
          )}
        </span>
        <Icon.ChevronLeft
          width={15}
          height={15}
          className={`mt-1 shrink-0 text-faint transition ${abierto ? "rotate-90" : "-rotate-90"}`}
        />
      </button>

      {abierto && (
        <div className="mt-3 border-t border-line-soft pt-3">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
            {resultado.texto}
          </p>
          <button
            onClick={onBorrar}
            className="mt-3 flex items-center gap-2 text-[12.5px] text-faint transition hover:text-danger"
          >
            <Icon.Trash width={14} height={14} />
            Borrar
          </button>
        </div>
      )}
    </div>
  );
}

function TareaTarjeta({ tarea, onCambio }: { tarea: Tarea; onCambio: () => void }) {
  const [busy, setBusy] = useState(false);

  const cambiar = async (cambios: Record<string, unknown>) => {
    setBusy(true);
    await fetch("/api/tareas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tarea.id, ...cambios }),
    }).catch(() => {});
    setBusy(false);
    onCambio();
  };

  return (
    <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium text-ink">{tarea.titulo}</span>
          <span className="mt-0.5 block text-[11.5px] text-faint">
            {textoDe(tarea.cuando)}
            {!tarea.activa && " · en pausa"}
          </span>
          <span className="mt-1 block text-[12px] leading-snug text-muted">{tarea.instruccion}</span>
          {tarea.ultimoFallo && (
            <span className="mt-1.5 block text-[11.5px] leading-relaxed text-danger">
              La última vez no salió: {tarea.ultimoFallo}
            </span>
          )}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-line-soft pt-3">
        <button
          onClick={() => void cambiar({ activa: !tarea.activa })}
          disabled={busy}
          className="text-[12.5px] text-muted transition hover:text-ink"
        >
          {tarea.activa ? "Pausar" : "Reanudar"}
        </button>
        <button
          onClick={async () => {
            if (!confirm(`¿Borrar «${tarea.titulo}»?`)) return;
            setBusy(true);
            await fetch(`/api/tareas?id=${tarea.id}`, { method: "DELETE" }).catch(() => {});
            setBusy(false);
            onCambio();
          }}
          disabled={busy}
          className="flex items-center gap-1.5 text-[12.5px] text-faint transition hover:text-danger"
        >
          <Icon.Trash width={13} height={13} />
          Borrar
        </button>
      </div>
    </div>
  );
}

function NuevoEncargo({ onCreado }: { onCreado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [instruccion, setInstruccion] = useState("");
  const [tipo, setTipo] = useState<Cuando["tipo"]>("semanal");
  const [dia, setDia] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!abierto)
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-[13px] text-muted transition hover:border-line hover:text-ink"
      >
        <Icon.Plus width={15} height={15} />
        Escribir uno yo
      </button>
    );

  return (
    <div className="rounded-xl border border-line bg-panel/40 p-3.5">
      <label className="block">
        <span className="mb-1.5 block text-[12px] text-faint">¿Qué quieres que haga?</span>
        <textarea
          value={instruccion}
          onChange={(e) => setInstruccion(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Cada lunes, dime qué productos de mi tienda no se han vendido en dos semanas."
          className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
        />
      </label>

      <div className="mt-2.5">
        <span className="mb-1.5 block text-[12px] text-faint">¿Cada cuánto?</span>
        <div className="flex gap-1.5 rounded-xl border border-line-soft bg-panel p-1">
          {(["diario", "laborables", "semanal"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] transition ${
                tipo === t ? "bg-raised text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {t === "diario" ? "Cada día" : t === "laborables" ? "L a V" : "Un día"}
            </button>
          ))}
        </div>
        {tipo === "semanal" && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DIAS.map((d, i) => (
              <button
                key={d}
                onClick={() => setDia(i)}
                className={`rounded-lg px-2.5 py-1.5 text-[12px] capitalize transition ${
                  dia === i ? "bg-raised text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            setAbierto(false);
            setInstruccion("");
            setError(null);
          }}
          className="rounded-xl border border-line px-3 py-2 text-[13px] text-muted transition hover:text-ink"
        >
          Cancelar
        </button>
        <button
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const r = await fetch("/api/tareas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  instruccion,
                  cuando: tipo === "semanal" ? { tipo, dia } : { tipo },
                }),
              });
              const d = (await r.json()) as { error?: string };
              if (!r.ok) throw new Error(d.error ?? "No se ha podido crear.");
              setAbierto(false);
              setInstruccion("");
              onCreado();
            } catch (err) {
              setError(err instanceof Error ? err.message : "No se ha podido crear.");
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy || !instruccion.trim()}
          className="flex-1 rounded-xl bg-ink py-2 text-[13px] font-medium text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
        >
          {busy ? "Un momento…" : "Programarlo"}
        </button>
      </div>
    </div>
  );
}
