"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import * as Icon from "./Icons";
import type { Plan } from "@/lib/types";

/**
 * Grupos: varias personas hablando con ECLIPSE en el mismo sitio.
 *
 * Dos cosas que la pantalla tiene que dejar clarísimas, porque van contra lo
 * que ECLIPSE promete en todo lo demás:
 *
 * - Lo que se escribe en un grupo lo ve todo el grupo. Obvio dicho así, y sin
 *   embargo es justo lo que se olvida cuando llevas media hora escribiendo.
 * - Y se guarda en el servidor, no en tu móvil. El chat normal no; este sí,
 *   porque no hay otra forma de que lo vean cinco personas.
 *
 * Se dice al crear el grupo y se recuerda dentro. Una sorpresa en esto no es un
 * detalle de interfaz: es alguien contando algo delante de quien no debía.
 */

interface Miembro {
  nombre: string;
  dueno: boolean;
  yo: boolean;
}

interface Grupo {
  id: string;
  nombre: string;
  miembros: Miembro[];
  soyDueno: boolean;
  invitacion?: string;
  hueco: boolean;
}

interface Mensaje {
  id: string;
  nombre: string;
  texto: string;
  cuando: number;
  mio: boolean;
  deEclipse: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  onUpgrade: () => void;
}

export default function GruposDialog({ open, onClose, plan, onUpgrade }: Props) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [dentro, setDentro] = useState<Grupo | null>(null);
  const [sinCuenta, setSinCuenta] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  const [creando, setCreando] = useState("");
  const [busy, setBusy] = useState(false);

  const recargar = useCallback(async () => {
    try {
      const r = await fetch("/api/grupos");
      const d = (await r.json()) as { grupos?: Grupo[]; sinCuenta?: boolean; error?: string };
      setGrupos(d.grupos ?? []);
      setSinCuenta(Boolean(d.sinCuenta));
      setProblema(r.ok ? null : (d.error ?? null));
    } catch {
      setProblema("No se han podido cargar los grupos.");
    }
  }, []);

  useEffect(() => {
    if (open) void recargar();
    if (!open) setDentro(null);
  }, [open, recargar]);

  /*
    Una invitación en la dirección: se entra directamente.

    Quien recibe el enlace por WhatsApp no tiene que buscar nada: abre, y está
    dentro. Si no tiene cuenta, se le manda a hacerla y al volver sigue el
    enlace esperándole.
  */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const codigo = new URLSearchParams(window.location.search).get("grupo");
    if (!codigo || !open) return;

    void (async () => {
      const r = await fetch("/api/grupos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitacion: codigo }),
      });
      const d = (await r.json()) as { grupo?: Grupo; error?: string };
      if (d.grupo) {
        window.history.replaceState({}, "", window.location.pathname);
        await recargar();
        setDentro(d.grupo);
      } else setProblema(d.error ?? "No se ha podido entrar en el grupo.");
    })();
  }, [open, recargar]);

  if (dentro) {
    return (
      <Sala
        grupo={dentro}
        open={open}
        onVolver={() => {
          setDentro(null);
          void recargar();
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Grupos"
      subtitle="Un sitio donde varias personas le hablan a ECLIPSE a la vez."
      wide
    >
      <div className="space-y-5">
        {sinCuenta ? (
          <Aviso texto="Para los grupos hay que entrar con tu cuenta: es cómo te ven los demás." />
        ) : problema ? (
          <Aviso texto={problema} />
        ) : null}

        {grupos.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">Tus grupos</div>
            <div className="space-y-2">
              {grupos.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setDentro(g)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line-soft bg-panel/40 p-3.5 text-left transition hover:border-line hover:bg-panel"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ink">{g.nombre}</span>
                    <span className="mt-0.5 block text-[11.5px] text-faint">
                      {g.miembros.length} persona{g.miembros.length > 1 ? "s" : ""}
                      {g.soyDueno && " · lo creaste tú"}
                    </span>
                  </span>
                  <Icon.ChevronLeft width={15} height={15} className="shrink-0 rotate-180 text-faint" />
                </button>
              ))}
            </div>
          </div>
        )}

        {plan !== "pro" && !sinCuenta ? (
          <div className="rounded-xl border border-pro/25 bg-gradient-to-r from-pro/10 to-transparent p-4">
            <div className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
              <Icon.Sparkle width={15} height={15} className="text-pro" />
              Crear un grupo es del plan Pro
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Montas el grupo, invitas a quien quieras y todos le preguntáis a ECLIPSE en el mismo
              sitio. Ellos no necesitan Pro para entrar: solo paga quien monta la mesa.
            </p>
            <button
              onClick={onUpgrade}
              className="mt-3 rounded-xl bg-ink px-4 py-2 text-[13px] font-medium text-void transition hover:opacity-90"
            >
              Ver el plan Pro
            </button>
          </div>
        ) : !sinCuenta ? (
          <div>
            <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">
              Crear uno nuevo
            </div>
            <div className="flex gap-2">
              <input
                value={creando}
                onChange={(e) => setCreando(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key !== "Enter" || !creando.trim()) return;
                  setBusy(true);
                  await fetch("/api/grupos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nombre: creando }),
                  }).catch(() => {});
                  setCreando("");
                  setBusy(false);
                  void recargar();
                }}
                maxLength={50}
                placeholder="El viaje, Los del piso, Trabajo de bio…"
                className="min-w-0 flex-1 rounded-xl border border-line bg-panel px-3 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
              />
              <button
                onClick={async () => {
                  if (!creando.trim()) return;
                  setBusy(true);
                  await fetch("/api/grupos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nombre: creando }),
                  }).catch(() => {});
                  setCreando("");
                  setBusy(false);
                  void recargar();
                }}
                disabled={busy || !creando.trim()}
                className="shrink-0 rounded-xl bg-ink px-4 text-[13px] font-medium text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
              >
                Crear
              </button>
            </div>
          </div>
        ) : null}

        <p className="border-t border-line-soft pt-4 text-[11.5px] leading-relaxed text-faint">
          Ojo a una diferencia: lo que escribes en un grupo lo ve todo el grupo y se guarda en el
          servidor, no en tu móvil como el resto de tus conversaciones. Es la única forma de que lo
          vean los demás. Para lo tuyo, tienes el chat normal y el temporal.
        </p>
      </div>
    </Modal>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
      <p className="text-[12.5px] leading-relaxed text-muted">{texto}</p>
    </div>
  );
}

/** Dentro del grupo. */
function Sala({
  grupo,
  open,
  onVolver,
  onClose,
}: {
  grupo: Grupo;
  open: boolean;
  onVolver: () => void;
  onClose: () => void;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gente, setGente] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const fondo = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/grupos/mensajes?id=${grupo.id}`);
      const d = (await r.json()) as { mensajes?: Mensaje[] };
      setMensajes(d.mensajes ?? []);
    } catch {
      /* se reintenta al siguiente vistazo */
    }
  }, [grupo.id]);

  /*
    Mirar cada pocos segundos.

    No hay conexión permanente, y a propósito: mantenerla abierta para veinte
    personas cuesta un servidor que no tenemos, y un grupo no es una partida de
    ping-pong. Tres segundos es más rápido de lo que nadie escribe.
  */
  useEffect(() => {
    if (!open) return;
    void cargar();
    const reloj = window.setInterval(() => void cargar(), 3000);
    return () => window.clearInterval(reloj);
  }, [open, cargar]);

  useEffect(() => {
    fondo.current?.scrollTo({ top: fondo.current.scrollHeight, behavior: "smooth" });
  }, [mensajes.length]);

  const enviar = async () => {
    const dicho = texto.trim();
    if (!dicho || enviando) return;
    setTexto("");
    setEnviando(true);
    try {
      await fetch("/api/grupos/mensajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: grupo.id, texto: dicho }),
      });
    } catch {
      /* al recargar se verá si llegó */
    }
    setEnviando(false);
    void cargar();
  };

  const enlace =
    typeof window !== "undefined" && grupo.invitacion
      ? `${window.location.origin}/?grupo=${grupo.invitacion}`
      : "";

  return (
    <Modal open={open} onClose={onClose} title={grupo.nombre} wide>
      <div className="flex h-[70vh] flex-col">
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={onVolver}
            className="flex items-center gap-1 text-[12.5px] text-faint transition hover:text-ink"
          >
            <Icon.ChevronLeft width={14} height={14} />
            Grupos
          </button>
          <button
            onClick={() => setGente(!gente)}
            className="ml-auto text-[12.5px] text-faint transition hover:text-ink"
          >
            {grupo.miembros.length} persona{grupo.miembros.length > 1 ? "s" : ""}
          </button>
        </div>

        {gente && (
          <div className="mb-3 rounded-xl border border-line-soft bg-panel/40 p-3">
            <ul className="space-y-1">
              {grupo.miembros.map((m) => (
                <li key={m.nombre} className="text-[12.5px] text-muted">
                  {m.nombre}
                  {m.yo && " (tú)"}
                  {m.dueno && " · creó el grupo"}
                </li>
              ))}
            </ul>
            {enlace && (
              <div className="mt-3 border-t border-line-soft pt-3">
                <p className="text-[11.5px] leading-relaxed text-faint">
                  Quien abra este enlace entra en el grupo. Mándalo solo a quien quieras dentro.
                </p>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(enlace).catch(() => {});
                    setCopiado(true);
                    window.setTimeout(() => setCopiado(false), 1800);
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2 text-[12.5px] text-ink transition hover:bg-panel"
                >
                  <Icon.Copy width={13} height={13} />
                  {copiado ? "Copiado" : "Copiar la invitación"}
                </button>
              </div>
            )}
          </div>
        )}

        <div ref={fondo} className="scroll-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
          {mensajes.length === 0 && (
            <p className="py-8 text-center text-[13px] leading-relaxed text-muted">
              Todavía no ha escrito nadie. Escribe algo y, si quieres que conteste ECLIPSE,
              nómbralo o pídele algo directamente.
            </p>
          )}
          {mensajes.map((m) => (
            <div key={m.id} className={m.mio ? "flex justify-end" : ""}>
              <div className={`max-w-[85%] ${m.mio ? "" : "w-full"}`}>
                {!m.mio && (
                  <span
                    className={`mb-0.5 block text-[11px] ${
                      m.deEclipse ? "text-pro" : "text-faint"
                    }`}
                  >
                    {m.nombre}
                  </span>
                )}
                <div
                  className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed ${
                    m.mio
                      ? "rounded-br-md border border-tuyo-borde bg-tuyo text-ink"
                      : m.deEclipse
                        ? "border border-line-soft bg-panel/60 text-ink"
                        : "bg-panel text-ink"
                  }`}
                >
                  {m.texto}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void enviar()}
            placeholder="Escribe al grupo. Di «ECLIPSE» para que conteste."
            className="min-w-0 flex-1 rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
          />
          <button
            onClick={() => void enviar()}
            disabled={enviando || !texto.trim()}
            aria-label="Enviar"
            className="shrink-0 rounded-xl bg-ink px-4 text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
          >
            <Icon.Send width={17} height={17} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
