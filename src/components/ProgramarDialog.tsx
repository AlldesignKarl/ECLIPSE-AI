"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import * as Icon from "./Icons";
import type { Plan } from "@/lib/types";
import { Sala, type Grupo } from "./GruposDialog";
import { comoSeLeeLaFecha } from "@/lib/grupos/tipos";
import {
  DIAS,
  fechaDe,
  INICIALES,
  proximosDias,
  textoDe,
  type Cuando,
  type Resultado,
  type Tarea,
} from "@/lib/tareas/tipos";

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
 *
 * Lo primero que hay arriba del todo es que te lo planifique él. Empezar por un
 * formulario en blanco era pedirle a alguien que se invente para qué sirve algo
 * que todavía no ha visto funcionar; y aceptar un plan entero de un toque es lo
 * único que hace que esta pantalla se use el primer día en vez del tercero.
 *
 * Los tipos y las cuentas del calendario se traen de `lib/tareas/tipos`, que es
 * el mismo archivo que usa el servidor para decidir qué día toca cada cosa. Con
 * una copia aquí, el día que cambie una regla la pantalla enseñaría una cosa y
 * el servidor haría otra.
 */

/** Un encargo propuesto por ECLIPSE, todavía sin guardar. */
interface Propuesta {
  titulo: string;
  instruccion: string;
  cuando: Cuando;
}

interface PlanPropuesto {
  nota: string;
  encargos: Propuesta[];
}

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
  /** Para apagar el punto del menú cuando ya se han visto. */
  onLeidos?: () => void;
}

export default function ProgramarDialog({ open, onClose, onLeidos }: Props) {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [problema, setProblema] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  /** Cuántos encargos quedan por hacer hoy, y si se están haciendo ahora. */
  const [porHacer, setPorHacer] = useState(0);
  const [haciendo, setHaciendo] = useState<string | null>(null);
  /*
    Dos cosas distintas en la misma pantalla, y con razón: las dos son
    "programar". Las QUEDADAS son con gente y tienen día; los ENCARGOS los hace
    ECLIPSE solo. Se abre en quedadas, que es lo que se usa a diario.
  */
  const [vista, setVista] = useState<"quedadas" | "encargos">("quedadas");

  /*
    La quedada abierta vive AQUÍ y no dentro del calendario.

    Su chat es un modal, y un modal dentro de otro modal no se puede tocar: el
    fondo oscuro del de fuera queda por encima y se come los toques. Así que
    cuando hay una quedada abierta, Programar no se pinta y se pinta el chat.
  */
  const [quedada, setQuedada] = useState<Grupo | null>(null);

  /*
    Qué tiene conectado de verdad.

    Se enseña porque un encargo que habla de "tu tienda" sin tienda conectada no
    puede mirar nada, y eso hay que decirlo ANTES de que el parte llegue por la
    mañana. Que el parte diga "no he podido mirarlo" ya está arreglado por
    dentro; esto es para no llevarse la sorpresa.
  */
  const [conectadas, setConectadas] = useState<number | null>(null);

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
    if (!open) return;
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
  }, [open, recargar, ponerseAlDia, onLeidos]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const d = (await (await fetch("/api/conexiones")).json()) as { conexiones?: unknown[] };
        setConectadas((d.conexiones ?? []).length);
      } catch {
        setConectadas(null);
      }
    })();
  }, [open]);

  const sinLeer = resultados.filter((r) => r.nueva).length;

  if (open && quedada)
    return (
      <Sala
        grupo={quedada}
        open
        onVolver={() => setQuedada(null)}
        onClose={() => {
          setQuedada(null);
          onClose();
        }}
      />
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Programar"
      subtitle={
        vista === "quedadas"
          ? "Quedadas con gente, y encargos que ECLIPSE hace solo."
          : tareas.length
            ? `${tareas.length === 1 ? "Un encargo" : `${tareas.length} encargos`}. ECLIPSE los hace solo y te los deja aquí.`
            : "Déjale dicho algo una vez y lo hace solo, cada día o cada semana."
      }
      wide
    >
      <div className="space-y-5">
        <div className="flex gap-1.5 rounded-xl border border-line-soft bg-panel/40 p-1">
          {([
            { id: "quedadas" as const, nombre: "Quedadas" },
            { id: "encargos" as const, nombre: "Encargos" },
          ]).map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-[13px] transition ${
                vista === v.id ? "bg-raised text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {v.nombre}
              {v.id === "encargos" && sinLeer > 0 && (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-pro align-middle" aria-hidden />
              )}
            </button>
          ))}
        </div>

        {vista === "quedadas" && (
          <Quedadas dentro={quedada} setDentro={setQuedada} />
        )}
        {vista === "encargos" && problema ? (
          <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
            <p className="text-[12.5px] leading-relaxed text-muted">{problema}</p>
          </div>
        ) : null}

        {vista === "encargos" && !problema && (
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
                  . Van cayendo aquí solos; mientras tanto puedes seguir a lo tuyo o cerrar esto.
                </span>
              </div>
            )}

            {/*
              Cuando todavía no hay nada, lo primero es que te lo planifique él.
              Es la diferencia entre entrar y salir sin tocar nada, y salir con
              cuatro encargos puestos.
            */}
            {tareas.length === 0 && <Planificador tareas={tareas} onCreado={() => void recargar()} />}

            {tareas.length > 0 && <Calendario tareas={tareas} />}

            {/*
              Sin nada conectado, dicho antes de que duela.

              Un encargo se escribe una vez y luego se ejecuta solo durante
              meses. Si habla de la tienda y no hay tienda conectada, lo honesto
              es avisar aquí: el parte dirá que no ha podido mirarlo, y saberlo
              de antemano es la diferencia entre "esto funciona raro" y "ah,
              claro, es que no lo he conectado".
            */}
            {tareas.length > 0 && conectadas === 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-line-soft bg-panel/40 px-3.5 py-3">
                <Icon.Plug width={15} height={15} className="mt-0.5 shrink-0 text-faint" />
                <p className="text-[12.5px] leading-relaxed text-muted">
                  No tienes ninguna cuenta conectada. Los encargos que hablen de tu tienda, tus
                  ventas o tu stock no tienen dónde mirarlo: te lo dirán en una línea en vez de
                  inventarse las cifras. Se conecta desde Conexiones, en el menú.
                </p>
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

            {tareas.length > 0 && <Planificador tareas={tareas} onCreado={() => void recargar()} />}

            <div>
              <div className="mb-2 text-[11.5px] uppercase tracking-wide text-faint">
                O empieza por uno hecho
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
  /** Mientras se hace ahora mismo, a mano. */
  const [haciendo, setHaciendo] = useState(false);

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
        {/*
          Hacerlo ahora.

          Porque la otra forma de saber si un encargo recién escrito sirve de
          algo era esperar a mañana, y nadie prueba una cosa que tarda un día en
          contestar. Se salta el calendario a propósito: lo has pedido tú.
        */}
        <button
          onClick={async () => {
            setHaciendo(true);
            await fetch(`/api/tareas?hacer=1&id=${tarea.id}`, { method: "POST" }).catch(() => {});
            setHaciendo(false);
            onCambio();
          }}
          disabled={busy || haciendo}
          className="text-[12.5px] text-pro transition hover:opacity-80 disabled:text-faint"
        >
          {haciendo ? "Haciéndolo…" : "Hacerlo ahora"}
        </button>
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
  /** Para los de un día concreto. Hoy, hasta que se cambie. */
  const [fecha, setFecha] = useState(fechaDe(new Date()));
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
          {(["diario", "laborables", "semanal", "unavez"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] transition ${
                tipo === t ? "bg-raised text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {t === "diario"
                ? "Cada día"
                : t === "laborables"
                  ? "L a V"
                  : t === "semanal"
                    ? "Un día"
                    : "Una fecha"}
            </button>
          ))}
        </div>
        {tipo === "unavez" && (
          <input
            type="date"
            value={fecha}
            min={fechaDe(new Date())}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none transition focus:border-halo/40"
          />
        )}
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
                  cuando:
                    tipo === "semanal"
                      ? { tipo, dia }
                      : tipo === "unavez"
                        ? { tipo, fecha }
                        : { tipo },
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

/**
 * El calendario: los próximos catorce días y qué cae en cada uno.
 *
 * Catorce y no un mes entero porque en un mes entero no se ve nada en un móvil,
 * y porque lo que la gente quiere saber es qué le viene esta semana y la que
 * viene. El día se toca y debajo sale lo que hay: en una rejilla pequeña, tres
 * puntos dicen "hay algo" pero no dicen qué.
 *
 * La cuenta la hace `proximosDias`, la misma que usa el servidor para decidir
 * qué ejecuta. Así lo que se ve aquí es lo que va a pasar, no una aproximación.
 */
function Calendario({ tareas }: { tareas: Tarea[] }) {
  const dias = useMemo(() => proximosDias(tareas, new Date(), 14), [tareas]);
  const hoy = fechaDe(new Date());
  const [elegido, setElegido] = useState<string | null>(null);

  const delDia = dias.find((d) => d.fecha === elegido);

  return (
    <div>
      <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">Lo que viene</div>
      <div className="rounded-xl border border-line-soft bg-panel/40 p-3">
        <div className="grid grid-cols-7 gap-1">
          {dias.map((d) => {
            const esHoy = d.fecha === hoy;
            const activo = d.fecha === elegido;
            return (
              <button
                key={d.fecha}
                onClick={() => setElegido(activo ? null : d.fecha)}
                className={`rounded-lg py-1.5 transition ${
                  activo ? "bg-raised" : "hover:bg-panel"
                } ${esHoy ? "ring-1 ring-pro/40" : ""}`}
              >
                <span className="block text-[9.5px] uppercase text-faint">
                  {INICIALES[d.semana]}
                </span>
                <span className={`block text-[13px] ${d.tareas.length ? "text-ink" : "text-faint"}`}>
                  {Number(d.fecha.slice(8))}
                </span>
                <span className="mt-0.5 flex h-1.5 items-center justify-center gap-0.5">
                  {d.tareas.slice(0, 3).map((t) => (
                    <span key={t.id} className="h-1 w-1 rounded-full bg-pro" aria-hidden />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 border-t border-line-soft pt-2.5">
          {delDia ? (
            delDia.tareas.length ? (
              <ul className="space-y-1">
                {delDia.tareas.map((t) => (
                  <li key={t.id} className="text-[12.5px] text-muted">
                    · {t.titulo}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-faint">Ese día no le toca nada.</p>
            )
          ) : (
            <p className="text-[12px] text-faint">
              Toca un día para ver qué le toca. Lo de cada día se prepara de madrugada.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Que te lo planifique él.
 *
 * Dices qué quieres conseguir y devuelve un plan repartido por días, al momento
 * y sin ejecutar nada: por eso tarda segundos y no minutos. Lo que sale se mira,
 * se le quita lo que no y se acepta entero de un toque.
 *
 * Y si no cuadra, se le pide el cambio con palabras en vez de rehacerlo a mano.
 * Pedir "mejor los martes" es una frase; moverlo tú son cuatro formularios.
 */
function Planificador({ tareas, onCreado }: { tareas: Tarea[]; onCreado: () => void }) {
  const [deseo, setDeseo] = useState("");
  const [plan, setPlan] = useState<PlanPropuesto | null>(null);
  const [fuera, setFuera] = useState<number[]>([]);
  const [ajuste, setAjuste] = useState("");
  const [busy, setBusy] = useState<"planeando" | "guardando" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const IDEAS = tareas.length
    ? ["Añádeme algo para el negocio", "Algo para desconectar los findes", "Quiero aprender algo cada semana"]
    : [
        "Llevar mi tienda al día sin mirarla cada mañana",
        "Estar al tanto de lo que pasa en mi sector",
        "Organizarme la semana y no olvidarme de nada",
      ];

  const pedir = async (cambio?: string) => {
    const quiero = deseo.trim();
    if (!quiero || busy) return;
    setBusy("planeando");
    setError(null);
    try {
      const r = await fetch("/api/tareas?planear=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deseo: quiero, ajuste: cambio, anterior: plan }),
      });
      const d = (await r.json()) as { plan?: PlanPropuesto; error?: string };
      if (!r.ok || !d.plan) throw new Error(d.error ?? "No se ha podido planificar.");
      setPlan(d.plan);
      // Al replanificar se vuelven a marcar todos: lo que se quitó del plan
      // anterior no tiene por qué existir en este.
      setFuera([]);
      setAjuste("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido planificar.");
    } finally {
      setBusy(null);
    }
  };

  const elegidos = (plan?.encargos ?? []).filter((_, i) => !fuera.includes(i));

  const aceptar = async () => {
    if (!elegidos.length || busy) return;
    setBusy("guardando");
    setError(null);
    try {
      const r = await fetch("/api/tareas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encargos: elegidos }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "No se han podido guardar.");
      setPlan(null);
      setDeseo("");
      setFuera([]);
      onCreado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se han podido guardar.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-pro/25 bg-gradient-to-br from-pro/[0.07] to-transparent p-4">
      <div className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
        <Icon.Sparkle width={15} height={15} className="text-pro" />
        Que te lo planifique ECLIPSE
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
        Dile qué quieres conseguir y te reparte los encargos por días. Lo ves antes de que se
        guarde nada, y si no te cuadra se lo dices con palabras.
      </p>

      <textarea
        value={deseo}
        onChange={(e) => setDeseo(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Quiero llevar mi tienda al día sin tener que mirarla cada mañana."
        className="mt-3 w-full resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
      />

      {!plan && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {IDEAS.map((i) => (
            <button
              key={i}
              onClick={() => setDeseo(i)}
              className="rounded-lg border border-line-soft px-2.5 py-1 text-[11.5px] text-muted transition hover:border-line hover:text-ink"
            >
              {i}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-[12.5px] leading-relaxed text-danger">{error}</p>}

      {!plan ? (
        <button
          onClick={() => void pedir()}
          disabled={!deseo.trim() || busy !== null}
          className="mt-3 w-full rounded-xl bg-ink py-2.5 text-[13px] font-medium text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
        >
          {busy === "planeando" ? "Planificándolo…" : "Planifícamelo"}
        </button>
      ) : (
        <div className="mt-3 space-y-2.5">
          {plan.nota && (
            <p className="text-[12.5px] leading-relaxed text-ink">{plan.nota}</p>
          )}

          <div className="space-y-2">
            {plan.encargos.map((e, i) => {
              const dentro = !fuera.includes(i);
              return (
                <button
                  key={`${e.titulo}-${i}`}
                  onClick={() => setFuera(dentro ? [...fuera, i] : fuera.filter((x) => x !== i))}
                  className={`flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                    dentro ? "border-line bg-panel/60" : "border-line-soft bg-transparent opacity-50"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border ${
                      dentro ? "border-pro bg-pro/20 text-pro" : "border-line text-transparent"
                    }`}
                    aria-hidden
                  >
                    <Icon.Check width={11} height={11} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink">{e.titulo}</span>
                    <span className="mt-0.5 block text-[10.5px] uppercase tracking-wide text-faint">
                      {textoDe(e.cuando)}
                    </span>
                    <span className="mt-1 block text-[12px] leading-snug text-muted">
                      {e.instruccion}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <input
              value={ajuste}
              onChange={(e) => setAjuste(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ajuste.trim() && void pedir(ajuste.trim())}
              placeholder="Cámbiame algo: «mejor los martes», «uno menos»…"
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
            />
            <button
              onClick={() => void pedir(ajuste.trim() || "Dame otra vuelta, cámbialo como veas mejor.")}
              disabled={busy !== null}
              className="shrink-0 rounded-xl border border-line px-3 text-[12.5px] text-muted transition hover:text-ink disabled:opacity-50"
            >
              {busy === "planeando" ? "…" : "Pídeselo"}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setPlan(null);
                setFuera([]);
              }}
              disabled={busy !== null}
              className="rounded-xl border border-line px-3 py-2 text-[13px] text-muted transition hover:text-ink"
            >
              Descartar
            </button>
            <button
              onClick={() => void aceptar()}
              disabled={!elegidos.length || busy !== null}
              className="flex-1 rounded-xl bg-ink py-2 text-[13px] font-medium text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
            >
              {busy === "guardando"
                ? "Guardando…"
                : elegidos.length === 1
                  ? "Poner este encargo"
                  : `Poner los ${elegidos.length}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  QUEDADAS                                  */
/* -------------------------------------------------------------------------- */

/**
 * Quedar con gente: un calendario, una nota y un chat.
 *
 * Lo pidió Carlos así: "un calendario en el que eliges fecha y pones una nota,
 * luego te mete a un chat en el que aparece el calendario y los mensajes que tú
 * y tus amigos mandéis".
 *
 * Por dentro una quedada NO es una cosa nueva: es un GRUPO con fecha. Eso hace
 * que nazca ya con todo lo que costó hacer bien —invitar por enlace, fotos,
 * borrar mensajes, ECLIPSE dentro con su interruptor, entrar solo con cuenta— y
 * que no haya dos chats distintos que mantener, con uno quedándose atrás.
 */
function Quedadas({
  dentro,
  setDentro,
}: {
  dentro: Grupo | null;
  setDentro: (g: Grupo | null) => void;
}) {
  const [quedadas, setQuedadas] = useState<Grupo[]>([]);
  const [mes, setMes] = useState(() => {
    const h = new Date();
    return { ano: h.getUTCFullYear(), mes: h.getUTCMonth() };
  });
  const [dia, setDia] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const d = (await (await fetch("/api/grupos")).json()) as { grupos?: Grupo[] };
      setQuedadas((d.grupos ?? []).filter((g) => g.fecha));
    } catch {
      /* se verá al siguiente intento */
    }
  }, []);

  useEffect(() => {
    if (!dentro) void cargar();
  }, [cargar, dentro]);

  // Si hay una quedada abierta, el calendario no se pinta: manda el chat, y lo
  // saca ProgramarDialog en lugar de su propio modal.
  if (dentro) return null;

  const hoy = fechaDe(new Date());
  const primero = new Date(Date.UTC(mes.ano, mes.mes, 1));
  const cuantos = new Date(Date.UTC(mes.ano, mes.mes + 1, 0)).getUTCDate();
  // La semana empieza en lunes, que es como se leen los calendarios de aquí.
  const hueco = (primero.getUTCDay() + 6) % 7;
  const nombreMes = primero.toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });

  const delDia = (f: string) => quedadas.filter((q) => q.fecha === f);
  const proximas = [...quedadas].sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));

  const crear = async () => {
    const texto = nota.trim();
    if (!dia || !texto || creando) return;
    setCreando(true);
    setError(null);
    try {
      const r = await fetch("/api/grupos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: texto.slice(0, 50), fecha: dia, nota: texto }),
      });
      const d = (await r.json()) as { grupo?: Grupo; error?: string };
      if (!r.ok || !d.grupo) throw new Error(d.error ?? "No se ha podido crear.");
      setNota("");
      setDia(null);
      await cargar();
      // Y directo al chat: es lo siguiente que se quiere hacer siempre.
      setDentro(d.grupo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido crear.");
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line-soft bg-panel/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={() => setMes((m) => (m.mes === 0 ? { ano: m.ano - 1, mes: 11 } : { ...m, mes: m.mes - 1 }))}
            aria-label="Mes anterior"
            className="p-1 text-faint transition hover:text-ink"
          >
            <Icon.ChevronLeft width={16} height={16} />
          </button>
          <span className="text-[13px] font-medium capitalize text-ink">{nombreMes}</span>
          <button
            onClick={() => setMes((m) => (m.mes === 11 ? { ano: m.ano + 1, mes: 0 } : { ...m, mes: m.mes + 1 }))}
            aria-label="Mes siguiente"
            className="rotate-180 p-1 text-faint transition hover:text-ink"
          >
            <Icon.ChevronLeft width={16} height={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
            <span key={`${d}-${i}`} className="py-1 text-[9.5px] uppercase text-faint">
              {d}
            </span>
          ))}
          {Array.from({ length: hueco }, (_, i) => (
            <span key={`hueco-${i}`} />
          ))}
          {Array.from({ length: cuantos }, (_, i) => {
            const f = `${mes.ano}-${String(mes.mes + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
            const tiene = delDia(f).length;
            const pasado = f < hoy;
            return (
              <button
                key={f}
                onClick={() => {
                  setDia(dia === f ? null : f);
                  setError(null);
                }}
                className={`rounded-lg py-1.5 transition ${
                  dia === f ? "bg-raised" : "hover:bg-panel"
                } ${f === hoy ? "ring-1 ring-pro/40" : ""}`}
              >
                <span className={`block text-[13px] ${pasado && !tiene ? "text-faint" : "text-ink"}`}>
                  {i + 1}
                </span>
                <span className="mt-0.5 flex h-1.5 items-center justify-center gap-0.5">
                  {Array.from({ length: Math.min(tiene, 3) }, (_, p) => (
                    <span key={p} className="h-1 w-1 rounded-full bg-pro" aria-hidden />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {dia && (
          <div className="mt-2.5 border-t border-line-soft pt-2.5">
            <span className="block text-[12px] capitalize text-muted">{comoSeLeeLaFecha(dia)}</span>

            {delDia(dia).map((q) => (
              <button
                key={q.id}
                onClick={() => setDentro(q)}
                className="mt-1.5 flex w-full items-center gap-2 rounded-lg border border-line-soft bg-panel/60 px-3 py-2 text-left transition hover:border-line"
              >
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{q.nombre}</span>
                <span className="shrink-0 text-[11px] text-faint">
                  {q.miembros.length} {q.miembros.length === 1 ? "persona" : "personas"}
                </span>
              </button>
            ))}

            <div className="mt-2 flex gap-2">
              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void crear()}
                maxLength={120}
                placeholder="Cena en casa de Ana, traed postre"
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
              />
              <button
                onClick={() => void crear()}
                disabled={!nota.trim() || creando}
                className="shrink-0 rounded-xl bg-ink px-3 text-[12.5px] font-medium text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
              >
                {creando ? "…" : "Quedar"}
              </button>
            </div>
            {error && <p className="mt-1.5 text-[12px] leading-relaxed text-danger">{error}</p>}
          </div>
        )}
      </div>

      {proximas.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">Tus quedadas</div>
          <div className="space-y-2">
            {proximas.map((q) => (
              <button
                key={q.id}
                onClick={() => setDentro(q)}
                className="flex w-full items-center gap-3 rounded-xl border border-line-soft bg-panel/40 p-3.5 text-left transition hover:border-line hover:bg-panel"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-ink">{q.nombre}</span>
                  <span className="mt-0.5 block text-[11.5px] capitalize text-faint">
                    {q.fecha ? comoSeLeeLaFecha(q.fecha) : ""} · {q.miembros.length}{" "}
                    {q.miembros.length === 1 ? "persona" : "personas"}
                  </span>
                </span>
                <Icon.ChevronLeft width={15} height={15} className="shrink-0 rotate-180 text-faint" />
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11.5px] leading-relaxed text-faint">
        Toca un día, escribe de qué va y se abre un chat para esa quedada. Dentro puedes invitar
        con un enlace, mandar fotos y encender a ECLIPSE si queréis que os ayude a planificarlo.
        Para entrar hace falta tener cuenta en ECLIPSE.
      </p>
    </div>
  );
}
