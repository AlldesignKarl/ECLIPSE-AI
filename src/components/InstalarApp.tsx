"use client";

import { useEffect, useState } from "react";
import EclipseMark from "./EclipseMark";
import * as Icon from "./Icons";

/**
 * El aviso para instalar ECLIPSE en la pantalla de inicio.
 *
 * La aplicación ya se podía instalar —el manifiesto lleva ahí desde el
 * principio—, pero nadie lo sabía: el navegador no lo ofrece por su cuenta en
 * ningún sitio visible. Y la diferencia entre una web que hay que recordar
 * buscar y un icono al lado de WhatsApp es casi toda la diferencia.
 *
 * Se pide una sola vez y con cuidado: no aparece nada más entrar, no vuelve si
 * lo apartas, y no existe si ya está instalada.
 */

/** El evento de Chrome, que no está en los tipos estándar. */
interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const APARTADO = "eclipse.instalar.no";
/** Lo que se tarda en ver si esto sirve para algo. Antes, el aviso estorba. */
const ESPERA_MS = 45000;

function yaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari en iPhone no entiende `display-mode`, tiene lo suyo.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function esIPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [aLaVista, setALaVista] = useState(false);
  // En iPhone no hay forma de instalar desde código: solo se puede explicar.
  const [explicarIPhone, setExplicarIPhone] = useState(false);

  useEffect(() => {
    if (yaInstalada()) return;
    try {
      if (window.localStorage.getItem(APARTADO) === "1") return;
    } catch {
      /* navegador sin almacenamiento: se preguntará otra vez, tampoco es grave */
    }

    const alPoder = (e: Event) => {
      // Sin esto, Chrome enseña su propia barra además de la nuestra.
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    window.addEventListener("beforeinstallprompt", alPoder);

    const reloj = window.setTimeout(() => setALaVista(true), ESPERA_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", alPoder);
      window.clearTimeout(reloj);
    };
  }, []);

  const apartar = () => {
    setALaVista(false);
    setExplicarIPhone(false);
    try {
      window.localStorage.setItem(APARTADO, "1");
    } catch {
      /* da igual */
    }
  };

  const instalar = async () => {
    if (!evento) return setExplicarIPhone(true);
    await evento.prompt();
    await evento.userChoice.catch(() => null);
    // Aceptada o no, el evento ya no vale para un segundo intento.
    setEvento(null);
    apartar();
  };

  // En Android hace falta que Chrome nos deje; en iPhone, basta con ser iPhone.
  const sePuede = Boolean(evento) || esIPhone();
  if (!aLaVista || !sePuede) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 safe-bottom">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-line bg-panel/95 p-3.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.95)] backdrop-blur">
        {explicarIPhone ? (
          <>
            <p className="text-[13.5px] font-medium text-ink">Para tenerla en tu pantalla de inicio</p>
            <ol className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-muted">
              <li>1. Pulsa el botón de compartir, abajo en el centro.</li>
              <li>2. Baja y elige «Añadir a pantalla de inicio».</li>
            </ol>
            <button
              onClick={apartar}
              className="mt-3 w-full rounded-xl border border-line py-2 text-[13px] text-muted transition hover:text-ink"
            >
              Entendido
            </button>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <EclipseMark size={34} />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium leading-snug text-ink">
                Ten ECLIPSE a mano
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-muted">
                Añádela a tu pantalla de inicio y se abre como una app.
              </p>
            </div>

            <button
              onClick={apartar}
              aria-label="Ahora no"
              className="shrink-0 rounded-lg p-1.5 text-faint transition hover:text-muted"
            >
              <Icon.Close width={16} height={16} />
            </button>
          </div>
        )}

        {!explicarIPhone && (
          <button
            onClick={instalar}
            className="mt-3 w-full rounded-xl bg-ink py-2.5 text-[13.5px] font-medium text-void transition hover:opacity-90"
          >
            Añadir a la pantalla de inicio
          </button>
        )}
      </div>
    </div>
  );
}
