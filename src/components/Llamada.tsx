"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Icon from "./Icons";
import { dictar, dictadoDisponible } from "@/lib/dictado";
import {
  COMO_HABLAR,
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
  const motorRef = useRef<Motor | null>(null);
  const vozRef = useRef<SpeechSynthesisUtterance | null>(null);

  /** Decir una frase en alto y esperar a que termine. */
  const decir = useCallback(
    (frase: string) =>
      new Promise<void>((listo) => {
        if (typeof window === "undefined" || !window.speechSynthesis) return listo();

        const voz = new SpeechSynthesisUtterance(frase);
        voz.lang = "es-ES";
        voz.rate = 1.04;
        voz.pitch = 1;

        // La mejor voz española que tenga el aparato. Las "premium" y las de
        // Google suenan mucho mejor que la que sale por defecto.
        const voces = window.speechSynthesis.getVoices();
        const buena =
          voces.find((v) => /es[-_]ES/i.test(v.lang) && /google|premium|enhanced|natural/i.test(v.name)) ??
          voces.find((v) => /es[-_]ES/i.test(v.lang)) ??
          voces.find((v) => /^es/i.test(v.lang));
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
      async preguntar(turnos) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "chat",
            // En una llamada manda la latencia: dos segundos de silencio son
            // eternos cuando tienes el teléfono en la oreja.
            speed: "rapido",
            voz: true,
            messages: turnos.map((t) => ({ role: t.role, content: t.content })),
          }),
        });
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(d.error ?? "No he podido contestar.");
        }

        // La respuesta llega en trozos; en una llamada se espera a tenerla
        // entera, porque hablar a medias y rectificar suena peor que esperar.
        const texto = await res.text();
        let salida = "";
        for (const linea of texto.split("\n")) {
          if (!linea.startsWith("data:")) continue;
          try {
            const e = JSON.parse(linea.slice(5).trim()) as { t?: string; v?: unknown };
            if (e.t === "text" && typeof e.v === "string") salida += e.v;
            if (e.t === "error" && typeof e.v === "string") throw new Error(e.v);
          } catch {
            /* una línea suelta que no era JSON */
          }
        }
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

  if (!abierta) return null;

  const colgar = () => {
    const turnos = motorRef.current?.turnos() ?? [];
    motorRef.current?.colgar();
    if (turnos.length) onGuardar?.(turnos);
    onCerrar();
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-void">
      <div className="flex items-center justify-between px-4 py-4 safe-top">
        <span className="text-[13px] text-faint">
          {nombre ? `Llamada con ECLIPSE · ${nombre}` : "Llamada con ECLIPSE"}
        </span>
        <button
          onClick={colgar}
          aria-label="Cerrar"
          className="rounded-lg p-2 text-faint transition hover:text-ink"
        >
          <Icon.Close width={20} height={20} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-8">
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
              La bola. Late despacio al escuchar, rápido al pensar y al ritmo
              de la voz al hablar: es todo lo que hace falta ver para saber de
              quién es el turno sin mirar ni una palabra.
            */}
            <div
              className={`h-52 w-52 rounded-full bg-gradient-to-br ${COLORES[fase]} transition-colors duration-500`}
              style={{
                animation:
                  fase === "pensando"
                    ? "eclipse-pulse 1.1s ease-in-out infinite"
                    : fase === "hablando"
                      ? "eclipse-pulse 0.55s ease-in-out infinite"
                      : fase === "escuchando"
                        ? "eclipse-pulse 3s ease-in-out infinite"
                        : undefined,
                filter: "blur(0.5px)",
              }}
              aria-hidden
            />

            <p className="text-[15px] font-medium text-ink" aria-live="polite">
              {LETRERO[fase]}
            </p>

            {error && (
              <p className="max-w-xs text-center text-[12.5px] leading-relaxed text-danger">
                {error}
              </p>
            )}

            {ultimo && (
              <p className="max-w-sm text-center text-[13px] leading-relaxed text-muted">
                <span className="text-faint">{ultimo.quien === "tu" ? "Tú: " : ""}</span>
                {ultimo.texto.length > 220 ? `${ultimo.texto.slice(0, 220)}…` : ultimo.texto}
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 px-8 pb-10 safe-bottom">
        <button
          onClick={() => {
            const nuevo = !silenciado;
            setSilenciado(nuevo);
            motorRef.current?.silenciar(nuevo);
          }}
          disabled={!sePuede}
          aria-label={silenciado ? "Quitar el silencio" : "Silenciar"}
          className={`rounded-full p-4 transition ${
            silenciado ? "bg-raised text-faint" : "bg-panel text-ink hover:bg-raised"
          } disabled:opacity-40`}
        >
          <Icon.Mic width={22} height={22} />
        </button>

        <button
          onClick={colgar}
          aria-label="Colgar"
          className="rounded-full bg-danger p-5 text-white transition hover:opacity-90"
        >
          <Icon.Close width={24} height={24} />
        </button>
      </div>
    </div>
  );
}
