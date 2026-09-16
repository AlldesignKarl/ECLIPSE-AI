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
  /** Si tiene foto de perfil puesta. La foto se pide aparte. */
  foto?: boolean;
}

type ModoEclipse = "siempre" | "nombrado" | "no";

/** Los tres sitios donde puede estar ECLIPSE, dichos como se dicen. */
const MODOS: { id: ModoEclipse; corto: string; explicacion: string }[] = [
  { id: "siempre", corto: "A todo", explicacion: "Contesta a todos los mensajes del grupo." },
  {
    id: "nombrado",
    corto: "Si le nombráis",
    explicacion: "Contesta cuando alguien dice «ECLIPSE» o le pide algo directamente.",
  },
  { id: "no", corto: "No está", explicacion: "No lee ni contesta nada." },
];

export interface Grupo {
  id: string;
  nombre: string;
  miembros: Miembro[];
  soyDueno: boolean;
  invitacion?: string;
  hueco: boolean;
  eclipse?: ModoEclipse;
  /** Si lleva día, es una quedada: un grupo con fecha. */
  fecha?: string;
  nota?: string;
}

/** "sábado, 20 de septiembre", que es como se dice una fecha. */
function comoSeLeeLaFecha(fecha: string): string {
  const [ano, mes, dia] = fecha.split("-").map(Number);
  if (!ano || !mes || !dia) return fecha;
  return new Date(Date.UTC(ano, mes - 1, dia)).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** Lo que se puede saber de un grupo SIN estar dentro. */
interface Ojeada {
  id: string;
  nombre: string;
  personas: number;
  hueco: boolean;
  yaDentro: boolean;
}

interface Mensaje {
  id: string;
  nombre: string;
  texto: string;
  cuando: number;
  mio: boolean;
  deEclipse: boolean;
  /** El nombre de la foto, si la lleva. La foto se pide aparte. */
  imagen?: string;
  /** Si esta persona puede quitarlo: lo suyo, o cualquiera si creó el grupo. */
  borrable?: boolean;
  /** Pintado ya, todavía sin confirmar por el servidor. */
  enCamino?: boolean;
  /** Vista previa local mientras sube: la foto se ve antes de llegar. */
  previa?: string;
}

/**
 * Una foto de móvil, lista para un grupo.
 *
 * Se encoge AQUÍ, antes de subirla. Una foto de móvil son cuatro megas y en un
 * grupo la bajan todos: subirla tal cual es gastar los datos de cinco personas
 * para enseñar algo que se va a ver en una pantalla de seis pulgadas.
 */
function encogerFoto(fichero: File): Promise<string> {
  return new Promise((listo, falla) => {
    const lector = new FileReader();
    lector.onerror = () => falla(new Error("No se ha podido leer la foto."));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => falla(new Error("Ese archivo no es una foto."));
      img.onload = () => {
        const LADO = 1280;
        const escala = Math.min(1, LADO / Math.max(img.width, img.height));
        const lienzo = document.createElement("canvas");
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        const pincel = lienzo.getContext("2d");
        if (!pincel) return falla(new Error("Este navegador no puede prepararla."));
        pincel.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        listo(lienzo.toDataURL("image/jpeg", 0.72));
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(fichero);
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function GruposDialog({ open, onClose }: Props) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [dentro, setDentro] = useState<Grupo | null>(null);
  const [sinCuenta, setSinCuenta] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  const [creando, setCreando] = useState("");
  const [busy, setBusy] = useState(false);
  /** La invitación que alguien acaba de abrir, antes de aceptarla. */
  const [invitado, setInvitado] = useState<(Ojeada & { codigo: string }) | null>(null);

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
    Una invitación en la dirección.

    Antes se entraba a lo bruto: se veía el código y se metía a quien fuera en
    el grupo sin decirle en cuál. Quien recibe un enlace por WhatsApp merece
    saber a qué le están invitando ANTES de estar dentro —de quién es, cuánta
    gente hay, si queda sitio—, y quien no tiene cuenta merece que se le diga
    en vez de un error seco.

    Así que primero se mira, se enseña, y se entra al darle. El código se queda
    en la dirección hasta entonces: si tiene que crearse la cuenta, al volver
    la invitación sigue esperándole.
  */
  useEffect(() => {
    if (typeof window === "undefined" || !open) return;
    const codigo = new URLSearchParams(window.location.search).get("grupo");
    if (!codigo) return;

    void (async () => {
      try {
        const r = await fetch(`/api/grupos?invitacion=${encodeURIComponent(codigo)}`);
        const d = (await r.json()) as { ojeada?: Ojeada; error?: string };
        if (d.ojeada) setInvitado({ ...d.ojeada, codigo });
        else setProblema(d.error ?? "Esa invitación ya no vale.");
      } catch {
        setProblema("No se ha podido abrir la invitación.");
      }
    })();
  }, [open]);

  /** Aceptar la invitación que se está enseñando. */
  const entrar = async () => {
    if (!invitado || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/grupos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitacion: invitado.codigo }),
      });
      const d = (await r.json()) as { grupo?: Grupo; error?: string };
      if (d.grupo) {
        window.history.replaceState({}, "", window.location.pathname);
        setInvitado(null);
        await recargar();
        setDentro(d.grupo);
      } else setProblema(d.error ?? "No se ha podido entrar en el grupo.");
    } finally {
      setBusy(false);
    }
  };

  if (invitado) {
    return (
      <Modal open={open} onClose={onClose} title="Te han invitado a un grupo">
        <div className="space-y-4">
          <div className="rounded-2xl border border-line-soft bg-panel/40 p-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-panel text-muted">
              <Icon.Group width={22} height={22} />
            </span>
            <p className="mt-3 text-[17px] font-semibold text-ink">{invitado.nombre}</p>
            <p className="mt-1 text-[12.5px] text-muted">
              {invitado.personas} persona{invitado.personas === 1 ? "" : "s"} dentro
            </p>
          </div>

          {sinCuenta ? (
            <Aviso texto="Para entrar hace falta tu cuenta: es cómo te ven los demás en el grupo. Créala o entra, y la invitación te seguirá esperando aquí." />
          ) : !invitado.hueco ? (
            <Aviso texto="Este grupo está lleno. Quien lo creó puede decirte si sale alguien." />
          ) : (
            <p className="text-[12.5px] leading-relaxed text-muted">
              Dentro habláis todos con ECLIPSE en el mismo sitio. Los demás verán el nombre que
              elegiste, nunca tu correo.
            </p>
          )}

          {problema && <Aviso texto={problema} />}

          <div className="flex gap-2">
            <button
              onClick={() => {
                window.history.replaceState({}, "", window.location.pathname);
                setInvitado(null);
                setProblema(null);
              }}
              className="flex-1 rounded-xl border border-line py-2.5 text-[13px] text-muted transition hover:text-ink"
            >
              Ahora no
            </button>
            <button
              onClick={() => void entrar()}
              disabled={busy || sinCuenta || !invitado.hueco}
              className="flex-1 rounded-xl bg-ink py-2.5 text-[13px] font-medium text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
            >
              {invitado.yaDentro ? "Volver al grupo" : busy ? "Entrando…" : "Entrar en el grupo"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

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
                      {g.eclipse !== "no" && " · con ECLIPSE"}
                      {g.soyDueno && " · lo creaste tú"}
                    </span>
                  </span>
                  <Icon.ChevronLeft width={15} height={15} className="shrink-0 rotate-180 text-faint" />
                </button>
              ))}
            </div>
          </div>
        )}

        {!sinCuenta ? (
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

/* -------------------------------------------------------------------------- */
/*                            Meter gente al grupo                            */
/* -------------------------------------------------------------------------- */

/**
 * Invitar.
 *
 * Estaba escondido detrás de tocar el "1 persona" de la esquina, que es
 * exactamente donde nadie mira: la queja fue "no se puede meter a amigos", y
 * tenía razón, porque a efectos prácticos no se podía.
 *
 * Ahora es un botón con su nombre, arriba, siempre. Y en el móvil abre el menú
 * de compartir del propio teléfono —WhatsApp, Telegram, lo que tenga— en vez
 * de copiar al portapapeles y que se busque la vida: mandar un enlace a un
 * amigo es un gesto, no dos pantallas.
 */
function BotonInvitar({
  grupo,
  enlace,
  grande,
}: {
  grupo: Grupo;
  enlace: string;
  grande?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const [sePuedeCompartir, setSePuedeCompartir] = useState(false);

  // `navigator.share` solo existe en el móvil y en algunos escritorios, y solo
  // se puede preguntar ya montados.
  useEffect(() => {
    setSePuedeCompartir(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  if (!enlace) return null;

  const invitar = async () => {
    const texto = `Te invito al grupo «${grupo.nombre}» en ECLIPSE. Entras con este enlace:`;
    if (sePuedeCompartir) {
      try {
        await navigator.share({ title: grupo.nombre, text: texto, url: enlace });
        return;
      } catch {
        // Si cierra el menú de compartir no ha pasado nada malo: se cae al
        // portapapeles, que funciona en todas partes.
      }
    }
    await navigator.clipboard.writeText(enlace).catch(() => {});
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1800);
  };

  if (grande)
    return (
      <button
        onClick={() => void invitar()}
        className="flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-medium text-void transition hover:opacity-90"
      >
        <Icon.PersonaMas width={15} height={15} />
        {copiado ? "Enlace copiado" : "Invitar a alguien"}
      </button>
    );

  return (
    <button
      onClick={() => void invitar()}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12.5px] text-ink transition hover:bg-panel"
    >
      <Icon.PersonaMas width={14} height={14} />
      {copiado ? "Copiado" : "Invitar"}
    </button>
  );
}

/** Las iniciales de alguien, para distinguir quién habla de un vistazo. */
function inicialesDe(nombre: string): string {
  const trozos = nombre.trim().split(/\s+/).filter(Boolean);
  if (!trozos.length) return "?";
  if (trozos.length === 1) return trozos[0].slice(0, 2).toUpperCase();
  return (trozos[0][0] + trozos[1][0]).toUpperCase();
}

/**
 * Un color por persona, siempre el mismo.
 *
 * Sale del propio nombre, así que Marta es del mismo color en tu móvil y en el
 * de tu hermano sin guardar nada en ninguna parte. Es lo que hace que en un
 * grupo de seis se sepa quién habla sin leer el nombre.
 */
function colorDe(nombre: string): string {
  const tonos = [210, 145, 25, 280, 340, 190, 55, 305];
  let suma = 0;
  for (let i = 0; i < nombre.length; i++) suma = (suma + nombre.charCodeAt(i) * (i + 1)) % 997;
  return `hsl(${tonos[suma % tonos.length]} 55% 58%)`;
}

/**
 * La cara de alguien en el grupo: su foto de perfil, o sus iniciales.
 *
 * Lo pidió Carlos: "que la gente tenga la foto de perfil que tenga dentro de la
 * app". Y con el respaldo puesto, que es lo que hace que esto no se vea roto
 * nunca: quien no tiene foto sigue teniendo su inicial y su color de siempre,
 * y si la foto no carga —se la ha quitado, o va mal la red— se cae a lo mismo.
 *
 * La foto se pide por su dirección y no viaja dentro de la lista de gente: esa
 * lista se refresca cada pocos segundos y una foto de perfil son hasta
 * trescientos kilobytes. Así se pide una vez y la guarda el navegador.
 */
function Cara({
  nombre,
  grupo,
  foto,
  lado,
}: {
  nombre: string;
  grupo: string;
  foto?: boolean;
  /** Lo que mide de lado, en píxeles. Las hay de 20 y de 28. */
  lado: number;
}) {
  const [falla, setFalla] = useState(false);
  const letra = Math.max(9, Math.round(lado * 0.38));

  if (foto && !falla)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/grupos?id=${encodeURIComponent(grupo)}&avatar=${encodeURIComponent(nombre)}`}
        alt=""
        onError={() => setFalla(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: lado, height: lado }}
      />
    );

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: lado, height: lado, fontSize: letra, background: colorDe(nombre) }}
    >
      {inicialesDe(nombre)}
    </span>
  );
}

/** La hora, corta. La fecha solo si no es de hoy. */
function cuandoDe(momento: number): string {
  const d = new Date(momento);
  const hoy = new Date();
  const mismoDia =
    d.getDate() === hoy.getDate() && d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
  const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return mismoDia ? hora : `${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · ${hora}`;
}

/** Dentro del grupo. */
/**
 * La foto de un mensaje.
 *
 * Mientras sube se enseña la que hay en el móvil (`previa`), así que se ve al
 * instante; cuando el servidor la tiene, se pide por su dirección y el
 * navegador la guarda en su caché para siempre. Las fotos NO viajan dentro de
 * la lista de mensajes, que se pide cada segundo y medio: eso sería reenviarlas
 * todas, a todos, todo el rato.
 */
function Foto({ mensaje, grupo }: { mensaje: Mensaje; grupo: string }) {
  const src =
    mensaje.previa ??
    (mensaje.imagen
      ? `/api/grupos/mensajes?id=${grupo}&foto=${encodeURIComponent(mensaje.imagen)}`
      : "");
  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={`mb-1 max-h-72 w-auto max-w-full rounded-2xl border border-line-soft ${
        mensaje.enCamino ? "opacity-70" : ""
      }`}
    />
  );
}

/**
 * El chat de un grupo. Se exporta porque las QUEDADAS lo reutilizan tal cual.
 *
 * Una quedada es un grupo con fecha, así que su chat es este mismo: las fotos,
 * el invitar, el borrar y ECLIPSE dentro ya funcionan aquí. Escribir un segundo
 * chat para las quedadas habría sido mantener dos cosas iguales y que una de
 * las dos se quedara atrás.
 */
export function Sala({
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
  /** ECLIPSE está escribiendo su respuesta ahora mismo. */
  const [pensando, setPensando] = useState(false);
  const [gente, setGente] = useState(false);
  const [miembros, setMiembros] = useState<Miembro[]>(grupo.miembros);
  /** Cómo está ECLIPSE aquí dentro. Lo cambia el dueño y lo ven todos. */
  const [eclipse, setEclipse] = useState<ModoEclipse>(grupo.eclipse ?? "nombrado");
  const [cambiandoEclipse, setCambiandoEclipse] = useState(false);
  /** El último mensaje para el que ya se ha pedido respuesta. */
  const pedido = useRef("");
  /** El mensaje que se ha tocado, para poder borrarlo. */
  const [tocado, setTocado] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const foto = useRef<HTMLInputElement>(null);
  const fondo = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/grupos/mensajes?id=${grupo.id}`);
      const d = (await r.json()) as {
        mensajes?: Mensaje[];
        miembros?: Miembro[];
        eclipse?: ModoEclipse;
      };
      /*
        Lo que ya está en el servidor, más lo tuyo que va de camino.

        Sin esta mezcla, tu propio mensaje desaparecía un segundo: se pintaba
        al momento y el siguiente vistazo lo borraba hasta que el servidor lo
        devolvía. Un mensaje que parpadea parece un mensaje que no se ha
        enviado.
      */
      const llegados = d.mensajes ?? [];
      setMensajes((previos) => [
        ...llegados,
        ...previos.filter(
          (m) =>
            m.enCamino &&
            !llegados.some((s) => s.mio && s.texto === m.texto && Boolean(s.imagen) === Boolean(m.previa)),
        ),
      ]);
      // Quién hay dentro también cambia mientras se mira: si no se refresca,
      // quien invitó sigue viendo "1 persona" después de que entre su amigo.
      if (d.miembros?.length) setMiembros(d.miembros);
      // Y cómo está ECLIPSE: lo puede haber cambiado el dueño hace un segundo.
      if (d.eclipse) setEclipse(d.eclipse);

      /*
        Si lo último es de otro y lleva un rato sin respuesta, se la pedimos.

        La respuesta la pide normalmente quien escribe, pero si cierra la
        aplicación justo después, su pregunta se quedaría ahí colgada para
        siempre. Cualquiera del grupo que lo vea la pide; el servidor reparte un
        turno, así que por muchos móviles que la pidan a la vez contesta una
        sola vez.
      */
      const ultimo = llegados.at(-1);
      if (
        ultimo &&
        !ultimo.deEclipse &&
        !ultimo.mio &&
        d.eclipse !== "no" &&
        pedido.current !== ultimo.id &&
        Date.now() - ultimo.cuando > 2500
      ) {
        pedido.current = ultimo.id;
        setPensando(true);
        fetch("/api/grupos/mensajes?responder=1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: grupo.id }),
        })
          .catch(() => {})
          .finally(() => setPensando(false));
      }
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
    // Más a menudo mientras ECLIPSE escribe: es el rato en el que se está
    // mirando la pantalla a ver si aparece algo.
    const reloj = window.setInterval(() => void cargar(), pensando ? 900 : 1500);
    return () => window.clearInterval(reloj);
  }, [open, cargar, pensando]);

  useEffect(() => {
    fondo.current?.scrollTo({ top: fondo.current.scrollHeight, behavior: "smooth" });
  }, [mensajes.length]);

  /**
   * Mandar. Se ve al momento y no se espera a nadie.
   *
   * Dos peticiones a propósito: la primera guarda el mensaje y vuelve enseguida
   * —es lo que hace que el grupo vaya rápido— y la segunda, que puede tardar
   * sus segundos, es la que le pide la respuesta a ECLIPSE. No se espera a la
   * segunda para nada: la respuesta cae sola en el siguiente vistazo.
   */
  const enviar = (imagen?: string) => {
    const dicho = texto.trim();
    if (!dicho && !imagen) return;
    setTexto("");
    setAviso(null);

    setMensajes((m) => [
      ...m,
      {
        id: `propio-${Date.now()}`,
        nombre: "",
        texto: dicho,
        cuando: Date.now(),
        mio: true,
        deEclipse: false,
        enCamino: true,
        previa: imagen,
      },
    ]);

    void (async () => {
      try {
        const r = await fetch("/api/grupos/mensajes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: grupo.id, texto: dicho, imagen }),
        });
        if (!r.ok) {
          const d = (await r.json().catch(() => ({}))) as { error?: string };
          setAviso(d.error ?? "No se ha podido mandar.");
          setMensajes((m) => m.filter((x) => !x.enCamino));
          return;
        }
        const d = (await r.json()) as { contesta?: boolean; id?: string };
        // Apuntado como pedido: si no, el vistazo de dentro de un segundo lo
        // pediría otra vez por su cuenta.
        if (d?.id) pedido.current = d.id;
        void cargar();

        if (d?.contesta) {
          setPensando(true);
          fetch("/api/grupos/mensajes?responder=1", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: grupo.id }),
          })
            .catch(() => {})
            .finally(() => {
              setPensando(false);
              void cargar();
            });
        }
      } catch {
        /* al recargar se verá si llegó */
      }
    })();
  };

  const borrarMensaje = async (id: string) => {
    setTocado(null);
    setMensajes((m) => m.filter((x) => x.id !== id));
    await fetch(`/api/grupos/mensajes?id=${grupo.id}&mensaje=${id}`, { method: "DELETE" }).catch(
      () => {},
    );
    void cargar();
  };

  const enlace =
    typeof window !== "undefined" && grupo.invitacion
      ? `${window.location.origin}/?grupo=${grupo.invitacion}`
      : "";

  return (
    <Modal open={open} onClose={onClose} title={grupo.nombre} wide fondo>
      <div className="flex h-[70vh] flex-col">
        {/*
          La cabecera del grupo: volver, quién está, e invitar.

          Invitar va aquí y no escondido, porque es lo primero que hace falta
          en un grupo recién hecho y lo único que no se puede deducir solo.
        */}
        <div className="flex items-center gap-2 border-b border-line-soft pb-2.5">
          <button
            onClick={onVolver}
            className="flex shrink-0 items-center gap-1 text-[12.5px] text-faint transition hover:text-ink"
          >
            <Icon.ChevronLeft width={14} height={14} />
            Grupos
          </button>

          <button
            onClick={() => setGente(!gente)}
            aria-label="Quién está"
            className="ml-auto flex min-w-0 items-center gap-1.5 text-[12.5px] text-faint transition hover:text-ink"
          >
            <span className="flex -space-x-1.5">
              {/*
                ECLIPSE, el primero y con su marca.

                Estaba dentro desde el principio pero no se veía en ninguna
                parte: quien montaba un grupo no tenía forma de saber que había
                alguien más sentado a la mesa, ni de decirle cuándo hablar.
              */}
              {eclipse !== "no" && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-void bg-pro/20 text-pro">
                  <Icon.Sparkle width={11} height={11} />
                </span>
              )}
              {miembros.slice(0, 3).map((m) => (
                <span key={m.nombre} className="rounded-full border border-void">
                  <Cara nombre={m.nombre} grupo={grupo.id} foto={m.foto} lado={20} />
                </span>
              ))}
            </span>
            {miembros.length}
          </button>

          <BotonInvitar grupo={grupo} enlace={enlace} />
        </div>

        {/*
          Si es una quedada, cuándo es. Arriba y siempre a la vista: es la mitad
          de la información de una quedada, y tenerla que buscar en el chat es
          justo lo que se venía a evitar.
        */}
        {grupo.fecha && (
          <div className="mt-2.5 flex items-start gap-2.5 rounded-xl border border-pro/25 bg-pro/[0.06] px-3.5 py-2.5">
            <Icon.Calendar width={15} height={15} className="mt-0.5 shrink-0 text-pro" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium capitalize text-ink">
                {comoSeLeeLaFecha(grupo.fecha)}
              </span>
              {grupo.nota && (
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">
                  {grupo.nota}
                </span>
              )}
            </span>
          </div>
        )}

        {gente && (
          <div className="mt-2.5 rounded-xl border border-line-soft bg-panel/40 p-3">
            <div className="mb-2.5 border-b border-line-soft pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pro/15 text-pro">
                  <Icon.Sparkle width={12} height={12} />
                </span>
                <span className="min-w-0 flex-1 text-[12.5px] text-ink">ECLIPSE</span>
                <span className="text-[11.5px] text-faint">
                  {MODOS.find((m) => m.id === eclipse)?.corto}
                </span>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                {MODOS.find((m) => m.id === eclipse)?.explicacion}
              </p>

              {grupo.soyDueno && (
                <div className="mt-2 flex gap-1.5 rounded-xl border border-line-soft bg-panel p-1">
                  {MODOS.map((m) => (
                    <button
                      key={m.id}
                      disabled={cambiandoEclipse}
                      onClick={async () => {
                        if (m.id === eclipse) return;
                        // Se pinta al momento y se manda: si el servidor dijera
                        // que no, el vistazo de dentro de tres segundos lo
                        // devuelve a su sitio.
                        setEclipse(m.id);
                        setCambiandoEclipse(true);
                        await fetch("/api/grupos", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: grupo.id, accion: "eclipse", modo: m.id }),
                        }).catch(() => {});
                        setCambiandoEclipse(false);
                      }}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-[11.5px] transition ${
                        eclipse === m.id ? "bg-raised text-ink" : "text-muted hover:text-ink"
                      }`}
                    >
                      {m.corto}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ul className="space-y-1.5">
              {miembros.map((m) => (
                <li key={m.nombre} className="flex items-center gap-2 text-[12.5px] text-muted">
                  <Cara nombre={m.nombre} grupo={grupo.id} foto={m.foto} lado={24} />
                  <span className="truncate">
                    {m.nombre}
                    {m.yo && " (tú)"}
                    {m.dueno && " · creó el grupo"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 border-t border-line-soft pt-2.5 text-[11.5px] leading-relaxed text-faint">
              Nadie ve el correo de nadie: solo el nombre que cada uno eligió. Para entrar hay que
              tener cuenta en ECLIPSE, así que manda la invitación solo a quien quieras dentro.
            </p>

            {/*
              La puerta de salida, que faltaba.

              No había forma de deshacerse de un grupo: ni borrarlo quien lo
              montó ni salirse los demás. Un sitio del que no se puede salir no
              es un sitio, es una trampa.
            */}
            <button
              onClick={async () => {
                const suyo = grupo.soyDueno;
                const texto = suyo
                  ? `¿Borrar «${grupo.nombre}» para todos? Se va con sus mensajes y sus fotos, y no se puede deshacer.`
                  : `¿Salirte de «${grupo.nombre}»?`;
                if (!confirm(texto)) return;
                await fetch(`/api/grupos?id=${grupo.id}${suyo ? "&borrar=1" : ""}`, {
                  method: "DELETE",
                }).catch(() => {});
                onVolver();
              }}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2 text-[12.5px] text-faint transition hover:border-danger/40 hover:text-danger"
            >
              <Icon.Trash width={13} height={13} />
              {grupo.soyDueno ? "Borrar el grupo" : "Salirme del grupo"}
            </button>
          </div>
        )}

        <div ref={fondo} className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto py-3.5 pr-1">
          {mensajes.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-panel text-muted">
                <Icon.Group width={22} height={22} />
              </span>
              <p className="max-w-xs text-[13px] leading-relaxed text-muted">
                {eclipse === "no"
                  ? miembros.length <= 1
                    ? "De momento estás tú solo. Manda la invitación a quien quieras y hablad aquí. ECLIPSE está apagado en este grupo: lo enciendes tocando arriba en la gente."
                    : "Todavía no ha escrito nadie. ECLIPSE está apagado en este grupo."
                  : eclipse === "siempre"
                    ? miembros.length <= 1
                      ? "De momento estás tú solo. Manda la invitación a quien quieras: ECLIPSE está dentro y contesta a todo lo que escribáis."
                      : "Todavía no ha escrito nadie. ECLIPSE está dentro y contesta a todo lo que escribáis."
                    : miembros.length <= 1
                      ? "De momento estás tú solo. Manda la invitación a quien quieras y escribid aquí: ECLIPSE contesta cuando le nombréis."
                      : "Todavía no ha escrito nadie. Escribe algo y, si quieres que conteste ECLIPSE, nómbralo o pídele algo directamente."}
              </p>
              {miembros.length <= 1 && <BotonInvitar grupo={grupo} enlace={enlace} grande />}
            </div>
          )}

          {mensajes.map((m, i) => {
            /*
              Mensajes seguidos de la misma persona se agrupan: el nombre y la
              foto solo salen en el primero. Es lo que hace que una conversación
              de seis personas se pueda leer sin marearse.
            */
            const anterior = mensajes[i - 1];
            const seguido =
              anterior && anterior.nombre === m.nombre && m.cuando - anterior.cuando < 5 * 60 * 1000;

            if (m.mio)
              return (
                <div key={m.id} className={`flex justify-end ${seguido ? "-mt-1.5" : ""}`}>
                  <div className={`max-w-[80%] ${m.enCamino ? "opacity-60" : ""}`}>
                    <button
                      onClick={() => setTocado(tocado === m.id ? null : m.id)}
                      className="block w-full text-left"
                    >
                      <Foto mensaje={m} grupo={grupo.id} />
                      {m.texto && (
                        <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-tuyo-borde bg-tuyo px-3.5 py-2 text-[14px] leading-relaxed text-ink">
                          {m.texto}
                        </div>
                      )}
                    </button>
                    <span className="mt-0.5 flex items-center justify-end gap-2.5">
                      {tocado === m.id && m.borrable && (
                        <button
                          onClick={() => void borrarMensaje(m.id)}
                          className="text-[11px] text-faint transition hover:text-danger"
                        >
                          Borrar
                        </button>
                      )}
                      <span className="text-[10.5px] text-faint">{cuandoDe(m.cuando)}</span>
                    </span>
                  </div>
                </div>
              );

            return (
              <div key={m.id} className={`flex gap-2 ${seguido ? "-mt-1.5" : ""}`}>
                <span className="w-7 shrink-0">
                  {!seguido &&
                    (m.deEclipse ? (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pro/15 text-pro">
                        <Icon.Sparkle width={13} height={13} />
                      </span>
                    ) : (
                      <Cara
                        nombre={m.nombre}
                        grupo={grupo.id}
                        foto={miembros.find((x) => x.nombre === m.nombre)?.foto}
                        lado={28}
                      />
                    ))}
                </span>

                <div className="min-w-0 max-w-[80%]">
                  {!seguido && (
                    <span className="mb-0.5 flex items-baseline gap-1.5">
                      <span className={`text-[11.5px] font-medium ${m.deEclipse ? "text-pro" : "text-ink"}`}>
                        {m.nombre}
                      </span>
                      <span className="text-[10.5px] text-faint">{cuandoDe(m.cuando)}</span>
                    </span>
                  )}
                  <button
                    onClick={() => setTocado(tocado === m.id ? null : m.id)}
                    className="block w-full text-left"
                  >
                    <Foto mensaje={m} grupo={grupo.id} />
                    {m.texto && (
                      <div
                        className={`whitespace-pre-wrap break-words rounded-2xl rounded-tl-md px-3.5 py-2 text-[14px] leading-relaxed text-ink ${
                          m.deEclipse ? "border border-pro/20 bg-pro/[0.06]" : "bg-panel"
                        }`}
                      >
                        {m.texto}
                      </div>
                    )}
                  </button>
                  {tocado === m.id && m.borrable && (
                    <button
                      onClick={() => void borrarMensaje(m.id)}
                      className="mt-0.5 text-[11px] text-faint transition hover:text-danger"
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/*
            Que se vea que está escribiendo.

            Antes no había nada: mandabas algo y la pantalla se quedaba quieta
            medio minuto sin decir si iba a contestar. Esto es la diferencia
            entre "está pensando" y "esto no funciona".
          */}
          {pensando && (
            <div className="flex gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pro/15 text-pro">
                <Icon.Sparkle width={13} height={13} />
              </span>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-panel px-3.5 py-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-faint"
                    style={{ animationDelay: `${i * 160}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {aviso && <p className="pt-1 text-[12px] leading-relaxed text-danger">{aviso}</p>}

        <div className="flex gap-2 border-t border-line-soft pt-3">
          <button
            onClick={() => foto.current?.click()}
            disabled={subiendo}
            aria-label="Mandar una foto"
            className="shrink-0 rounded-xl border border-line px-3 text-muted transition hover:text-ink disabled:opacity-50"
          >
            <Icon.Image width={17} height={17} />
          </button>
          <input
            ref={foto}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setSubiendo(true);
              setAviso(null);
              try {
                enviar(await encogerFoto(f));
              } catch (err) {
                setAviso(err instanceof Error ? err.message : "No se ha podido usar esa foto.");
              } finally {
                setSubiendo(false);
              }
            }}
          />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviar()}
            placeholder={
              eclipse === "siempre"
                ? "Escribe al grupo. ECLIPSE contesta a todo."
                : eclipse === "no"
                  ? "Escribe al grupo."
                  : "Escribe al grupo. Di «ECLIPSE» para que conteste."
            }
            className="min-w-0 flex-1 rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
          />
          <button
            onClick={() => enviar()}
            disabled={!texto.trim()}
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
