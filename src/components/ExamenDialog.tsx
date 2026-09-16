"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Modal from "./Modal";
import * as Icon from "./Icons";
import Markdown from "./Markdown";
import type { Plan } from "@/lib/types";

/**
 * Modo Examen: estudiar con TUS apuntes.
 *
 * Un solo diálogo con seis pantallas dentro —lista, crear, materiales,
 * resumen, quiz y desarrollo— y no seis diálogos, por lo mismo que las
 * quedadas reutilizan el chat de los grupos: un estudiante que está
 * preparando un examen no quiere navegar, quiere volver atrás y seguir.
 *
 * Todo lo que se ve aquí sale del servidor: los exámenes y el progreso viven
 * en la cuenta, no en este navegador. Se estudia en el autobús con el móvil y
 * en casa con el ordenador, y la semana de exámenes nadie quiere descubrir que
 * sus apuntes estaban en la caché del otro aparato.
 */

/* --------------------------------- Tipos --------------------------------- */

interface Fuente {
  archivo: string;
  pagina?: number;
  seccion?: string;
}

interface TemaDelMapa {
  nombre: string;
  emoji?: string;
  cobertura: number;
}

interface Material {
  id: string;
  nombre: string;
  tipo: "imagen" | "pdf" | "texto";
  legible: boolean;
  aviso?: string;
}

interface Pregunta {
  id: string;
  enunciado: string;
  opciones: string[];
  correcta: number;
  explicacion: string;
  tema: string;
  fuente: Fuente;
}

interface PreguntaLarga {
  id: string;
  enunciado: string;
  puntos: number;
  espera: string[];
  tema: string;
  fuente: Fuente;
  trozo: string;
}

interface Correccion {
  puntos: number;
  bien: string[];
  falta: string[];
  errores: string[];
  mejorar: string[];
  esperada: string;
}

interface Intento {
  id: string;
  tipo: "quiz" | "desarrollo";
  cuando: number;
  nota: number;
  aciertos: number;
  total: number;
  porTema: Record<string, { bien: number; total: number }>;
  falladas: string[];
}

interface Examen {
  id: string;
  asignatura: string;
  titulo: string;
  fecha?: string;
  temas: string[];
  extra?: string;
  materiales: Material[];
  mapa: TemaDelMapa[];
  extracto?: { id: string; tema: string; texto: string; fuente: Fuente }[];
  resumen?: { rapido: string; completo: string };
  intentos: Intento[];
  creado: number;
  analizado?: number;
  /** Solo en la lista: cuántos trozos tiene, sin traerlos. */
  trozos?: number;
}

type Pantalla = "lista" | "crear" | "materiales" | "examen" | "quiz" | "desarrollo";

/* ------------------------------- Utilidades ------------------------------ */

/** "martes, 21 de octubre", que es como se dice una fecha. */
function comoSeLee(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  if (!a || !m || !d) return fecha;
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** Cuántos días faltan. Es lo primero que mira quien tiene un examen. */
function cuantoFalta(fecha?: string): string | null {
  if (!fecha) return null;
  const [a, m, d] = fecha.split("-").map(Number);
  if (!a) return null;
  const hoy = new Date();
  const dias = Math.round(
    (Date.UTC(a, m - 1, d) - Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())) /
      86_400_000,
  );
  if (dias < 0) return "ya pasó";
  if (dias === 0) return "¡hoy!";
  if (dias === 1) return "mañana";
  return `en ${dias} días`;
}

/** La barra de cobertura de un tema. Lo mismo que pidió Carlos, en píxeles. */
function Barra({ valor, tono = "bg-halo" }: { valor: number; tono?: string }) {
  return (
    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel">
      <span
        className={`block h-full rounded-full ${tono} transition-all duration-500`}
        style={{ width: `${Math.min(100, Math.max(0, valor))}%` }}
      />
    </span>
  );
}

/** Verde si va bien, ámbar si regular, rojo si toca repasar. */
function tonoDe(porcentaje: number): string {
  if (porcentaje >= 80) return "bg-ok";
  if (porcentaje >= 60) return "bg-pro";
  return "bg-danger";
}

/* ------------------------------ El diálogo ------------------------------- */

export default function ExamenDialog({
  open,
  onClose,
  plan,
  onUpgrade,
}: {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  onUpgrade: () => void;
}) {
  const [pantalla, setPantalla] = useState<Pantalla>("lista");
  const [examenes, setExamenes] = useState<Examen[]>([]);
  const [abierto, setAbierto] = useState<Examen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [problema, setProblema] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/examen");
      const d = (await r.json()) as { examenes?: Examen[]; error?: string; sinCuenta?: boolean };
      if (d.sinCuenta) {
        setProblema("Para el Modo Examen hay que entrar con tu cuenta: los apuntes se guardan en ella.");
        return;
      }
      if (d.error) return setProblema(d.error);
      setExamenes(d.examenes ?? []);
      setProblema(null);
    } catch {
      setProblema("No se ha podido cargar. Mira la conexión y vuelve a abrirlo.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setCargando(true);
    void cargar();
  }, [open, cargar]);

  /** Abrir uno entero, con su extracto, que en la lista no viene. */
  const entrar = async (id: string) => {
    const r = await fetch(`/api/examen?id=${id}`);
    const d = (await r.json()) as { examen?: Examen };
    if (d.examen) {
      setAbierto(d.examen);
      setPantalla(d.examen.analizado ? "examen" : "materiales");
    }
  };

  const volver = () => {
    setAbierto(null);
    setPantalla("lista");
    void cargar();
  };

  if (plan !== "pro" && pantalla === "lista" && !cargando)
    return (
      <Modal open={open} onClose={onClose} title="Modo Examen" subtitle="Estudia con tus propios apuntes." wide>
        <div className="rounded-xl border border-pro/25 bg-gradient-to-r from-pro/10 to-transparent p-4">
          <div className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
            <Icon.Sparkle width={15} height={15} className="text-pro" />
            El Modo Examen es del plan Pro
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            Subes fotos de tus apuntes y ECLIPSE te saca el resumen, te hace test y te corrige
            exámenes de desarrollo. Todo con TU temario: nada de preguntas de cultura general.
          </p>
          <button
            onClick={onUpgrade}
            className="mt-3 rounded-xl bg-ink px-4 py-2 text-[13px] font-medium text-void transition hover:opacity-90"
          >
            Ver el plan Pro
          </button>
        </div>
      </Modal>
    );

  const titulo = abierto ? abierto.titulo : "Modo Examen";
  const subtitulo = abierto
    ? `${abierto.asignatura}${abierto.fecha ? ` · ${cuantoFalta(abierto.fecha)}` : ""}`
    : "Estudia con tus propios apuntes.";

  return (
    <Modal open={open} onClose={onClose} title={titulo} subtitle={subtitulo} wide>
      {abierto && (
        <button
          onClick={volver}
          className="mb-3 flex items-center gap-1 text-[12.5px] text-faint transition hover:text-ink"
        >
          <Icon.ChevronLeft width={14} height={14} />
          Mis exámenes
        </button>
      )}

      {problema && (
        <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5 text-[12.5px] leading-relaxed text-muted">
          {problema}
        </div>
      )}

      {!problema && pantalla === "lista" && (
        <Lista
          examenes={examenes}
          cargando={cargando}
          onNuevo={() => setPantalla("crear")}
          onEntrar={entrar}
          onBorrar={async (id) => {
            if (!confirm("¿Borrar este examen con sus apuntes y su progreso?")) return;
            await fetch(`/api/examen?id=${id}`, { method: "DELETE" });
            void cargar();
          }}
        />
      )}

      {!problema && pantalla === "crear" && (
        <Crear
          onHecho={(examen) => {
            setAbierto(examen);
            setPantalla("materiales");
          }}
          onCancelar={() => setPantalla("lista")}
        />
      )}

      {!problema && abierto && pantalla === "materiales" && (
        <Materiales
          examen={abierto}
          onListo={(examen) => {
            setAbierto(examen);
            setPantalla("examen");
          }}
        />
      )}

      {!problema && abierto && pantalla === "examen" && (
        <Dentro
          examen={abierto}
          onMas={() => setPantalla("materiales")}
          onQuiz={() => setPantalla("quiz")}
          onDesarrollo={() => setPantalla("desarrollo")}
          onRecargar={async () => {
            const r = await fetch(`/api/examen?id=${abierto.id}`);
            const d = (await r.json()) as { examen?: Examen };
            if (d.examen) setAbierto(d.examen);
          }}
        />
      )}

      {!problema && abierto && pantalla === "quiz" && (
        <Quiz examen={abierto} onSalir={() => setPantalla("examen")} />
      )}

      {!problema && abierto && pantalla === "desarrollo" && (
        <Desarrollo examen={abierto} onSalir={() => setPantalla("examen")} />
      )}
    </Modal>
  );
}

/* ------------------------------ 1. La lista ------------------------------ */

function Lista({
  examenes,
  cargando,
  onNuevo,
  onEntrar,
  onBorrar,
}: {
  examenes: Examen[];
  cargando: boolean;
  onNuevo: () => void;
  onEntrar: (id: string) => void;
  onBorrar: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <button
        onClick={onNuevo}
        className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-panel px-3.5 py-3 text-[13.5px] font-medium text-ink transition hover:border-halo/30 hover:bg-raised"
      >
        <Icon.Plus width={16} height={16} />
        Preparar un examen
      </button>

      {cargando && <p className="text-[12.5px] text-faint">Un momento…</p>}

      {!cargando && examenes.length === 0 && (
        <p className="text-[12.5px] leading-relaxed text-muted">
          Aquí van tus exámenes. Dices de qué es y qué entra, subes fotos de tus apuntes, y
          ECLIPSE te saca el resumen, te pregunta y te corrige. Todo con TU temario.
        </p>
      )}

      {examenes.map((e) => {
        const falta = cuantoFalta(e.fecha);
        const ultima = e.intentos[0]?.nota;
        return (
          <div
            key={e.id}
            className="rounded-xl border border-line-soft bg-panel/40 p-3.5 transition hover:border-line"
          >
            <button onClick={() => onEntrar(e.id)} className="block w-full text-left">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
                  {e.titulo}
                </span>
                {falta && (
                  <span className={`shrink-0 text-[11px] ${falta === "¡hoy!" || falta === "mañana" ? "text-danger" : "text-faint"}`}>
                    {falta}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-faint">
                <span>{e.asignatura}</span>
                {e.analizado ? (
                  <span>· {e.trozos ?? e.extracto?.length ?? 0} cosas aprendidas de tus apuntes</span>
                ) : (
                  <span className="text-pro">· sin materiales todavía</span>
                )}
                {ultima !== undefined && <span>· última nota {ultima.toFixed(1)}</span>}
              </div>
            </button>
            <button
              onClick={() => onBorrar(e.id)}
              className="mt-2 text-[11px] text-faint transition hover:text-danger"
            >
              Borrar
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- 2. Crear -------------------------------- */

function Crear({
  onHecho,
  onCancelar,
}: {
  onHecho: (examen: Examen) => void;
  onCancelar: () => void;
}) {
  const [asignatura, setAsignatura] = useState("");
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [temas, setTemas] = useState("");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = async () => {
    if (!asignatura.trim()) return setError("Ponle al menos la asignatura.");
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/examen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "crear",
          asignatura,
          titulo,
          fecha,
          // Los temas se escriben como se dicen, separados por comas o por líneas.
          temas: temas.split(/[,\n]/).map((t) => t.trim()).filter(Boolean),
          extra,
        }),
      });
      const d = (await r.json()) as { examen?: Examen; error?: string };
      if (d.examen) onHecho(d.examen);
      else setError(d.error ?? "No se ha podido crear.");
    } catch {
      setError("No se ha podido crear. Mira la conexión.");
    } finally {
      setBusy(false);
    }
  };

  const campo =
    "w-full rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40";

  return (
    <div className="space-y-3">
      <input
        value={asignatura}
        onChange={(e) => setAsignatura(e.target.value)}
        placeholder="Asignatura (Biología, Historia…)"
        maxLength={60}
        className={campo}
        autoFocus
      />
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Qué examen es (Tema 4, Parcial 2…)"
        maxLength={80}
        className={campo}
      />
      <div>
        <label className="mb-1 block text-[11.5px] uppercase tracking-wide text-faint">
          Cuándo es (si lo sabes)
        </label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className={campo}
        />
      </div>
      <textarea
        value={temas}
        onChange={(e) => setTemas(e.target.value)}
        placeholder="Qué entra, separado por comas: la célula, mitosis, meiosis…"
        rows={2}
        maxLength={1000}
        className={`${campo} resize-none`}
      />
      <textarea
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
        placeholder="Lo que quieras contarme: lo que dijo el profesor que cae, lo que no entra, cómo es el examen…"
        rows={3}
        maxLength={2000}
        className={`${campo} resize-none`}
      />

      {error && <p className="text-[12.5px] text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onCancelar}
          className="rounded-xl border border-line px-4 py-2.5 text-[13px] text-muted transition hover:text-ink"
        >
          Cancelar
        </button>
        <button
          onClick={() => void crear()}
          disabled={busy || !asignatura.trim()}
          className="flex-1 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
        >
          {busy ? "Creando…" : "Siguiente: subir apuntes"}
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- 3. Materiales ----------------------------- */

/** El tope de lo que se manda de una vez, para que el hosting no lo corte. */
const MAX_POR_TANDA = 4_000_000;

function Materiales({ examen, onListo }: { examen: Examen; onListo: (e: Examen) => void }) {
  const [pendientes, setPendientes] = useState<{ nombre: string; kind: string; mime: string; datos: string; previa?: string }[]>([]);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ilegibles, setIlegibles] = useState<string[]>([]);
  const entrada = useRef<HTMLInputElement>(null);

  const meter = async (ficheros: FileList | null) => {
    if (!ficheros?.length) return;
    setError(null);

    for (const f of Array.from(ficheros).slice(0, 10)) {
      const esImagen = f.type.startsWith("image/");
      const esPdf = f.type === "application/pdf";

      try {
        if (esImagen) {
          // Se encoge aquí, en el móvil: una foto de doce megapíxeles no cabe
          // en la petición y el modelo la reduce igual antes de mirarla.
          const encogida = await encoger(f);
          setPendientes((p) => [
            ...p,
            { nombre: f.name, kind: "image", mime: "image/jpeg", datos: encogida.datos, previa: encogida.previa },
          ]);
        } else if (esPdf) {
          const datos = await base64De(f);
          setPendientes((p) => [...p, { nombre: f.name, kind: "pdf", mime: "application/pdf", datos }]);
        } else {
          const texto = await f.text();
          setPendientes((p) => [
            ...p,
            { nombre: f.name, kind: "text", mime: "text/plain", datos: texto.slice(0, 200_000) },
          ]);
        }
      } catch {
        setError(`No he podido abrir ${f.name}. Prueba con otro archivo.`);
      }
    }
  };

  const analizar = async () => {
    setAnalizando(true);
    setError(null);
    setIlegibles([]);
    try {
      /*
        De tanda en tanda, no todo de golpe.

        Las peticiones de este hosting se cortan sobre los cuatro megas y medio,
        y diez fotos de apuntes pasan de eso de sobra. Se mandan por grupos que
        quepan; el servidor va sumando al mismo examen.
      */
      let tanda: typeof pendientes = [];
      let peso = 0;
      let ultimo: Examen | null = null;
      const tandas: (typeof pendientes)[] = [];

      for (const m of pendientes) {
        if (peso + m.datos.length > MAX_POR_TANDA && tanda.length) {
          tandas.push(tanda);
          tanda = [];
          peso = 0;
        }
        tanda.push(m);
        peso += m.datos.length;
      }
      if (tanda.length || !tandas.length) tandas.push(tanda);

      const noLegibles: string[] = [];
      for (const grupo of tandas) {
        const r = await fetch("/api/examen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accion: "analizar",
            id: examen.id,
            materiales: grupo.map(({ nombre, kind, mime, datos }) => ({ nombre, kind, mime, datos })),
          }),
        });
        const d = (await r.json()) as { examen?: Examen; error?: string; ilegibles?: string[] };
        if (d.error) throw new Error(d.error);
        if (d.examen) ultimo = d.examen;
        noLegibles.push(...(d.ilegibles ?? []));
      }

      setIlegibles(noLegibles);
      setPendientes([]);

      // Si algo no se ha leído, no se sale de aquí: hay que poder volver a
      // subirlo. Callarlo sería dejar que estudie con apuntes que no están.
      if (!noLegibles.length && ultimo) onListo(ultimo);
      else if (ultimo) onListo(ultimo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido analizar.");
    } finally {
      setAnalizando(false);
    }
  };

  if (analizando)
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-pro" />
        <p className="text-[13.5px] text-ink">Leyendo tus apuntes…</p>
        <p className="max-w-xs text-[12px] leading-relaxed text-faint">
          Estoy sacando de tus materiales lo que de verdad entra: temas, definiciones, fórmulas y
          datos. Tarda un poco, pero es lo que hace que luego no me invente nada.
        </p>
      </div>
    );

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-muted">
        Sube fotos de tus apuntes, del libro, de los ejercicios, o los PDF que te haya pasado el
        profesor. Cuantos más, mejor te preguntaré: todo lo que te enseñe saldrá de aquí.
      </p>

      <input
        ref={entrada}
        type="file"
        accept="image/*,application/pdf,.txt,.md,.csv"
        multiple
        className="hidden"
        onChange={(e) => {
          void meter(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => entrada.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-6 text-[13px] text-muted transition hover:border-halo/40 hover:text-ink"
      >
        <Icon.Camera width={18} height={18} />
        Añadir fotos o archivos
      </button>

      {pendientes.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {pendientes.map((m, i) => (
            <div key={`${m.nombre}-${i}`} className="relative overflow-hidden rounded-xl border border-line-soft bg-panel/40">
              {m.previa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.previa} alt="" className="h-20 w-full object-cover" />
              ) : (
                <div className="flex h-20 items-center justify-center text-faint">
                  <Icon.Paperclip width={18} height={18} />
                </div>
              )}
              <div className="truncate px-2 py-1 text-[10.5px] text-faint">{m.nombre}</div>
              <button
                onClick={() => setPendientes((p) => p.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 rounded-full bg-void/80 p-1 text-faint transition hover:text-danger"
                aria-label="Quitar"
              >
                <Icon.Close width={12} height={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {examen.materiales.length > 0 && (
        <div className="rounded-xl border border-line-soft bg-panel/40 p-3">
          <div className="mb-1 text-[11.5px] uppercase tracking-wide text-faint">Ya subido</div>
          <ul className="space-y-1">
            {examen.materiales.map((m) => (
              <li key={m.id} className="flex items-start gap-2 text-[12px]">
                <span className={m.legible ? "text-ok" : "text-danger"}>{m.legible ? "✓" : "⚠"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-muted">{m.nombre}</span>
                  {m.aviso && <span className="block text-[11px] leading-relaxed text-danger">{m.aviso}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ilegibles.length > 0 && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-[12.5px] leading-relaxed text-ink">
          No he podido leer {ilegibles.length === 1 ? "este archivo" : "estos archivos"}:{" "}
          <span className="text-muted">{ilegibles.join(", ")}</span>. Si son fotos, prueba otra vez
          con más luz, sin mover y con la hoja entera dentro.
        </div>
      )}

      {error && <p className="text-[12.5px] text-danger">{error}</p>}

      <div className="flex gap-2">
        {examen.analizado && (
          <button
            onClick={() => onListo(examen)}
            className="rounded-xl border border-line px-4 py-2.5 text-[13px] text-muted transition hover:text-ink"
          >
            Volver
          </button>
        )}
        <button
          onClick={() => void analizar()}
          disabled={!pendientes.length}
          className="flex-1 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
        >
          {pendientes.length ? `Analizar ${pendientes.length}` : "Añade algo primero"}
        </button>
      </div>
    </div>
  );
}

/** Encoge una foto en el navegador y la devuelve en base64 sin cabecera. */
async function encoger(f: File): Promise<{ datos: string; previa: string }> {
  const LADO = 1600;
  const bitmap = await createImageBitmap(f);
  const escala = Math.min(1, LADO / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  lienzo.getContext("2d")?.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  // Calidad alta: aquí se lee letra escrita a mano, y bajarla de más es
  // convertir unos apuntes legibles en una mancha.
  const url = lienzo.toDataURL("image/jpeg", 0.85);
  return { datos: url.split(",")[1] ?? "", previa: url };
}

async function base64De(f: File): Promise<string> {
  const buffer = await f.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

/* -------------------------- 4. Dentro del examen ------------------------- */

function Dentro({
  examen,
  onMas,
  onQuiz,
  onDesarrollo,
  onRecargar,
}: {
  examen: Examen;
  onMas: () => void;
  onQuiz: () => void;
  onDesarrollo: () => void;
  onRecargar: () => void;
}) {
  const [vista, setVista] = useState<"mapa" | "resumen" | "progreso">("mapa");
  const [resumen, setResumen] = useState<string>("");
  const [largo, setLargo] = useState<"rapido" | "completo">("rapido");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pedirResumen = useCallback(
    async (cual: "rapido" | "completo") => {
      setCargando(true);
      setError(null);
      try {
        const r = await fetch("/api/examen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "resumen", id: examen.id, largo: cual }),
        });
        const d = (await r.json()) as { texto?: string; error?: string };
        if (d.error) setError(d.error);
        else setResumen(d.texto ?? "");
      } catch {
        setError("No se ha podido. Prueba otra vez.");
      } finally {
        setCargando(false);
      }
    },
    [examen.id],
  );

  useEffect(() => {
    if (vista === "resumen" && !cargando) void pedirResumen(largo);
    // Solo al cambiar de vista o de largo: pedirlo en cada pintada sería una
    // llamada al modelo por cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, largo]);

  const notas = examen.intentos.map((i) => i.nota);
  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;

  const flojos = (() => {
    const suma: Record<string, { bien: number; total: number }> = {};
    for (const i of examen.intentos)
      for (const [t, r] of Object.entries(i.porTema)) {
        suma[t] ??= { bien: 0, total: 0 };
        suma[t].bien += r.bien;
        suma[t].total += r.total;
      }
    return Object.entries(suma)
      .map(([tema, r]) => ({ tema, acierto: r.total ? Math.round((r.bien / r.total) * 100) : 0 }))
      .sort((a, b) => a.acierto - b.acierto);
  })();

  const pestaña = (id: typeof vista, texto: string) => (
    <button
      key={id}
      onClick={() => setVista(id)}
      className={`flex-1 rounded-lg px-2 py-1.5 text-[12.5px] transition ${
        vista === id ? "bg-raised text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {texto}
    </button>
  );

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onQuiz}
          className="rounded-xl border border-line bg-panel px-3 py-3 text-[13px] font-medium text-ink transition hover:border-halo/30 hover:bg-raised"
        >
          🧠 Ponme un test
        </button>
        <button
          onClick={onDesarrollo}
          className="rounded-xl border border-line bg-panel px-3 py-3 text-[13px] font-medium text-ink transition hover:border-halo/30 hover:bg-raised"
        >
          📝 Examen de desarrollo
        </button>
      </div>

      <div className="flex gap-1.5 rounded-xl border border-line-soft bg-panel p-1">
        {pestaña("mapa", "Qué entra")}
        {pestaña("resumen", "Resumen")}
        {pestaña("progreso", "Progreso")}
      </div>

      {vista === "mapa" && (
        <div className="space-y-3">
          {examen.mapa.length === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-muted">
              Todavía no he leído nada. Sube fotos de tus apuntes y te digo qué entra.
            </p>
          ) : (
            <div className="space-y-2">
              {examen.mapa.map((t) => (
                <div key={t.nombre} className="flex items-center gap-2.5">
                  <span className="w-5 shrink-0 text-center text-[13px]">{t.emoji ?? "•"}</span>
                  <span className="w-28 shrink-0 truncate text-[12.5px] text-ink">{t.nombre}</span>
                  <Barra valor={t.cobertura} />
                  <span className="w-9 shrink-0 text-right text-[11px] text-faint">{t.cobertura}%</span>
                </div>
              ))}
              <p className="pt-1 text-[11px] leading-relaxed text-faint">
                El porcentaje es cuánto material tienes de cada tema, no lo que sabes. Un tema bajo
                significa que tienes pocos apuntes de él: si entra, sube más.
              </p>
            </div>
          )}

          <button
            onClick={onMas}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-line-soft py-2.5 text-[12.5px] text-muted transition hover:border-line hover:text-ink"
          >
            <Icon.Plus width={14} height={14} />
            Añadir más apuntes
          </button>
        </div>
      )}

      {vista === "resumen" && (
        <div className="space-y-3">
          <div className="flex gap-1.5 rounded-xl border border-line-soft bg-panel p-1">
            {(["rapido", "completo"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLargo(l)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[12.5px] transition ${
                  largo === l ? "bg-raised text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {l === "rapido" ? "Rápido" : "Completo"}
              </button>
            ))}
          </div>

          {cargando && (
            <div className="flex items-center gap-2.5 py-6 text-[12.5px] text-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-pro" />
              Preparándote el resumen…
            </div>
          )}
          {error && <p className="text-[12.5px] text-danger">{error}</p>}
          {!cargando && resumen && (
            // El mismo Markdown que pinta las respuestas del chat: mismos
            // títulos, mismas listas, mismo código. Un resumen que se viera
            // distinto a una respuesta parecería de otra aplicación.
            <div className="text-[13.5px]">
              <Markdown>{resumen}</Markdown>
            </div>
          )}
        </div>
      )}

      {vista === "progreso" && (
        <div className="space-y-3">
          {examen.intentos.length === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-muted">
              Todavía no has hecho ningún test. Cuando hagas uno, aquí verás cómo vas y qué te
              conviene repasar.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-4 rounded-xl border border-line-soft bg-panel/40 p-3.5">
                <div>
                  <div className="text-[22px] font-semibold text-ink">{media?.toFixed(1)}</div>
                  <div className="text-[11px] text-faint">nota media</div>
                </div>
                <div>
                  <div className="text-[22px] font-semibold text-ink">{examen.intentos.length}</div>
                  <div className="text-[11px] text-faint">
                    {examen.intentos.length === 1 ? "prueba" : "pruebas"}
                  </div>
                </div>
                {notas.length > 1 && (
                  <div className="ml-auto flex h-10 items-end gap-0.5">
                    {[...examen.intentos]
                      .reverse()
                      .slice(-12)
                      .map((i) => (
                        <span
                          key={i.id}
                          className={`w-1.5 rounded-t ${tonoDe(i.nota * 10)}`}
                          style={{ height: `${Math.max(8, i.nota * 10)}%` }}
                          title={`${i.nota.toFixed(1)}`}
                        />
                      ))}
                  </div>
                )}
              </div>

              {flojos.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">
                    Por temas
                  </div>
                  <div className="space-y-2">
                    {flojos.map((t) => (
                      <div key={t.tema} className="flex items-center gap-2.5">
                        <span className="w-28 shrink-0 truncate text-[12.5px] text-ink">{t.tema}</span>
                        <Barra valor={t.acierto} tono={tonoDe(t.acierto)} />
                        <span className="w-9 shrink-0 text-right text-[11px] text-faint">
                          {t.acierto}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {flojos.filter((t) => t.acierto < 70).length > 0 && (
                <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
                  <div className="text-[12.5px] font-medium text-ink">🎯 Yo repasaría</div>
                  <ol className="mt-1 space-y-0.5">
                    {flojos
                      .filter((t) => t.acierto < 70)
                      .slice(0, 3)
                      .map((t, i) => (
                        <li key={t.tema} className="text-[12px] text-muted">
                          {i + 1}. {t.tema}
                        </li>
                      ))}
                  </ol>
                </div>
              )}
            </>
          )}
          <button
            onClick={onRecargar}
            className="text-[11.5px] text-faint transition hover:text-ink"
          >
            Actualizar
          </button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- 5. Quiz ------------------------------- */

const TIPOS = [
  { id: "rapido", texto: "⚡ Quiz rápido" },
  { id: "repaso", texto: "🧠 Repaso" },
  { id: "dificil", texto: "🔥 Difícil" },
  { id: "fallos", texto: "🎯 Mis fallos" },
] as const;

function Quiz({ examen, onSalir }: { examen: Examen; onSalir: () => void }) {
  const [preguntas, setPreguntas] = useState<Pregunta[] | null>(null);
  const [voy, setVoy] = useState(0);
  const [elegidas, setElegidas] = useState<number[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acabado, setAcabado] = useState(false);

  /** Los temas que peor lleva, para el botón de «mis fallos». */
  const flojos = (() => {
    const suma: Record<string, { bien: number; total: number }> = {};
    for (const i of examen.intentos)
      for (const [t, r] of Object.entries(i.porTema)) {
        suma[t] ??= { bien: 0, total: 0 };
        suma[t].bien += r.bien;
        suma[t].total += r.total;
      }
    return Object.entries(suma)
      .filter(([, r]) => r.total && r.bien / r.total < 0.7)
      .map(([t]) => t);
  })();

  const empezar = async (tipo: (typeof TIPOS)[number]["id"]) => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch("/api/examen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "quiz",
          id: examen.id,
          tipo,
          temas: tipo === "fallos" ? flojos : [],
        }),
      });
      const d = (await r.json()) as { preguntas?: Pregunta[]; error?: string };
      if (d.error) return setError(d.error);
      setPreguntas(d.preguntas ?? []);
      setVoy(0);
      setElegidas([]);
      setAcabado(false);
    } catch {
      setError("No se ha podido. Prueba otra vez.");
    } finally {
      setCargando(false);
    }
  };

  const responder = async (i: number) => {
    const nuevas = [...elegidas, i];
    setElegidas(nuevas);
    if (!preguntas) return;

    if (voy + 1 < preguntas.length) {
      setTimeout(() => setVoy(voy + 1), 900);
      return;
    }

    setAcabado(true);
    // Se guarda en el servidor: el progreso tiene que seguir ahí mañana y
    // desde el otro aparato.
    const porTema: Record<string, { bien: number; total: number }> = {};
    const falladas: string[] = [];
    preguntas.forEach((p, j) => {
      porTema[p.tema] ??= { bien: 0, total: 0 };
      porTema[p.tema].total += 1;
      if (nuevas[j] === p.correcta) porTema[p.tema].bien += 1;
      else if (!falladas.includes(p.tema)) falladas.push(p.tema);
    });
    const aciertos = preguntas.filter((p, j) => nuevas[j] === p.correcta).length;

    await fetch("/api/examen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: "resultado",
        id: examen.id,
        tipo: "quiz",
        aciertos,
        total: preguntas.length,
        nota: Math.round((aciertos / preguntas.length) * 100) / 10,
        porTema,
        falladas,
      }),
    }).catch(() => {});
  };

  if (cargando)
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-pro" />
        <p className="text-[13.5px] text-ink">Preparando las preguntas…</p>
        <p className="max-w-xs text-[12px] text-faint">Solo de lo que hay en tus apuntes.</p>
      </div>
    );

  if (!preguntas)
    return (
      <div className="space-y-3">
        <p className="text-[12.5px] leading-relaxed text-muted">
          Todas las preguntas salen de tus materiales. Si no puedo respaldar una con lo que has
          subido, no te la hago.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS.map((t) => {
            const bloqueado = t.id === "fallos" && flojos.length === 0;
            return (
              <button
                key={t.id}
                onClick={() => void empezar(t.id)}
                disabled={bloqueado}
                title={bloqueado ? "Primero haz un test, y te preguntaré por lo que falles" : undefined}
                className="rounded-xl border border-line bg-panel px-3 py-3 text-[13px] font-medium text-ink transition hover:border-halo/30 hover:bg-raised disabled:border-line-soft disabled:bg-transparent disabled:text-faint"
              >
                {t.texto}
              </button>
            );
          })}
        </div>
        {error && <p className="text-[12.5px] text-danger">{error}</p>}
        <button onClick={onSalir} className="text-[12px] text-faint transition hover:text-ink">
          Volver
        </button>
      </div>
    );

  if (acabado) {
    const aciertos = preguntas.filter((p, j) => elegidas[j] === p.correcta).length;
    const nota = Math.round((aciertos / preguntas.length) * 100) / 10;
    return (
      <div className="space-y-3.5">
        <div className="rounded-xl border border-line-soft bg-panel/40 p-4 text-center">
          <div className="text-[30px] font-semibold text-ink">{nota.toFixed(1)}</div>
          <div className="text-[12px] text-faint">
            {aciertos} de {preguntas.length} · {Math.round((aciertos / preguntas.length) * 100)}%
          </div>
        </div>

        <div className="space-y-2">
          {preguntas.map((p, j) => {
            const bien = elegidas[j] === p.correcta;
            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3 ${bien ? "border-ok/25 bg-ok/5" : "border-danger/25 bg-danger/5"}`}
              >
                <div className="flex gap-2">
                  <span className={bien ? "text-ok" : "text-danger"}>{bien ? "✓" : "✗"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] text-ink">{p.enunciado}</p>
                    {!bien && (
                      <p className="mt-1 text-[12px] text-muted">
                        Tú: {p.opciones[elegidas[j]] ?? "—"} · Era: {p.opciones[p.correcta]}
                      </p>
                    )}
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">{p.explicacion}</p>
                    {p.fuente?.archivo && (
                      <p className="mt-1 text-[10.5px] text-faint">
                        De {p.fuente.archivo}
                        {p.fuente.pagina ? `, página ${p.fuente.pagina}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onSalir}
            className="rounded-xl border border-line px-4 py-2.5 text-[13px] text-muted transition hover:text-ink"
          >
            Volver
          </button>
          <button
            onClick={() => void empezar("fallos")}
            disabled={aciertos === preguntas.length}
            className="flex-1 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
          >
            {aciertos === preguntas.length ? "¡Todo bien!" : "🎯 Practicar mis fallos"}
          </button>
        </div>
      </div>
    );
  }

  const p = preguntas[voy];
  const respondida = elegidas.length > voy;

  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-2">
        <Barra valor={((voy + (respondida ? 1 : 0)) / preguntas.length) * 100} />
        <span className="shrink-0 text-[11px] text-faint">
          {voy + 1}/{preguntas.length}
        </span>
      </div>

      <p className="text-[15px] leading-relaxed text-ink">{p.enunciado}</p>

      <div className="space-y-2">
        {p.opciones.map((o, i) => {
          const esta = elegidas[voy] === i;
          const buena = i === p.correcta;
          const color = !respondida
            ? "border-line bg-panel hover:border-halo/30 hover:bg-raised"
            : buena
              ? "border-ok/40 bg-ok/10"
              : esta
                ? "border-danger/40 bg-danger/10"
                : "border-line-soft bg-transparent opacity-60";
          return (
            <button
              key={i}
              onClick={() => !respondida && void responder(i)}
              disabled={respondida}
              className={`w-full rounded-xl border px-3.5 py-2.5 text-left text-[13.5px] text-ink transition ${color}`}
            >
              {o}
            </button>
          );
        })}
      </div>

      {respondida && (
        <p className="text-[12.5px] leading-relaxed text-muted">{p.explicacion}</p>
      )}
    </div>
  );
}

/* ----------------------------- 6. Desarrollo ----------------------------- */

function Desarrollo({ examen, onSalir }: { examen: Examen; onSalir: () => void }) {
  const [preguntas, setPreguntas] = useState<PreguntaLarga[] | null>(null);
  const [voy, setVoy] = useState(0);
  const [respuesta, setRespuesta] = useState("");
  const [correcciones, setCorrecciones] = useState<(Correccion & { pregunta: PreguntaLarga })[]>([]);
  const [cargando, setCargando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const empezar = async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch("/api/examen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "desarrollo", id: examen.id }),
      });
      const d = (await r.json()) as { preguntas?: PreguntaLarga[]; error?: string };
      if (d.error) return setError(d.error);
      setPreguntas(d.preguntas ?? []);
      setVoy(0);
      setRespuesta("");
      setCorrecciones([]);
    } catch {
      setError("No se ha podido. Prueba otra vez.");
    } finally {
      setCargando(false);
    }
  };

  const entregar = async () => {
    if (!preguntas || !respuesta.trim()) return;
    setCorrigiendo(true);
    setError(null);
    try {
      const r = await fetch("/api/examen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "corregir",
          id: examen.id,
          pregunta: preguntas[voy],
          respuesta,
        }),
      });
      const d = (await r.json()) as { correccion?: Correccion; error?: string };
      if (d.error || !d.correccion) return setError(d.error ?? "No se ha podido corregir.");

      const todas = [...correcciones, { ...d.correccion, pregunta: preguntas[voy] }];
      setCorrecciones(todas);
      setRespuesta("");

      if (voy + 1 < preguntas.length) {
        setVoy(voy + 1);
        return;
      }

      // Terminado: se guarda la nota con su reparto por temas.
      const sacados = todas.reduce((s, c) => s + c.puntos, 0);
      const posibles = todas.reduce((s, c) => s + c.pregunta.puntos, 0);
      const porTema: Record<string, { bien: number; total: number }> = {};
      for (const c of todas) {
        porTema[c.pregunta.tema] ??= { bien: 0, total: 0 };
        porTema[c.pregunta.tema].bien += c.puntos;
        porTema[c.pregunta.tema].total += c.pregunta.puntos;
      }
      await fetch("/api/examen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "resultado",
          id: examen.id,
          tipo: "desarrollo",
          aciertos: Math.round(sacados),
          total: posibles,
          nota: posibles ? Math.round((sacados / posibles) * 100) / 10 : 0,
          porTema,
          falladas: todas.filter((c) => c.puntos < c.pregunta.puntos).map((c) => c.pregunta.tema),
        }),
      }).catch(() => {});
    } catch {
      setError("No se ha podido corregir. Prueba otra vez.");
    } finally {
      setCorrigiendo(false);
    }
  };

  if (cargando)
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-pro" />
        <p className="text-[13.5px] text-ink">Poniéndote el examen…</p>
      </div>
    );

  if (!preguntas)
    return (
      <div className="space-y-3">
        <p className="text-[12.5px] leading-relaxed text-muted">
          Te pongo preguntas para desarrollar, las escribes como en el examen de verdad, y te las
          corrijo comparándolas con tus apuntes. Con su nota y sus puntos.
        </p>
        <button
          onClick={() => void empezar()}
          className="w-full rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-void transition hover:opacity-90"
        >
          📝 Empezar
        </button>
        {error && <p className="text-[12.5px] text-danger">{error}</p>}
        <button onClick={onSalir} className="text-[12px] text-faint transition hover:text-ink">
          Volver
        </button>
      </div>
    );

  // Terminado: el resultado del examen entero.
  if (correcciones.length === preguntas.length) {
    const sacados = correcciones.reduce((s, c) => s + c.puntos, 0);
    const posibles = correcciones.reduce((s, c) => s + c.pregunta.puntos, 0);
    const nota = posibles ? (sacados / posibles) * 10 : 0;

    return (
      <div className="space-y-3.5">
        <div className="rounded-xl border border-line-soft bg-panel/40 p-4 text-center">
          <div className="text-[11.5px] uppercase tracking-wide text-faint">🏆 Resultado</div>
          <div className="mt-1 text-[30px] font-semibold text-ink">{nota.toFixed(1)}</div>
          <div className="text-[12px] text-faint">
            {sacados.toFixed(1)} de {posibles} puntos
          </div>
        </div>

        {correcciones.map((c, i) => (
          <Corregida key={i} correccion={c} pregunta={c.pregunta} />
        ))}

        <div className="flex gap-2">
          <button
            onClick={onSalir}
            className="rounded-xl border border-line px-4 py-2.5 text-[13px] text-muted transition hover:text-ink"
          >
            Volver
          </button>
          <button
            onClick={() => void empezar()}
            className="flex-1 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-void transition hover:opacity-90"
          >
            🔄 Volver a practicar
          </button>
        </div>
      </div>
    );
  }

  const p = preguntas[voy];
  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-2">
        <Barra valor={(correcciones.length / preguntas.length) * 100} />
        <span className="shrink-0 text-[11px] text-faint">
          {voy + 1}/{preguntas.length}
        </span>
      </div>

      {correcciones.length > 0 && <Corregida correccion={correcciones[correcciones.length - 1]} pregunta={correcciones[correcciones.length - 1].pregunta} />}

      <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
        <div className="mb-1 text-[11px] text-faint">Pregunta {voy + 1} · {p.puntos} puntos</div>
        <p className="text-[14.5px] leading-relaxed text-ink">{p.enunciado}</p>
      </div>

      <textarea
        value={respuesta}
        onChange={(e) => setRespuesta(e.target.value)}
        placeholder="Escribe tu respuesta como la escribirías en el examen…"
        rows={7}
        maxLength={4000}
        className="w-full resize-none rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[14px] leading-relaxed text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
      />

      {error && <p className="text-[12.5px] text-danger">{error}</p>}

      <button
        onClick={() => void entregar()}
        disabled={corrigiendo || !respuesta.trim()}
        className="w-full rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
      >
        {corrigiendo ? "Corrigiendo…" : "Entregar esta"}
      </button>
    </div>
  );
}

/** Una respuesta ya corregida, con su nota y su porqué. */
function Corregida({ correccion, pregunta }: { correccion: Correccion; pregunta: PreguntaLarga }) {
  const bloque = (titulo: string, cosas: string[], color: string) =>
    cosas.length ? (
      <div>
        <div className={`text-[12px] font-medium ${color}`}>{titulo}</div>
        <ul className="mt-0.5 space-y-0.5">
          {cosas.map((c) => (
            <li key={c} className="text-[12px] leading-relaxed text-muted">
              · {c}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="space-y-2 rounded-xl border border-line-soft bg-panel/40 p-3.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[16px] font-semibold text-ink">
          {correccion.puntos}/{pregunta.puntos}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-faint">{pregunta.enunciado}</span>
      </div>
      {bloque("✅ Lo que has hecho bien", correccion.bien, "text-ok")}
      {bloque("❌ Lo que te falta", correccion.falta, "text-danger")}
      {bloque("⚠️ Errores", correccion.errores, "text-pro")}
      {bloque("💡 Cómo mejorar", correccion.mejorar, "text-ink")}
      {correccion.esperada && (
        <div>
          <div className="text-[12px] font-medium text-ink">📖 Respuesta esperada</div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{correccion.esperada}</p>
        </div>
      )}
      {pregunta.fuente?.archivo && (
        <p className="text-[10.5px] text-faint">
          De {pregunta.fuente.archivo}
          {pregunta.fuente.pagina ? `, página ${pregunta.fuente.pagina}` : ""}
        </p>
      )}
    </div>
  );
}
