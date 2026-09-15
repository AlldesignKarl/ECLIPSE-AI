"use client";

import { useEffect, useRef, useState } from "react";
import { aplicarTema, guardarTema, temaGuardado, type Tema } from "@/lib/tema";
import {
  elegirVoz,
  guardarAjustes,
  leerAjustes,
  nombreDeVoz,
  RITMOS,
  tonoDe,
  velocidadDe,
  VOCES,
  vocesDelIdioma,
  VOZ_POR_DEFECTO,
  type AjustesVoz,
} from "@/lib/voz-ajustes";
import {
  guardarPermiso,
  paraElMensaje,
  permiso as permisoUbicacion,
  sePuede as hayGeolocalizacion,
  ultima as ultimaUbicacion,
} from "@/lib/ubicacion";
import Modal from "./Modal";
import * as Icon from "./Icons";
import type { Plan } from "@/lib/types";

export type KeySource = "entorno" | "dispositivo" | "ninguna";
export type Engine = "groq" | "google" | "openrouter" | "mistral";
export type KeySources = Record<Engine, KeySource>;

export const EMPTY_KEY_SOURCES: KeySources = {
  groq: "ninguna",
  google: "ninguna",
  mistral: "ninguna",
  openrouter: "ninguna",
};

/**
 * Los motores que puede usar ECLIPSE. Los tres tienen capa gratuita y ninguno
 * pide tarjeta; cambian el límite diario y lo que saben hacer.
 */
const ENGINES: {
  id: Engine;
  name: string;
  tag?: string;
  limit: string;
  keyUrl: string;
  keyHost: string;
  placeholder: string;
  note: string;
}[] = [
  {
    id: "mistral",
    name: "Mistral",
    tag: "recomendado",
    limit: "medio millón de tokens por minuto",
    keyUrl: "https://console.mistral.ai/api-keys",
    keyHost: "console.mistral.ai/api-keys",
    placeholder: "…",
    note: "El de más margen con diferencia, y trae Codestral y Devstral, hechos para programar. Es el que hay que poner si los archivos largos se cortan. Pide verificar un teléfono, no tarjeta.",
  },
  {
    id: "groq",
    name: "Groq",
    tag: "el más rápido",
    limit: "1.000 mensajes al día",
    keyUrl: "https://console.groq.com/keys",
    keyHost: "console.groq.com/keys",
    placeholder: "gsk_…",
    note: "El más generoso y el más rápido. No busca en internet ni mira imágenes.",
  },
  {
    id: "google",
    name: "Google",
    limit: "unas decenas de mensajes al día",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHost: "aistudio.google.com/apikey",
    placeholder: "AIza…",
    note: "El único que busca en la web y lee imágenes y PDF. A cambio, el límite gratuito es corto.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    limit: "50 mensajes al día",
    keyUrl: "https://openrouter.ai/keys",
    keyHost: "openrouter.ai/keys",
    placeholder: "sk-or-…",
    note: "Muchos modelos abiertos distintos. Útil como recambio cuando los otros se agotan.",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  capabilities: Capabilities;
  providerLabel: string;
  keySources: KeySources;
  engine: Engine | null;
  /** El motor elegido para ECLIPSE CODE, si hay uno distinto. */
  engineCode?: Engine | null;
  onKeysChange: () => void;
  /** Cómo quiere que le llamen, y si hay dónde guardarlo. */
  nombre?: string;
  puedeCambiarNombre?: boolean;
  onNombre?: (nombre: string) => void;
  showThinking: boolean;
  onShowThinking: (v: boolean) => void;
  onClearAll: () => void;
  conversationCount: number;
}

export interface Capabilities {
  chat: boolean;
  image: boolean;
  proCodeConfigured: boolean;
}

function Row({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <span
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-ok" : "bg-line"}`}
        aria-hidden
      />
      <span className="flex-1">
        <span className="block text-[13px] text-ink">{label}</span>
        <span className="block text-[11.5px] text-faint">{ok ? "Listo" : hint}</span>
      </span>
    </li>
  );
}

/**
 * Claro, oscuro o el del móvil.
 *
 * Va lo primero de Ajustes porque es lo que más gente busca al entrar aquí, y
 * porque es lo único de esta pantalla que se ve al instante: se pulsa y la
 * aplicación entera cambia delante.
 */
function TemaBox() {
  const [tema, setTema] = useState<Tema>("oscuro");

  // Lo guardado solo se puede leer ya montados: en el servidor no hay móvil.
  useEffect(() => {
    setTema(temaGuardado());
  }, []);

  // Con "el del sistema" puesto, si el móvil cambia de modo a media tarde, la
  // aplicación cambia con él sin tener que tocar nada.
  useEffect(() => {
    if (tema !== "sistema") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const alCambiar = () => aplicarTema("sistema");
    media.addEventListener("change", alCambiar);
    return () => media.removeEventListener("change", alCambiar);
  }, [tema]);

  const opciones: { id: Tema; etiqueta: string }[] = [
    { id: "oscuro", etiqueta: "Oscuro" },
    { id: "claro", etiqueta: "Claro" },
    { id: "sistema", etiqueta: "El del móvil" },
  ];

  return (
    <div>
      <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">Aspecto</div>
      <div className="flex gap-1.5 rounded-xl border border-line-soft bg-panel/40 p-1">
        {opciones.map((o) => (
          <button
            key={o.id}
            onClick={() => {
              setTema(o.id);
              guardarTema(o.id);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-[13px] transition ${
              tema === o.id ? "bg-raised text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
        Se guarda en este dispositivo: el móvil de noche y el ordenador de día no tienen por qué
        ir igual.
      </p>
    </div>
  );
}

/**
 * Lo que ECLIPSE ha aprendido de ti.
 *
 * Esta caja no es un adorno: es la condición para que la memoria sea aceptable.
 * Una aplicación que va guardando cosas tuyas sin que puedas mirarlas ni
 * borrarlas no es una aplicación con memoria, es otra cosa. Así que aquí está
 * todo lo que sabe, frase por frase, con una cruz en cada una y un botón para
 * borrarlo entero.
 */
function MemoriaBox() {
  const [hechos, setHechos] = useState<{ id: string; texto: string }[]>([]);
  const [temas, setTemas] = useState<{ id: string; titulo: string }[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [sinCuenta, setSinCuenta] = useState(false);
  const [cargado, setCargado] = useState(false);
  /** Encendida o no. Lo decide cada uno, y viaja con la cuenta. */
  const [activa, setActiva] = useState(true);

  const cargar = async () => {
    try {
      const r = await fetch("/api/memoria");
      const d = (await r.json()) as {
        hechos?: { id: string; texto: string }[];
        temas?: { id: string; titulo: string }[];
        sinCuenta?: boolean;
        activa?: boolean;
      };
      setHechos(d.hechos ?? []);
      setTemas(d.temas ?? []);
      setSinCuenta(Boolean(d.sinCuenta));
      if (typeof d.activa === "boolean") setActiva(d.activa);
    } catch {
      /* si no se puede leer, se queda vacío y ya */
    } finally {
      setCargado(true);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const olvidar = async (id?: string) => {
    if (!id && !confirm("¿Borrar todo lo que ECLIPSE sabe de ti? No se puede deshacer."))
      return;
    await fetch(`/api/memoria${id ? `?hecho=${id}` : ""}`, { method: "DELETE" }).catch(() => {});
    await cargar();
  };

  if (!cargado || sinCuenta) return null;

  return (
    <div>
      <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">Memoria</div>
      <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
        {/*
          El interruptor, arriba del todo.

          Estaba pendiente de decidir si la memoria venía encendida o había que
          encenderla. Sigue viniendo encendida —es lo que pidió Carlos— pero
          ahora se apaga en un toque, y apagarla apaga las dos cosas: ni usa lo
          que sabe ni aprende nada nuevo.
        */}
        <label className="flex cursor-pointer items-start gap-3 border-b border-line-soft pb-3">
          <input
            type="checkbox"
            checked={activa}
            onChange={async (e) => {
              const quiere = e.target.checked;
              setActiva(quiere);
              await fetch("/api/auth", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ memoria: quiere }),
              }).catch(() => {});
              void cargar();
            }}
            className="mt-0.5 h-4 w-4 accent-white"
          />
          <span>
            <span className="block text-[13.5px] text-ink">Que se acuerde de mí</span>
            <span className="block text-[11.5px] leading-relaxed text-faint">
              {activa
                ? "Aprende lo que le cuentas y lo usa para ayudarte mejor."
                : "Apagada: no usa nada de lo que sabía ni aprende nada nuevo."}
            </span>
          </span>
        </label>

        <div className={`${activa ? "" : "pointer-events-none opacity-40"} pt-3`}>
        {hechos.length === 0 && temas.length === 0 ? (
          <p className="text-[12.5px] leading-relaxed text-muted">
            Todavía no ha aprendido nada de ti. Según vayáis hablando se irá quedando con lo que
            sirva para ayudarte mejor —a qué te dedicas, en qué andas, cómo prefieres las
            respuestas— y aquí lo verás todo.
          </p>
        ) : (
          <>
            <p className="text-[12.5px] leading-relaxed text-muted">
              Esto es lo que sabe de ti, y de {temas.length}{" "}
              {temas.length === 1 ? "conversación recuerda" : "conversaciones recuerda"} de qué
              ibais. Las conversaciones NO se guardan en el servidor: solo estas frases y un
              resumen de dos líneas de cada una.
            </p>

            {hechos.length > 0 && (
              <button
                onClick={() => setAbierto(!abierto)}
                className="mt-2 text-[12.5px] text-ink underline-offset-2 hover:underline"
              >
                {abierto ? "Ocultar" : `Ver las ${hechos.length} cosas que sabe`}
              </button>
            )}

            {abierto && (
              <ul className="mt-2.5 space-y-1.5 border-t border-line-soft pt-2.5">
                {hechos.map((h) => (
                  <li key={h.id} className="flex items-start gap-2">
                    <span className="flex-1 text-[12.5px] leading-relaxed text-muted">
                      {h.texto}
                    </span>
                    <button
                      onClick={() => void olvidar(h.id)}
                      aria-label="Que olvide esto"
                      className="shrink-0 p-0.5 text-faint transition hover:text-ink"
                    >
                      <Icon.Close width={13} height={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={() => void olvidar()}
              className="mt-3 w-full rounded-xl border border-line py-2 text-[12.5px] text-muted transition hover:text-ink"
            >
              Que lo olvide todo
            </button>
          </>
        )}
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
          En un chat temporal no aprende nada, ni usa lo que ya sabía.
        </p>
      </div>
    </div>
  );
}

/**
 * La ubicación: apagada de fábrica, y con lo que hace escrito delante.
 *
 * Encenderla aquí no basta para que la aplicación sepa nada: al darle, se le
 * pide el permiso al navegador, que saca el suyo encima. Son dos síes, y es a
 * propósito. Apagarla borra también lo último que se supo, porque un
 * interruptor que deja rastro no está apagado.
 */
function UbicacionBox() {
  const [activa, setActiva] = useState(false);
  const [lugar, setLugar] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [rechazado, setRechazado] = useState(false);
  const [hayGps, setHayGps] = useState(true);

  useEffect(() => {
    setActiva(permisoUbicacion() === "si");
    setLugar(ultimaUbicacion()?.lugar ?? null);
    setHayGps(hayGeolocalizacion());
  }, []);

  async function cambiar(quiere: boolean) {
    setRechazado(false);
    if (!quiere) {
      guardarPermiso("no");
      setActiva(false);
      setLugar(null);
      return;
    }

    // Se guarda el sí ANTES de preguntar al navegador porque el diálogo del
    // sistema puede tardar; si el usuario lo acepta, ya está todo listo.
    guardarPermiso("si");
    setActiva(true);
    setPidiendo(true);
    // Lo mismo que se hará al enviar un mensaje: así, si sale bien, aquí se
    // puede enseñar ya en qué ciudad cree que está, que es la única forma de
    // comprobar que esto funciona sin tener que ponerse a chatear.
    const donde = await paraElMensaje();
    setPidiendo(false);
    setLugar(donde?.lugar ?? null);
    if (!donde) {
      // Dijo que no en el navegador, o no llegó: no se deja encendido algo
      // que no va a funcionar.
      guardarPermiso("no");
      setActiva(false);
      setRechazado(true);
    }
  }

  return (
    <div>
      <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">Ubicación</div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line-soft bg-panel/40 p-3">
        <input
          type="checkbox"
          checked={activa}
          disabled={!hayGps || pidiendo}
          onChange={(e) => void cambiar(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--pro)]"
        />
        <span className="min-w-0">
          <span className="block text-[13.5px] text-ink">Dejar que ECLIPSE sepa dónde estás</span>
          <span className="mt-1 block text-[11.5px] leading-relaxed text-faint">
            Para excursiones, sitios cerca, cómo llegar y planes en tu ciudad. Solo se manda la
            zona, redondeada a un kilómetro: sirve para el pueblo o la ciudad, no para tu calle.
            No se guarda en ningún sitio ni se comparte con nadie, y puedes apagarlo aquí cuando
            quieras.
          </span>
          {pidiendo && (
            <span className="mt-1.5 block text-[11.5px] text-muted">Preguntándole al móvil…</span>
          )}
          {activa && lugar && !pidiendo && (
            <span className="mt-1.5 block text-[11.5px] text-muted">Ahora mismo: {lugar}</span>
          )}
          {rechazado && (
            <span className="mt-1.5 block text-[11.5px] text-muted">
              El navegador no ha dado el permiso. Se activa desde el candado de la barra de
              direcciones, o en los ajustes del móvil.
            </span>
          )}
          {!hayGps && (
            <span className="mt-1.5 block text-[11.5px] text-muted">
              Este navegador no sabe dónde está.
            </span>
          )}
        </span>
      </label>
    </div>
  );
}

/** Elegir motor y pegar su clave, sin pasar por el panel del hosting. */
function EngineBox({
  sources,
  engine,
  onChange,
}: {
  sources: KeySources;
  engine: Engine | null;
  onChange: () => void;
}) {
  const configured = ENGINES.filter((e) => sources[e.id] !== "ninguna");
  const [tab, setTab] = useState<Engine>(engine ?? configured[0]?.id ?? "groq");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = ENGINES.find((e) => e.id === tab) ?? ENGINES[0];
  const source = sources[current.id];

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: value, provider: current.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar.");
      setValue("");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  const forget = async () => {
    setBusy(true);
    await fetch(`/api/key?provider=${current.id}`, { method: "DELETE" }).catch(() => {});
    onChange();
    setBusy(false);
  };

  const use = async () => {
    setBusy(true);
    await fetch("/api/key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: current.id, use: true }),
    }).catch(() => {});
    onChange();
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
      <div className="text-[13.5px] font-medium text-ink">Motor de la IA</div>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">
        ECLIPSE necesita una clave para responder. Las tres son gratuitas y ninguna pide
        tarjeta: eliges una, la pegas aquí y listo.
      </p>

      {/* Pestañas de motor */}
      <div className="mt-3 flex gap-1.5">
        {ENGINES.map((e) => {
          const on = e.id === tab;
          const ready = sources[e.id] !== "ninguna";
          return (
            <button
              key={e.id}
              onClick={() => {
                setTab(e.id);
                setValue("");
                setError(null);
              }}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[12px] transition ${
                on ? "border-halo/45 bg-panel text-ink" : "border-line text-faint hover:text-muted"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {ready && <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />}
                {e.name}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-faint">
        <span className="text-muted">{current.limit}</span>
        {current.tag ? ` · ${current.tag}` : ""}. {current.note}
      </p>

      {source === "entorno" && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-ok/25 bg-ok/8 px-3 py-2 text-[12.5px] text-ink">
          <Icon.Check width={14} height={14} className="shrink-0 text-ok" />
          Clave puesta en el servidor: vale para todo el que entre.
        </div>
      )}

      {source === "dispositivo" && (
        <div className="mt-3 rounded-lg border border-line-soft bg-void/40 px-3 py-2.5">
          <div className="flex items-center gap-2 text-[12.5px] text-ink">
            <Icon.Check width={14} height={14} className="shrink-0 text-ok" />
            Clave guardada en este dispositivo
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-faint">
            Está en una cookie de tu navegador. Si entras desde otro móvil, tendrás que
            pegarla allí también.
          </p>
          <div className="mt-2 flex gap-4">
            {engine !== current.id && (
              <button
                onClick={use}
                disabled={busy}
                className="text-[12px] text-halo transition hover:text-ink"
              >
                Usar este motor
              </button>
            )}
            <button
              onClick={forget}
              disabled={busy}
              className="text-[12px] text-faint transition hover:text-danger"
            >
              Olvidar la clave
            </button>
          </div>
        </div>
      )}

      {source === "ninguna" && (
        <>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            Entra en{" "}
            <a
              href={current.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-halo underline underline-offset-2"
            >
              {current.keyHost}
            </a>
            , crea la clave y pégala aquí.
          </p>

          <div className="mt-2.5 flex gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && value.trim() && save()}
              type="password"
              placeholder={current.placeholder}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-line bg-panel px-3.5 py-2.5 font-mono text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-pro/45"
            />
            <button
              onClick={save}
              disabled={busy || !value.trim()}
              className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-void transition disabled:bg-line disabled:text-faint"
            >
              {busy ? "…" : "Guardar"}
            </button>
          </div>

          {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Se comprueba antes de guardarla, y se queda en una cookie segura de tu navegador:
            no la ve nadie más.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Qué motor escribe el código, que puede no ser el del chat.
 *
 * Es el ajuste que más cambia lo largo que puede salir un archivo: las capas
 * gratuitas reparten unos pocos miles de tokens por minuto entre lo que se
 * manda y lo que se escribe, y cuando se acaban, el archivo se corta. Con un
 * motor propio para programar, el chat se queda como está y el código deja de
 * chocar con ese techo.
 */
function MotorCodigo({
  sources,
  elegido,
  onChange,
}: {
  sources: KeySources;
  elegido: Engine | null;
  onChange: () => void;
}) {
  const configurados = ENGINES.filter((e) => sources[e.id] !== "ninguna");
  const [guardando, setGuardando] = useState<string | null>(null);

  if (configurados.length < 2) return null;

  const elegir = async (id: Engine | "") => {
    setGuardando(id || "mismo");
    try {
      await fetch("/api/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paraCodigo: true, provider: id }),
      });
      onChange();
    } finally {
      setGuardando(null);
    }
  };

  const Boton = ({ id, texto }: { id: Engine | ""; texto: string }) => {
    const activo = id === "" ? !elegido : elegido === id;
    return (
      <button
        onClick={() => void elegir(id)}
        disabled={guardando !== null}
        className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] transition ${
          activo ? "border-halo/45 bg-panel text-ink" : "border-line text-muted hover:text-ink"
        }`}
      >
        {texto}
      </button>
    );
  };

  return (
    <div>
      <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">
        Motor de ECLIPSE CODE
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Boton id="" texto="El mismo que el chat" />
        {configurados.map((e) => (
          <Boton key={e.id} id={e.id} texto={e.name} />
        ))}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
        Programar y conversar no piden lo mismo. Si los archivos largos se
        cortan, el motor que uses aquí es lo que más lo cambia: cuanto más
        margen por minuto tenga, más largo puede salir el archivo de una vez.
      </p>
    </div>
  );
}

export default function SettingsDialog({
  open,
  onClose,
  plan,
  capabilities,
  providerLabel,
  keySources,
  engine,
  engineCode,
  onKeysChange,
  nombre = "",
  puedeCambiarNombre = false,
  onNombre,
  showThinking,
  onShowThinking,
  onClearAll,
  conversationCount,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Ajustes">
      <div className="space-y-5">
        {/*
          El perfil arriba del todo: es lo primero que se busca al entrar en
          unos ajustes, y hasta ahora solo se podía cambiar el nombre.
        */}
        {puedeCambiarNombre && <PerfilBox nombre={nombre} onNombre={onNombre} />}

        <TemaBox />

        <VozBox />

        <UbicacionBox />

        <MemoriaBox />

        {puedeCambiarNombre && <SeguridadBox />}

        <EngineBox sources={keySources} engine={engine} onChange={onKeysChange} />

        <MotorCodigo
          sources={keySources}
          elegido={engineCode ?? null}
          onChange={onKeysChange}
        />

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={showThinking}
            onChange={(e) => onShowThinking(e.target.checked)}
            className="h-4 w-4 accent-white"
          />
          <span>
            <span className="block text-[13.5px] text-ink">Mostrar el razonamiento</span>
            <span className="block text-[11.5px] text-faint">
              Añade un desplegable con el resumen de cómo ha pensado la respuesta.
            </span>
          </span>
        </label>

        <div>
          <div className="mb-1 text-[11.5px] uppercase tracking-wide text-faint">
            Estado del servidor
          </div>
          <ul>
            <Row
              ok={capabilities.chat}
              label={`Motor de la IA · ${providerLabel}`}
              hint="Pega arriba una clave gratuita (Groq, Google u OpenRouter)"
            />
            <Row
              ok={capabilities.image}
              label="Generación de imágenes"
              hint="Falta GOOGLE_API_KEY u OPENAI_API_KEY"
            />
            {/* Esto NO afecta a tu propio plan: es la forma de que otras
                personas consigan el Pro. Decía "Falta PRO_ACCESS_CODE" a secas
                y parecía que algo estaba roto. */}
            <Row
              ok={capabilities.proCodeConfigured}
              label="Dar el plan Pro a otras personas"
              hint="Define PRO_ACCESS_CODE (un código que repartes) o conecta Stripe para cobrarlo. Tu plan no depende de esto."
            />
          </ul>
        </div>

        <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
          <div className="flex items-center gap-2 text-[13px] text-ink">
            <Icon.Sparkle width={14} height={14} className={plan === "pro" ? "text-pro" : "text-faint"} />
            Plan {plan === "pro" ? "Pro" : "Gratis"}
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
            Las conversaciones se guardan solo en este dispositivo ({conversationCount} guardadas). No
            se envían a ningún servidor salvo el mensaje que estás preguntando.
          </p>
        </div>

        <p className="text-[11.5px] leading-relaxed text-faint">
          ECLIPSE es un producto de <span className="text-muted">Eclipse</span>, empresa fundada por{" "}
          <span className="text-muted">Carlos Lafuente Pueyo</span>.
        </p>

        <button
          onClick={() => {
            if (confirm("¿Borrar todas las conversaciones? No se puede deshacer.")) onClearAll();
          }}
          className="flex items-center gap-2 text-[12.5px] text-faint transition hover:text-danger"
        >
          <Icon.Trash width={14} height={14} />
          Borrar todas las conversaciones
        </button>
      </div>
    </Modal>
  );
}

/**
 * Tu perfil: cómo te llamas y tu foto.
 *
 * La foto se encoge y se recorta en cuadrado AQUÍ, en el navegador, antes de
 * mandarla. Una foto de móvil son cuatro megas, y subir cuatro megas para
 * enseñarlos en un círculo de treinta píxeles es tirar los datos de quien la
 * sube y llenar la base de datos de nada. Lo que sale de aquí pesa unos pocos
 * kilobytes.
 */
function PerfilBox({
  nombre,
  onNombre,
}: {
  nombre: string;
  onNombre?: (n: string) => void;
}) {
  const [valor, setValor] = useState(nombre);
  const [foto, setFoto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const d = (await (await fetch("/api/auth")).json()) as { foto?: string; nombre?: string };
        setFoto(d.foto ?? "");
        if (d.nombre) setValor(d.nombre);
      } catch {
        /* se queda sin foto y ya */
      }
    })();
  }, []);

  /** La foto, cuadrada y pequeña, lista para guardar. */
  const encoger = (fichero: File) =>
    new Promise<string>((listo, falla) => {
      const lector = new FileReader();
      lector.onerror = () => falla(new Error("No se ha podido leer la foto."));
      lector.onload = () => {
        const img = new Image();
        img.onerror = () => falla(new Error("Ese archivo no es una foto."));
        img.onload = () => {
          const lado = Math.min(img.width, img.height);
          const lienzo = document.createElement("canvas");
          lienzo.width = 256;
          lienzo.height = 256;
          const pincel = lienzo.getContext("2d");
          if (!pincel) return falla(new Error("Este navegador no puede recortarla."));
          // Del centro: es donde está la cara en el 99% de las fotos.
          pincel.drawImage(
            img,
            (img.width - lado) / 2,
            (img.height - lado) / 2,
            lado,
            lado,
            0,
            0,
            256,
            256,
          );
          listo(lienzo.toDataURL("image/jpeg", 0.82));
        };
        img.src = String(lector.result);
      };
      lector.readAsDataURL(fichero);
    });

  const guardar = async (cambios: { nombre?: string; foto?: string | null }) => {
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch("/api/auth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      const d = (await r.json()) as { error?: string; foto?: string; nombre?: string };
      if (!r.ok) throw new Error(d.error ?? "No se ha podido guardar.");
      if (typeof d.foto === "string") setFoto(d.foto);
      if (typeof d.nombre === "string") onNombre?.(d.nombre);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">Tu perfil</div>
      <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => archivo.current?.click()}
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-line bg-panel"
            aria-label="Cambiar la foto"
          >
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[18px] font-medium text-faint">
                {(valor || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onBlur={() => valor.trim() !== nombre && void guardar({ nombre: valor })}
              maxLength={40}
              placeholder="Tu nombre, o como prefieras"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
            />
            <div className="mt-1.5 flex gap-3">
              <button
                onClick={() => archivo.current?.click()}
                disabled={guardando}
                className="text-[12px] text-muted transition hover:text-ink"
              >
                {foto ? "Cambiar foto" : "Poner foto"}
              </button>
              {foto && (
                <button
                  onClick={() => void guardar({ foto: null })}
                  disabled={guardando}
                  className="text-[12px] text-faint transition hover:text-danger"
                >
                  Quitarla
                </button>
              )}
            </div>
          </div>
        </div>

        <input
          ref={archivo}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setError(null);
            try {
              await guardar({ foto: await encoger(f) });
            } catch (err) {
              setError(err instanceof Error ? err.message : "No se ha podido usar esa foto.");
            }
          }}
        />

        {error && <p className="mt-2 text-[12px] leading-relaxed text-danger">{error}</p>}
        <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
          Tu nombre y tu foto te siguen de un móvil a otro. En los grupos se ve la foto y el
          nombre; el correo no lo ve nadie, nunca.
        </p>
      </div>
    </div>
  );
}

/**
 * Seguridad: la contraseña y la puerta de salida.
 *
 * Lo segundo importa más de lo que parece. Una aplicación que promete que tus
 * cosas son tuyas tiene que dejarte llevarte la promesa hasta el final: si te
 * vas, no se queda nada. Y se pide la contraseña para borrarla porque un móvil
 * desbloqueado encima de una mesa no puede bastar para que alguien te borre la
 * cuenta.
 */
function SeguridadBox({ onFuera }: { onFuera?: () => void }) {
  const [abierto, setAbierto] = useState<"clave" | "borrar" | null>(null);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirma, setConfirma] = useState("");
  const [aviso, setAviso] = useState<{ malo: boolean; texto: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const cambiar = async () => {
    setBusy(true);
    setAviso(null);
    try {
      const r = await fetch("/api/auth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contrasena: { actual, nueva } }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "No se ha podido cambiar.");
      setAviso({ malo: false, texto: "Cambiada. La próxima vez entra con la nueva." });
      setActual("");
      setNueva("");
      setAbierto(null);
    } catch (err) {
      setAviso({ malo: true, texto: err instanceof Error ? err.message : "No se ha podido." });
    } finally {
      setBusy(false);
    }
  };

  const borrar = async () => {
    setBusy(true);
    setAviso(null);
    try {
      const r = await fetch("/api/auth?todo=1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contrasena: confirma }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "No se ha podido borrar.");
      onFuera?.();
      window.location.reload();
    } catch (err) {
      setAviso({ malo: true, texto: err instanceof Error ? err.message : "No se ha podido." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">Seguridad</div>
      <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
        {abierto === "clave" ? (
          <div className="space-y-2">
            <input
              type="password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              placeholder="La contraseña de ahora"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-halo/40"
            />
            <input
              type="password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder="La nueva (8 o más, con letras y números)"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-halo/40"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setAbierto(null)}
                className="rounded-xl border border-line px-3 py-2 text-[13px] text-muted transition hover:text-ink"
              >
                Dejarlo
              </button>
              <button
                onClick={() => void cambiar()}
                disabled={busy || !actual || !nueva}
                className="flex-1 rounded-xl bg-ink py-2 text-[13px] font-medium text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
              >
                {busy ? "Un momento…" : "Cambiar la contraseña"}
              </button>
            </div>
          </div>
        ) : abierto === "borrar" ? (
          <div className="space-y-2">
            <p className="text-[12.5px] leading-relaxed text-ink">
              Se borra tu cuenta y todo lo que hay de ti en el servidor: lo que sabe de ti, tus
              encargos programados, tus conexiones y tus grupos. No se puede deshacer.
            </p>
            <p className="text-[11.5px] leading-relaxed text-faint">
              Tus conversaciones no hace falta borrarlas de aquí: nunca han salido de este móvil.
            </p>
            <input
              type="password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              placeholder="Escribe tu contraseña para confirmar"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-halo/40"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setAbierto(null);
                  setConfirma("");
                }}
                className="rounded-xl border border-line px-3 py-2 text-[13px] text-muted transition hover:text-ink"
              >
                Mejor no
              </button>
              <button
                onClick={() => void borrar()}
                disabled={busy || !confirma}
                className="flex-1 rounded-xl bg-danger py-2 text-[13px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Borrando…" : "Borrar mi cuenta y todo lo mío"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setAbierto("clave")}
              className="text-[12.5px] text-ink underline-offset-2 hover:underline"
            >
              Cambiar la contraseña
            </button>
            <button
              onClick={() => setAbierto("borrar")}
              className="text-[12.5px] text-faint transition hover:text-danger"
            >
              Borrar mi cuenta
            </button>
          </div>
        )}

        {aviso && (
          <p className={`mt-2 text-[12px] leading-relaxed ${aviso.malo ? "text-danger" : "text-muted"}`}>
            {aviso.texto}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Cómo suena ECLIPSE, también desde aquí.
 *
 * Estaba solo dentro de la llamada, que es donde se nota; pero quien busca
 * cómo cambiar la voz la busca en Ajustes, y no encontrarla ahí es lo mismo que
 * no poder cambiarla. Lo que se elija aquí es lo mismo que se elige allí: se
 * guarda en el mismo sitio.
 */
function VozBox() {
  const [ajustes, setAjustes] = useState<AjustesVoz>(VOZ_POR_DEFECTO);
  const [suyas, setSuyas] = useState<{ name: string; lang: string; localService?: boolean }[]>([]);

  useEffect(() => {
    setAjustes(leerAjustes());
  }, []);

  useEffect(() => {
    const mirar = () => {
      try {
        setSuyas(vocesDelIdioma(window.speechSynthesis.getVoices(), ajustes.idioma));
      } catch {
        /* este aparato no habla */
      }
    };
    mirar();
    window.speechSynthesis?.addEventListener?.("voiceschanged", mirar);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", mirar);
  }, [ajustes.idioma]);

  const cambiar = (cambios: Partial<AjustesVoz>) => {
    const nuevo = { ...ajustes, ...cambios };
    setAjustes(nuevo);
    guardarAjustes(nuevo);
    // Y se oye al momento: elegir una voz sin escucharla es elegir a ciegas.
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(
        nuevo.idioma.startsWith("es") ? "Así es como voy a sonar." : "This is how I will sound.",
      );
      u.lang = nuevo.idioma;
      u.rate = velocidadDe(nuevo.ritmo);
      u.pitch = tonoDe(nuevo.timbre);
      const voces = window.speechSynthesis.getVoices();
      const elegida = elegirVoz(voces, nuevo);
      const real = elegida ? voces.find((v) => v.name === elegida.name) : null;
      if (real) u.voice = real;
      window.speechSynthesis.speak(u);
    } catch {
      /* sin voz en este aparato */
    }
  };

  if (!suyas.length) return null;

  return (
    <div>
      <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">
        La voz de las llamadas
      </div>
      <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
        <div className="flex gap-1.5 rounded-xl border border-line-soft bg-panel p-1">
          {VOCES.map((v) => (
            <button
              key={v.id}
              onClick={() => cambiar({ voz: v.id, vozExacta: undefined })}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[12.5px] transition ${
                ajustes.voz === v.id && !ajustes.vozExacta
                  ? "bg-raised text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              {v.nombre}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-1.5 rounded-xl border border-line-soft bg-panel p-1">
          {RITMOS.map((r) => (
            <button
              key={r.id}
              onClick={() => cambiar({ ritmo: r.id })}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[12.5px] transition ${
                ajustes.ritmo === r.id ? "bg-raised text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {r.nombre}
            </button>
          ))}
        </div>

        <div className="mt-2.5 text-[11.5px] uppercase tracking-wide text-faint">
          Voces de tu móvil
        </div>
        <div className="scroll-thin mt-1.5 max-h-40 space-y-1 overflow-y-auto pr-1">
          {suyas.map((v, i) => (
            <button
              key={v.name}
              onClick={() => cambiar({ vozExacta: v.name })}
              className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                ajustes.vozExacta === v.name
                  ? "border-halo/50 bg-panel"
                  : "border-line-soft bg-panel/40 hover:border-line"
              }`}
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                {nombreDeVoz(v, i + 1)}
              </span>
              <span className="shrink-0 text-[11px] text-faint">escuchar</span>
            </button>
          ))}
        </div>

        <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
          Tócalas para oírlas. Las que ponen «suena mejor» son las que tu móvil baja de internet:
          son las que no suenan a robot. Si no tienes ninguna, se añaden desde los ajustes de voz
          del propio móvil.
        </p>
      </div>
    </div>
  );
}
