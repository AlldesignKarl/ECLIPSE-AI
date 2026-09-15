"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Icon from "./Icons";
import { dictar, dictadoDisponible } from "@/lib/dictado";
import { readSSE } from "@/lib/sse";
import { paraElMensaje } from "@/lib/ubicacion";
import {
  elegirVoz,
  guardarAjustes,
  IDIOMAS,
  leerAjustes,
  suenanDistinto,
  nombreDeVoz,
  RITMOS,
  tonoPara,
  velocidadDe,
  VOCES,
  vocesDelIdioma,
  VOZ_POR_DEFECTO,
  type AjustesVoz,
} from "@/lib/voz-ajustes";
import {
  iniciarLlamada,
  type Entorno,
  type Fase,
  type Llamada as Motor,
  type Turno,
} from "@/lib/llamada";

/**
 * La pantalla de la llamada.
 *
 * Casi vacía, y a propósito. En una llamada no se mira la pantalla: se escucha.
 * Lo único que hace falta ver es si te está oyendo, si está pensando o si está
 * hablando, y eso lo dice una bola que respira. Todo lo demás —el texto de lo
 * que se dice, los botones— estorba y aparta la vista de donde tiene que estar,
 * que es en ningún sitio.
 *
 * Debajo se enseña lo último que se ha dicho, en pequeño, por si te pierdes o
 * hay ruido. No la conversación entera: eso es un chat, y para eso ya está el
 * chat.
 */

const COLORES: Record<Fase, string> = {
  conectando: "from-line to-panel",
  escuchando: "from-halo/70 to-pro/50",
  pensando: "from-pro/70 to-halo/40",
  hablando: "from-ok/60 to-halo/60",
  colgada: "from-line to-panel",
};

const LETRERO: Record<Fase, string> = {
  conectando: "Conectando…",
  escuchando: "Te escucho",
  pensando: "Pensando",
  hablando: "Hablando",
  colgada: "Llamada terminada",
};

interface Props {
  abierta: boolean;
  onCerrar: () => void;
  /** Cómo se llama quien llama, si lo dijo al crear la cuenta. */
  nombre?: string;
  /** Para guardar la conversación en el chat al colgar. */
  onGuardar?: (turnos: Turno[]) => void;
}

export default function Llamada({ abierta, onCerrar, nombre = "", onGuardar }: Props) {
  const [fase, setFase] = useState<Fase>("conectando");
  const [ultimo, setUltimo] = useState<{ quien: "tu" | "eclipse"; texto: string } | null>(null);
  const [silenciado, setSilenciado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sePuede, setSePuede] = useState(true);
  const [ajustesVisibles, setAjustesVisibles] = useState(false);
  /** Lo que lleva la llamada, para que se vea que está viva. */
  const [duracion, setDuracion] = useState(0);
  const motorRef = useRef<Motor | null>(null);
  const vozRef = useRef<SpeechSynthesisUtterance | null>(null);
  /*
    Cómo suena, elegido en Ajustes.

    Se lee al descolgar y no en cada frase: cambiar la voz a mitad de una
    llamada sería raro, y leerlo cien veces por conversación, tonto.
  */
  const ajustesRef = useRef<AjustesVoz>(VOZ_POR_DEFECTO);

  /** Decir una frase en alto y esperar a que termine. */
  const decir = useCallback(
    (frase: string) =>
      new Promise<void>((listo) => {
        if (typeof window === "undefined" || !window.speechSynthesis) return listo();

        const ajustes = ajustesRef.current;
        const voz = new SpeechSynthesisUtterance(frase);
        voz.lang = ajustes.idioma;
        voz.rate = velocidadDe(ajustes.ritmo);

        // La del aparato que más se parezca a lo que ha pedido.
        const voces = window.speechSynthesis.getVoices();
        const elegida = elegirVoz(voces, ajustes);
        const buena = elegida ? voces.find((v) => v.name === elegida.name && v.lang === elegida.lang) : null;
        /*
          El tono se calcula DESPUÉS de saber quién va a hablar.

          Muchos móviles traen una sola voz por idioma, así que "hombre" y
          "mujer" acababan siendo la misma y el botón no hacía nada. Si la voz
          que va a sonar no es de quien se pidió, se le mueve el tono de verdad;
          si sí lo es, no se toca.
        */
        voz.pitch = tonoPara(ajustes, voces);
        // Elegir voz es una mejora, no un requisito: si el aparato se queja,
        // se habla con la de por defecto antes que no hablar.
        try {
          if (buena) voz.voice = buena;
        } catch {
          /* se queda la de siempre */
        }

        /*
          Pase lo que pase, esto termina.

          `onend` no siempre llega: hay aparatos sin ninguna voz instalada, y
          navegadores que se quedan callados sin avisar. Si la promesa no se
          resuelve, la llamada se queda clavada en "Hablando" para siempre y no
          hay forma de seguir hablando. Se le da margen de sobra —lo que tardan
          unas veinte palabras— y luego se sigue.
        */
        let hecho = false;
        const acabar = () => {
          if (hecho) return;
          hecho = true;
          window.clearTimeout(red);
          listo();
        };
        const red = window.setTimeout(acabar, 2000 + frase.length * 90);

        voz.onend = acabar;
        voz.onerror = acabar;
        vozRef.current = voz;
        try {
          window.speechSynthesis.speak(voz);
        } catch {
          acabar();
        }
      }),
    [],
  );

  const callar = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* no hay voz en este aparato */
    }
    vozRef.current = null;
  }, []);

  useEffect(() => {
    if (!abierta) return;

    if (!dictadoDisponible()) {
      setSePuede(false);
      return;
    }

    ajustesRef.current = leerAjustes();

    // Las voces llegan tarde en algunos navegadores; basta con tocarlas para
    // que se carguen antes de la primera frase.
    try {
      window.speechSynthesis?.getVoices();
    } catch {
      /* da igual */
    }

    const entorno: Entorno = {
      escuchar(onTexto, onError) {
        const d = dictar({
          idioma: ajustesRef.current.idioma,
          // En una llamada solo interesa lo que ya da por bueno: lo provisional
          // cambia mientras hablas y dispararía el turno a media palabra.
          onTexto: ({ firme }) => {
            if (firme.trim()) onTexto(firme);
          },
          onFin: () => {},
          onError,
        });
        return () => d?.parar();
      },
      decir,
      callar,
      async preguntar(turnos, alTrozo) {
        // También en una llamada: "¿qué hago hoy por aquí?" se pregunta más
        // hablando que escribiendo.
        const ubicacion = await paraElMensaje().catch(() => null);
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "chat",
            // En una llamada manda la latencia: dos segundos de silencio son
            // eternos cuando tienes el teléfono en la oreja.
            speed: "rapido",
            voz: true,
            ubicacion: ubicacion
              ? { lat: ubicacion.lat, lon: ubicacion.lon, lugar: ubicacion.lugar }
              : undefined,
            messages: turnos.map((t) => ({ role: t.role, content: t.content })),
          }),
        });
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(d.error ?? "No he podido contestar.");
        }

        /*
          La respuesta se va entregando según llega, no al final.

          Antes se esperaba a tenerla entera «porque hablar a medias y
          rectificar suena peor que esperar». Eso era cierto a medias: lo que
          no se puede es decir media frase, pero una frase TERMINADA ya no
          cambia. Así que se entrega el texto según llega y la llamada dice en
          alto cada frase en cuanto está cerrada. Es lo que quita el par de
          segundos de silencio de después de preguntar.
        */
        let salida = "";
        let fallo: string | null = null;
        await readSSE(res, (e) => {
          if (e.t === "text" && typeof e.v === "string") {
            salida += e.v;
            alTrozo?.(e.v);
          }
          if (e.t === "error" && typeof e.v === "string") fallo = e.v;
        });
        if (fallo) throw new Error(fallo);
        return salida;
      },
      ahora: () => Date.now(),
      temporizador(fn, ms) {
        const t = window.setTimeout(fn, ms);
        return () => window.clearTimeout(t);
      },
    };

    const motor = iniciarLlamada(entorno, {
      onFase: setFase,
      onTurno: (turnos) => {
        const t = turnos.at(-1);
        if (t) setUltimo({ quien: t.role === "user" ? "tu" : "eclipse", texto: t.content });
      },
      onError: setError,
    });
    motorRef.current = motor;

    return () => {
      motor.colgar();
      motorRef.current = null;
      callar();
    };
  }, [abierta, decir, callar]);

  // El contador. Se para al colgar, no se reinicia: la última cifra es cuánto
  // duró, y eso interesa más que un cero.
  useEffect(() => {
    if (!abierta) {
      setDuracion(0);
      return;
    }
    const reloj = window.setInterval(() => setDuracion((d) => d + 1), 1000);
    return () => window.clearInterval(reloj);
  }, [abierta]);

  if (!abierta) return null;

  const colgar = () => {
    const turnos = motorRef.current?.turnos() ?? [];
    motorRef.current?.colgar();
    if (turnos.length) onGuardar?.(turnos);
    onCerrar();
  };

  const enMarcha = fase === "escuchando" || fase === "hablando" || fase === "pensando";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-void">
      {/*
        El fondo. Un resplandor muy tenue que cambia de color con la fase: no se
        mira, se nota. En una llamada la pantalla está en el bolsillo o boca
        abajo la mitad del tiempo, así que todo lo de aquí tiene que leerse de un
        vistazo de medio segundo, incluido el ambiente.
      */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ${
          enMarcha ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            fase === "hablando"
              ? "radial-gradient(70% 50% at 50% 45%, rgba(74,222,128,0.14), transparent 70%)"
              : fase === "pensando"
                ? "radial-gradient(70% 50% at 50% 45%, rgba(184,166,255,0.16), transparent 70%)"
                : "radial-gradient(70% 50% at 50% 45%, rgba(207,214,230,0.10), transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative flex items-center justify-between px-5 py-4 safe-top">
        <span className="flex items-center gap-2 text-[12.5px] text-faint">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              fase === "colgada" ? "bg-line" : "bg-ok"
            }`}
            aria-hidden
          />
          {segundos(duracion)}
        </span>
        <span className="text-[12.5px] text-faint">{nombre ? `Con ${nombre}` : "ECLIPSE"}</span>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-10 px-8">
        {!sePuede ? (
          <div className="max-w-xs text-center">
            <p className="text-[14px] leading-relaxed text-ink">
              Este navegador no sabe escuchar por el micrófono.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
              Las llamadas funcionan en Chrome y en Safari. Si has abierto ECLIPSE desde dentro de
              otra aplicación, ábrela en el navegador y vuelve a intentarlo.
            </p>
          </div>
        ) : (
          <>
            {/*
              El eclipse, no una bola cualquiera: es el logo de la aplicación
              hecho criatura. Tres anillos que respiran a distinto ritmo según
              lo que esté pasando, y un halo detrás que se enciende cuando
              habla. Se reconoce de lejos y dice en qué punto está sin leer.
            */}
            <div className="relative flex h-64 w-64 items-center justify-center" aria-hidden>
              <div
                className={`absolute inset-0 rounded-full blur-2xl transition-all duration-700 ${
                  fase === "hablando"
                    ? "scale-110 bg-ok/25"
                    : fase === "pensando"
                      ? "scale-105 bg-pro/25"
                      : "scale-95 bg-halo/12"
                }`}
              />

              {[0, 1, 2].map((anillo) => (
                <div
                  key={anillo}
                  className={`absolute rounded-full border transition-colors duration-500 ${
                    fase === "hablando"
                      ? "border-ok/40"
                      : fase === "pensando"
                        ? "border-pro/40"
                        : "border-halo/25"
                  }`}
                  style={{
                    width: `${118 + anillo * 46}px`,
                    height: `${118 + anillo * 46}px`,
                    animation: enMarcha
                      ? `eclipse-pulse ${
                          fase === "hablando" ? 1.1 : fase === "pensando" ? 1.7 : 3.4
                        }s ease-in-out ${anillo * 0.22}s infinite`
                      : undefined,
                    opacity: 1 - anillo * 0.28,
                  }}
                />
              ))}

              <div
                className={`relative h-[104px] w-[104px] rounded-full border-[6px] transition-colors duration-500 ${
                  fase === "hablando"
                    ? "border-ok/80"
                    : fase === "pensando"
                      ? "border-pro/80"
                      : "border-ink/85"
                }`}
              />
            </div>

            <div className="flex flex-col items-center gap-2">
              <p className="text-[16px] font-medium text-ink" aria-live="polite">
                {LETRERO[fase]}
              </p>
              {ultimo && (
                <p className="max-w-sm text-center text-[13px] leading-relaxed text-muted">
                  {ultimo.quien === "tu" && <span className="text-faint">Tú: </span>}
                  {ultimo.texto.length > 200 ? `${ultimo.texto.slice(0, 200)}…` : ultimo.texto}
                </p>
              )}
              {error && (
                <p className="max-w-xs text-center text-[12.5px] leading-relaxed text-danger">
                  {error}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="relative flex items-center justify-center gap-5 px-8 pb-10 safe-bottom">
        <button
          onClick={() => {
            const nuevo = !silenciado;
            setSilenciado(nuevo);
            motorRef.current?.silenciar(nuevo);
          }}
          disabled={!sePuede}
          aria-label={silenciado ? "Quitar el silencio" : "Silenciar"}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
            silenciado
              ? "bg-ink text-void"
              : "border border-line bg-panel/60 text-ink hover:bg-panel"
          } disabled:opacity-40`}
        >
          <Icon.Mic width={22} height={22} />
        </button>

        <button
          onClick={colgar}
          aria-label="Colgar"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-danger text-white shadow-lg transition hover:opacity-90 active:scale-95"
        >
          <Icon.Phone width={26} height={26} className="rotate-[135deg]" />
        </button>

        <button
          onClick={() => setAjustesVisibles(true)}
          aria-label="Ajustes de voz"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-panel/60 text-ink transition hover:bg-panel"
        >
          <Icon.Settings width={20} height={20} />
        </button>
      </div>

      {ajustesVisibles && (
        <AjustesDeVoz
          /*
            Cada cambio entra YA, no al cerrar.

            Era el fallo que hacía pensar que los botones no servían para nada:
            cambiabas a voz de hombre, oías la prueba bien, cerrabas y ECLIPSE
            seguía hablando igual el resto de la llamada, porque los ajustes se
            habían leído al descolgar y no se volvían a mirar.
          */
          onCambio={(nuevos) => {
            ajustesRef.current = nuevos;
          }}
          onCerrar={() => {
            setAjustesVisibles(false);
            ajustesRef.current = leerAjustes();
          }}
        />
      )}
    </div>
  );
}

/** Mm:ss, que es como se lee el rato que llevas hablando. */
function segundos(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Los ajustes de voz, sin salirse de la llamada.
 *
 * Aquí y no solo en Ajustes porque es donde uno se da cuenta de que quiere
 * cambiarlos: cuando la voz va demasiado rápida, o suena a robot, o está
 * leyendo en el idioma que no es. Obligar a colgar, buscar Ajustes y volver a
 * llamar para arreglar eso es perder la llamada.
 */
function AjustesDeVoz({
  onCerrar,
  onCambio,
}: {
  onCerrar: () => void;
  onCambio?: (ajustes: AjustesVoz) => void;
}) {
  const [ajustes, setAjustes] = useState<AjustesVoz>(VOZ_POR_DEFECTO);
  /** Qué voces tiene ESTE aparato en ESTE idioma. Se pregunta, no se supone. */
  const [hay, setHay] = useState({ dos: true });
  /** Las voces de este móvil, para poder elegir una por el oído. */
  const [suyas, setSuyas] = useState<{ name: string; lang: string; localService?: boolean }[]>([]);

  useEffect(() => {
    setAjustes(leerAjustes());
  }, []);

  /*
    El catálogo de voces del aparato llega tarde.

    En Chrome, `getVoices()` devuelve una lista vacía hasta que el navegador
    termina de cargarlas, y avisa con `voiceschanged`. Sin escuchar ese aviso,
    la primera vez que se abre esto se diría que el móvil no tiene ninguna voz.
  */
  useEffect(() => {
    const mirar = () => {
      try {
        const todas = window.speechSynthesis.getVoices();
        setHay({ dos: suenanDistinto(todas, ajustes.idioma) });
        setSuyas(vocesDelIdioma(todas, ajustes.idioma));
      } catch {
        /* sin voces en este aparato */
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
    onCambio?.(nuevo);
  };

  /** Una frase de prueba, para oírlo antes de decidir. */
  const probar = (config: AjustesVoz) => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(
        config.idioma.startsWith("es") ? "Así es como voy a sonar." : "This is how I will sound.",
      );
      u.lang = config.idioma;
      u.rate = velocidadDe(config.ritmo);
      const voces = window.speechSynthesis.getVoices();
      const elegida = elegirVoz(voces, config);
      const real = elegida ? voces.find((v) => v.name === elegida.name) : null;
      // El tono, sabiendo ya quién va a hablar: ver `tonoPara`.
      u.pitch = tonoPara(config, voces);
      if (real) u.voice = real;
      window.speechSynthesis.speak(u);
    } catch {
      /* sin voz en este aparato */
    }
  };

  return (
    <div className="absolute inset-0 z-10 flex items-end bg-black/60 backdrop-blur-sm" onClick={onCerrar}>
      <div
        className="w-full rounded-t-2xl border-t border-line bg-surface p-5 pb-8 safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[15px] font-medium text-ink">Cómo quieres que suene</span>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-1 text-faint hover:text-ink">
            <Icon.Close width={18} height={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">Voz</div>
            <div className="flex gap-1.5 rounded-xl border border-line-soft bg-panel/40 p-1">
              {VOCES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    // Volver a lo automático: si no, se elegiría "hombre" y
                    // seguiría sonando la voz concreta de antes.
                    cambiar({ voz: v.id, vozExacta: undefined });
                    probar({ ...ajustes, voz: v.id, vozExacta: undefined });
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-[13px] transition ${
                    ajustes.voz === v.id ? "bg-raised text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {v.nombre}
                </button>
              ))}
            </div>
            {/*
              Si el móvil no tiene voz de quien se ha pedido, se dice. Callarlo
              haría pensar que el botón no funciona, cuando lo que pasa es que
              ahí no hay nada que elegir.
            */}
            {!ajustes.vozExacta && ajustes.voz !== "cualquiera" && !hay.dos && (
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
                Tu móvil solo tiene una voz en este idioma, así que no puede sonar a dos personas:
                se le cambia el tono para acercarla a lo que pides. Para que suene otra de verdad,
                se instalan más voces desde los ajustes del propio móvil.
              </p>
            )}
          </div>

          {/*
            Las voces del móvil, una por una.

            Esto es lo que de verdad arregla el "le doy a hombre y suena igual".
            En un Android las voces se llaman `es-es-x-eed-local` y ahí no hay
            forma de saber de quién es cada una: por bien que se adivine, a
            veces las dos opciones son la misma voz. Tocando una se oye, y la
            que suene bien se queda.
          */}
          {suyas.length > 1 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11.5px] uppercase tracking-wide text-faint">
                  Voces de tu móvil
                </span>
                {ajustes.vozExacta && (
                  <button
                    onClick={() => cambiar({ vozExacta: undefined })}
                    className="text-[11.5px] text-faint transition hover:text-ink"
                  >
                    Volver a la automática
                  </button>
                )}
              </div>
              <div className="scroll-thin max-h-44 space-y-1 overflow-y-auto pr-1">
                {suyas.map((v, i) => (
                  <button
                    key={v.name}
                    onClick={() => {
                      const nuevo = { ...ajustes, vozExacta: v.name };
                      cambiar({ vozExacta: v.name });
                      probar(nuevo);
                    }}
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
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
                Las que ponen «suena mejor» son las que tu móvil baja de internet: son las que no
                suenan a robot. Si no tienes ninguna, se instalan desde los ajustes de voz de
                Android o del iPhone.
              </p>
            </div>
          )}

          <div>
            <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">Timbre</div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "suave" as const, nombre: "Suave", pie: "Más grave y tranquila" },
                { id: "clara" as const, nombre: "Clara", pie: "Más marcada y nítida" },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    cambiar({ timbre: t.id });
                    probar({ ...ajustes, timbre: t.id });
                  }}
                  className={`rounded-xl border p-3 text-left transition ${
                    ajustes.timbre === t.id
                      ? "border-halo/50 bg-panel"
                      : "border-line-soft bg-panel/40 hover:border-line"
                  }`}
                >
                  <span className="block text-[13.5px] text-ink">{t.nombre}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-faint">{t.pie}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">Ritmo</div>
            <div className="flex gap-1.5 rounded-xl border border-line-soft bg-panel/40 p-1">
              {RITMOS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    cambiar({ ritmo: r.id });
                    probar({ ...ajustes, ritmo: r.id });
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-[13px] transition ${
                    ajustes.ritmo === r.id ? "bg-raised text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {r.nombre}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[11.5px] uppercase tracking-wide text-faint">
              Idioma
            </span>
            <select
              value={ajustes.idioma}
              onChange={(e) => {
                cambiar({ idioma: e.target.value });
                probar({ ...ajustes, idioma: e.target.value });
              }}
              className="w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-[14px] text-ink outline-none focus:border-halo/40"
            >
              {IDIOMAS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-[11.5px] leading-relaxed text-faint">
              También es el idioma en el que te escucha. Las voces las pone tu móvil, y ECLIPSE
              coge la que mejor suena de las que tengas.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
