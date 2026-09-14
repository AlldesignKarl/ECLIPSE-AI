"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Composer from "./Composer";
import EclipseLogo from "./EclipseLogo";
import * as Icon from "./Icons";
import MessageItem from "./MessageItem";
import Pasos from "./Pasos";
import SettingsDialog, {
  EMPTY_KEY_SOURCES,
  type Capabilities,
  type Engine,
  type KeySources,
} from "./SettingsDialog";
import Sidebar from "./Sidebar";
import ThinkingBar from "./ThinkingBar";
import UpgradeDialog, { type Billing } from "./UpgradeDialog";
import ConexionesDialog from "./ConexionesDialog";
import ProgramarDialog from "./ProgramarDialog";
import BibliotecaDialog from "./BibliotecaDialog";
import Llamada from "./Llamada";
import GruposDialog from "./GruposDialog";
import Welcome from "./Welcome";
import { encodedSize, FileTooLarge, MAX_TOTAL_ENCODED, toAttachment } from "@/lib/files";
import {
  aligerarHistorial,
  archivosEjecutables,
  extractFiles,
  leerConversion,
  pegarContinuacion,
  leerRetoque,
  projectName,
} from "@/lib/project";
import { crearRitmo, type Ritmo } from "@/lib/ritmo";
import { readSSE } from "@/lib/sse";
import {
  clearEnCurso,
  DEFAULT_PREFS,
  emptyConversation,
  loadConversations,
  loadEnCurso,
  loadPrefs,
  makeMessage,
  saveConversations,
  saveEnCurso,
  savePrefs,
  type Prefs,
} from "@/lib/storage";
import type {
  Artifact,
  Attachment,
  Conversation,
  Message,
  Mode,
  Paso,
  Plan,
  Source,
  Status,
} from "@/lib/types";
import { modoVigente } from "@/lib/types";

const EMPTY_CAPS: Capabilities = {
  chat: true,
  image: false,
  proCodeConfigured: false,
};

/** La descripción de la última imagen creada en esta conversación, si la hay. */
function ultimaImagen(messages: Message[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const imagen = messages[i].artifacts?.find((a) => a.type === "image" && a.prompt);
    if (imagen?.prompt) return imagen.prompt;
  }
  return undefined;
}

interface ChatAppProps {
  /** Correo de quien ha entrado, o null si la app va sin cuentas. */
  user?: string | null;
  /** Cómo quiere que le llamen. Lo eligió al crear la cuenta. */
  nombre?: string;
  onNombre?: (nombre: string) => void;
  onSignOut?: () => void;
  /** Volver a la portada, la que explica qué es la aplicación. */
  onInicio?: () => void;
}

export default function ChatApp({
  user = null,
  nombre = "",
  onNombre,
  onSignOut,
  onInicio,
}: ChatAppProps) {
  /* ------------------------------ Estado ------------------------------ */
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [mode, setMode] = useState<Mode>("chat");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  const [status, setStatus] = useState<Status>("idle");
  const [stream, setStream] = useState<{ text: string; thinking: string }>({
    text: "",
    thinking: "",
  });

  const [plan, setPlan] = useState<Plan>("free");
  const [conexionesOpen, setConexionesOpen] = useState(false);
  const [programarOpen, setProgramarOpen] = useState(false);
  const [bibliotecaOpen, setBibliotecaOpen] = useState(false);
  const [llamando, setLlamando] = useState(false);
  const [gruposOpen, setGruposOpen] = useState(false);

  // Y si la dirección trae una invitación, se abre Grupos solo: el enlace
  // tiene que llevar a donde lleva, sin que nadie busque nada.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("grupo")) setGruposOpen(true);
    } catch {
      /* da igual */
    }
  }, []);
  /** Si hay encargos hechos que todavía no ha visto nadie. */
  const [tareasNuevas, setTareasNuevas] = useState(false);
  const [proRegalado, setProRegalado] = useState(false);
  const [caps, setCaps] = useState<Capabilities>(EMPTY_CAPS);
  const [providerLabel, setProviderLabel] = useState("comprobando…");
  const [billing, setBilling] = useState<Billing>({ enabled: false, price: "10,00 €" });
  const [keySources, setKeySources] = useState<KeySources>(EMPTY_KEY_SOURCES);
  const [engine, setEngine] = useState<Engine | null>(null);
  /** El motor elegido para ECLIPSE CODE, si hay uno distinto al del chat. */
  const [engineCode, setEngineCode] = useState<Engine | null>(null);

  const [sidebar, setSidebar] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  /**
   * Cuántas peticiones le quedan hoy, según lo último que dijo el servidor.
   * `null` mientras no se sepa: no se avisa de lo que no se ha medido.
   */
  const [restantes, setRestantes] = useState<number | null>(null);
  /** Las herramientas que está usando ahora mismo, para enseñarlas al vuelo. */
  const [pasosVivos, setPasosVivos] = useState<Paso[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef({ text: "", thinking: "" });
  const rafRef = useRef<number | null>(null);
  /*
    El ritmo al que APARECE la respuesta, que no es al que llega.

    Llega a borbotones —a veces un párrafo entero de una vez— y pintarlo tal
    cual se lee mal y se lee como si no hubiera pensado nada. Se guarda entero
    según llega y se enseña a un ritmo propio; lo de abajo solo decide cuánto
    de lo guardado se ve ya.
  */
  const ritmoRef = useRef<Ritmo | null>(null);
  /** Si la conversación de ahora no se guarda. Se mira desde sitios sin estado. */
  const temporalRef = useRef(false);
  const terminadoRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const busy = status !== "idle";
  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  // Para poder mirarlo desde sitios que no ven el estado de React.
  useEffect(() => {
    temporalRef.current = Boolean(active?.temporal);
  }, [active]);

  /* --------------------------- Carga inicial --------------------------- */
  useEffect(() => {
    const stored = loadConversations();

    // Una respuesta que se quedó a medias porque el móvil descartó la página:
    // se recupera y se cuenta lo que pasó, en vez de desaparecer sin más.
    // No se borra aquí: este efecto puede ejecutarse dos veces, y la segunda
    // se quedaría sin nada que recuperar. Se borra al empezar la siguiente
    // respuesta, y mientras tanto volver a aplicarlo no duplica nada.
    const aMedias = loadEnCurso();
    if (aMedias) {
      const destino = stored.find((c) => c.id === aMedias.conversationId);
      const yaEstaba = destino?.messages.some(
        (m) => m.role === "assistant" && m.content === aMedias.content,
      );
      if (destino && !yaEstaba) {
        destino.messages = [
          ...destino.messages,
          makeMessage("assistant", aMedias.content, {
            thinking: aMedias.thinking,
            mode: aMedias.mode,
            error:
              "La respuesta se cortó al salir de la aplicación. Esto es lo que había escrito; pulsa Reintentar para pedirla entera.",
            createdAt: aMedias.at,
          }),
        ];
      }
    }

    setConversations(stored);
    // Al entrar se empieza de cero. Lo anterior sigue guardado y está a un
    // toque en el menú, pero abrir a medias la conversación de ayer obliga a
    // buscar el botón de nueva antes de poder preguntar nada.
    setActiveId(null);
    setPrefs(loadPrefs());
    setHydrated(true);

    /*
      ¿Hay encargos hechos que no ha visto nadie?

      Solo para encender el punto del menú. Es una consulta barata y sin
      `aldia`, así que no dispara ninguna tarea: abrir la aplicación no puede
      costar una llamada al motor por sistema.
    */
    void fetch("/api/tareas")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { resultados?: { nueva?: boolean }[] } | null) => {
        setTareasNuevas(Boolean(d?.resultados?.some((x) => x.nueva)));
      })
      .catch(() => {});

    void fetch("/api/pro")
      .then((r) => r.json())
      .then(
        (d: {
          plan?: Plan;
          proRegalado?: boolean;
          capabilities?: Capabilities;
          providerLabel?: string;
          billing?: Billing;
          keySources?: KeySources;
          engine?: Engine | null;
          engineCode?: Engine | null;
        }) => {
          if (d.plan) setPlan(d.plan);
          setProRegalado(Boolean(d.proRegalado));
          if (d.capabilities) setCaps(d.capabilities);
          if (d.providerLabel) setProviderLabel(d.providerLabel);
          if (d.billing) setBilling(d.billing);
          if (d.keySources) setKeySources(d.keySources);
          setEngine(d.engine ?? null);
          setEngineCode(d.engineCode ?? null);
        },
      )
      .catch(() => {});


    const params = new URLSearchParams(window.location.search);

    // Vuelta desde el pago de Stripe: confirmamos contra el servidor.
    const paid = params.get("pago");
    const sessionId = params.get("session_id");
    if (paid === "ok" && sessionId) {
      window.history.replaceState({}, "", "/");
      setNotice("Confirmando el pago…");
      void fetch("/api/billing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then((r) => r.json())
        .then((d: { plan?: Plan; error?: string }) => {
          if (d.plan === "pro") {
            setPlan("pro");
            setNotice("Suscripción activa. Ya tienes el plan Pro.");
          } else {
            setNotice(d.error ?? "No se ha podido confirmar el pago.");
          }
        })
        .catch(() => setNotice("No se ha podido confirmar el pago."));
    } else if (paid === "cancelado") {
      window.history.replaceState({}, "", "/");
      setNotice("Has salido del pago. No se ha cobrado nada.");
    }
  }, []);

  useEffect(() => {
    if (hydrated) saveConversations(conversations);
  }, [conversations, hydrated]);

  useEffect(() => {
    if (hydrated) savePrefs(prefs);
  }, [prefs, hydrated]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(id);
  }, [notice]);

  /* ------------------------------ Scroll ------------------------------ */
  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const messageCount = active?.messages.length ?? 0;

  useEffect(() => {
    // En la pantalla de bienvenida no bajamos: se vería el logo cortado.
    if (stickToBottom.current && messageCount > 0) scrollToBottom();
  }, [stream, messageCount, status, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  /* --------------------------- Conversaciones -------------------------- */
  const upsert = useCallback((id: string, update: (c: Conversation) => Conversation) => {
    setConversations((list) =>
      list.map((c) => (c.id === id ? { ...update(c), updatedAt: Date.now() } : c)),
    );
  }, []);

  const newConversation = useCallback(
    (nuevoModo: Mode = "chat", temporal = false) => {
      if (busy) return;
      const fresh = emptyConversation();
      // El título se pone ya: una conversación de CODE se reconoce en la lista
      // sin tener que abrirla.
      fresh.mode = nuevoModo;
      if (nuevoModo === "code") fresh.title = "ECLIPSE CODE";
      if (temporal) {
        fresh.temporal = true;
        fresh.title = "Chat temporal";
      }
      setConversations((list) => [fresh, ...list]);
      setActiveId(fresh.id);
      setInput("");
      setAttachments([]);
      setMode(nuevoModo);
      return fresh;
    },
    [busy],
  );

  const deleteConversation = (id: string) => {
    setConversations((list) => {
      const next = list.filter((c) => c.id !== id);
      if (id === activeId) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  /**
   * Al cambiar de aplicación, el móvil congela la página y a veces la descarta
   * para liberar memoria: la respuesta a medio llegar se perdía entera. Se va
   * guardando cada poco —no en cada letra, que sería escribir en disco cien
   * veces por segundo— para que al volver siga ahí.
   */
  const guardadoRef = useRef(0);

  const guardarEnCurso = useCallback(
    (conversationId: string, currentMode: Mode, forzar = false) => {
      const ahora = Date.now();
      if (!forzar && ahora - guardadoRef.current < 1200) return;
      guardadoRef.current = ahora;

      const { text, thinking } = bufferRef.current;
      if (!text.trim()) return;

      /*
        En una conversación temporal, tampoco esto.

        Lo que se guarda aquí es la respuesta a medias, para que no se pierda si
        el móvil descarta la página. Pero se guarda en el mismo disco, y una
        promesa de "esto no se guarda" que deja la mitad escrita no es una
        promesa. Se acepta el riesgo de perder una respuesta a medias: es lo que
        se está pidiendo.
      */
      if (temporalRef.current) return;

      saveEnCurso({ conversationId, content: text, thinking, mode: currentMode, at: ahora });
    },
    [],
  );

  const flushStream = useCallback(() => {
    rafRef.current = null;

    const { text, thinking } = bufferRef.current;
    const ritmo = ritmoRef.current;

    // Sin ritmo —al parar, al fallar— se enseña entero y punto.
    if (!ritmo) {
      setStream({ text, thinking });
      return;
    }

    const hasta = ritmo.visibles(performance.now(), text.length, terminadoRef.current);
    setStream({ text: text.slice(0, hasta), thinking });

    // Mientras quede texto por enseñar hay que seguir pintando, aunque no
    // llegue nada nuevo del motor: es justo cuando llega de golpe.
    if (ritmo.pendiente(text.length)) {
      rafRef.current = requestAnimationFrame(flushStream);
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(flushStream);
  }, [flushStream]);

  /**
   * Esperar a que termine de escribirse lo que ya ha llegado.
   *
   * El motor termina antes que la pantalla, y el mensaje definitivo no puede
   * aparecer mientras todavía se está escribiendo el provisional: sería un
   * salto del texto a medias al texto entero. Con un tope, porque ninguna
   * animación puede dejar a nadie esperando.
   */
  const terminarDeEscribir = useCallback(
    () =>
      new Promise<void>((listo) => {
        const ritmo = ritmoRef.current;
        if (!ritmo || !ritmo.pendiente(bufferRef.current.text.length)) return listo();

        terminadoRef.current = true;
        const limite = performance.now() + 4000;

        const mirar = () => {
          const total = bufferRef.current.text.length;
          if (!ritmo.pendiente(total) || performance.now() > limite) {
            ritmo.todo(total);
            setStream({ ...bufferRef.current });
            return listo();
          }
          scheduleFlush();
          requestAnimationFrame(mirar);
        };
        mirar();
      }),
    [scheduleFlush],
  );

  /* ------------------------------- Título ------------------------------ */
  /**
   * El título sale del propio mensaje, sin pedírselo a la IA. Antes gastaba
   * una petición por conversación, y en la capa gratuita de Google cada
   * petición cuenta: dos por mensaje agotaban el cupo por minuto enseguida.
   */
  const nameConversation = useCallback(
    (id: string, text: string) => {
      const clean = text.replace(/\s+/g, " ").trim();
      if (!clean) return;

      let title = clean.slice(0, 48);
      if (clean.length > 48) {
        const cut = title.lastIndexOf(" ");
        title = (cut > 20 ? title.slice(0, cut) : title) + "…";
      }
      upsert(id, (c) => ({ ...c, title: title[0].toUpperCase() + title.slice(1) }));
    },
    [upsert],
  );

  /* ------------------------------- Envío ------------------------------- */
  /**
   * Pide la versión retocada de una imagen que adjuntó el usuario y la cuelga
   * del mensaje que ya está en pantalla.
   *
   * Si falla, se queda la explicación sin imagen y se dice por qué: haber
   * contado qué mejorarías sigue valiendo aunque el retoque no salga.
   */
  /**
   * Pasar la imagen a otro formato, aquí en el móvil.
   *
   * No pasa por el servidor a propósito: es una operación exacta, va
   * instantánea, no gasta cupo de nada y la imagen no sale del teléfono.
   */
  const convertir = useCallback(
    async (conversationId: string, messageId: string, original: Attachment, formato: string) => {
      const { convertirImagen, leerFormato, nombreDe } = await import("@/lib/convertir");
      const destino = leerFormato(formato);
      if (!destino || !original.data) return;

      const ponerNota = (nota: string) =>
        upsert(conversationId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId ? { ...m, content: `${m.content}\n\n_(${nota})_` } : m,
          ),
        }));

      try {
        const hecha = await convertirImagen(
          { data: original.data, mime: original.mime, name: original.name },
          destino,
        );

        upsert(conversationId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  artifacts: [
                    ...(m.artifacts ?? []),
                    {
                      type: "file" as const,
                      url: hecha.dataUrl,
                      title: hecha.nombre,
                      mime: hecha.mime,
                    },
                  ],
                }
              : m,
          ),
        }));
      } catch {
        ponerNota(`No he podido pasarla a ${nombreDe(destino)} en este dispositivo.`);
      }
    },
    [upsert],
  );

  const retocar = useCallback(
    async (conversationId: string, messageId: string, original: Attachment, encargo: string) => {
      setStatus("retocando_imagen");
      try {
        const res = await fetch("/api/image/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagen: original.data, prompt: encargo }),
        });
        const data = (await res.json()) as { dataUrl?: string; error?: string };
        if (!res.ok || !data.dataUrl) throw new Error(data.error ?? "No se ha podido retocar.");

        upsert(conversationId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId
              ? { ...m, artifacts: [...(m.artifacts ?? []), { type: "image" as const, url: data.dataUrl!, prompt: encargo }] }
              : m,
          ),
        }));
      } catch (err) {
        const motivo = err instanceof Error ? err.message : "No se ha podido retocar la imagen.";
        upsert(conversationId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId ? { ...m, content: `${m.content}\n\n_(No he podido dejarte la versión retocada: ${motivo})_` } : m,
          ),
        }));
      }
    },
    [upsert],
  );

  /** Lo que se le dice para que termine lo que dejó a medias. */
  const PIDE_SEGUIR =
    "Continúa exactamente donde se cortó tu respuesta anterior, sin repetir nada " +
    "y sin reabrir el bloque de código, hasta terminar el archivo.";

  const runChatRef = useRef<
    ((c: string, h: Message[], m: Mode, d?: string, v?: number) => Promise<void>) | null
  >(null);

  const runChat = useCallback(
    async (
      conversationId: string,
      history: Message[],
      currentMode: Mode,
      /*
        El id del mensaje que hay que TERMINAR, si esto es una continuación.

        Sin esto, "que siga" era un mensaje más: el modelo empezaba de cero,
        volvía a quedarse sin espacio por el mismo sitio y quedaban dos medias
        respuestas en vez de una entera. Con esto, lo que escriba se cose al
        final del mensaje cortado y el archivo sale completo donde estaba.
      */
      continuarDe?: string,
      /** Cuántas veces se ha continuado ya sola. Para no encadenarlo sin fin. */
      vuelta = 0,
    ) => {
      const controller = new AbortController();
      abortRef.current = controller;
      bufferRef.current = { text: "", thinking: "" };
      /*
        Un ritmo nuevo por respuesta.

        En ECLIPSE CODE el techo sube: ahí lo que se escribe son archivos, y
        verlos teclearse línea a línea no aporta nada —lo que se mira es la
        vista previa y el ZIP—, así que se pinta con ritmo pero sin hacer
        esperar.
      */
      ritmoRef.current = crearRitmo(
        performance.now(),
        currentMode === "code" ? { techo: 900, techoFinal: 6000 } : {},
      );
      terminadoRef.current = false;
      guardadoRef.current = 0;
      clearEnCurso();
      setStream({ text: "", thinking: "" });
      setStatus("conectando");

      // Irse a otra aplicación es el momento exacto en que se pierde todo.
      const alOcultarse = () => {
        if (document.visibilityState === "hidden") guardarEnCurso(conversationId, currentMode, true);
      };
      document.addEventListener("visibilitychange", alOcultarse);

      let sources: Source[] = [];
      let elapsedMs: number | undefined;
      let modelo: string | undefined;
      let cortado = false;
      const pasos: Paso[] = [];
      const archivos: Artifact[] = [];
      setPasosVivos([]);
      let failure: string | undefined;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            mode: currentMode,
            speed: prefs.speed,
            deepSearch: prefs.deepSearch,
            // Continuar va con instrucciones mínimas: lo que no se manda en
            // instrucciones queda libre para terminar el archivo.
            continuar: Boolean(continuarDe),
            // Sin adelgazar, cada archivo generado se vuelve a mandar entero
            // en todos los mensajes siguientes y la conversación choca con el
            // límite por minuto del proveedor.
            messages: aligerarHistorial(
              history.map((m) => ({
                role: m.role,
                content: m.content,
                attachments: m.attachments?.filter((a) => a.data),
              })),
            ),
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
          if (data.code === "pro_required") setUpgradeOpen(true);
          if (data.code === "no_key") setSettingsOpen(true);
          // Sin cupo en el plan Gratis, la salida es mejorar de plan: se le
          // enseña delante en vez de dejarle el aviso y que lo busque.
          if (data.code === "sin_cupo" && plan === "free") setUpgradeOpen(true);
          throw new Error(data.error ?? `Error ${res.status}`);
        }

        const queda = res.headers.get("X-Eclipse-Restantes");
        if (queda !== null) setRestantes(Number(queda));

        await readSSE(
          res,
          (event) => {
            switch (event.t) {
              case "status":
                setStatus(event.v as Status);
                break;
              case "text":
                bufferRef.current.text += event.v;
                scheduleFlush();
                guardarEnCurso(conversationId, currentMode);
                break;
              case "thinking":
                bufferRef.current.thinking += event.v;
                scheduleFlush();
                break;
              case "sources":
                sources = event.v as Source[];
                break;
              case "tool": {
                const v = event.v as { nombre: string; detalle: string };
                pasos.push({ nombre: v.nombre, detalle: v.detalle });
                setPasosVivos([...pasos]);
                break;
              }
              case "tool_done": {
                const v = event.v as { nombre: string; ok: boolean; detalle: string };
                // Se cierra el último paso abierto de esa herramienta, no el
                // primero: con dos búsquedas seguidas se marcaría la que no es.
                for (let i = pasos.length - 1; i >= 0; i--) {
                  if (pasos[i].nombre === v.nombre && pasos[i].ok === undefined) {
                    pasos[i] = { ...pasos[i], ok: v.ok, detalle: v.detalle || pasos[i].detalle };
                    break;
                  }
                }
                setPasosVivos([...pasos]);
                break;
              }
              case "artifact": {
                const v = event.v as { url: string; prompt: string };
                archivos.push({ type: "image", url: v.url, prompt: v.prompt });
                break;
              }
              case "file": {
                const v = event.v as { nombre: string; mime: string; contenido: string };
                archivos.push({
                  type: "file",
                  title: v.nombre,
                  mime: v.mime,
                  // Se guarda como data URL para que la descarga funcione sin
                  // servidor, igual que las imágenes generadas.
                  url: `data:${v.mime};base64,${btoa(unescape(encodeURIComponent(v.contenido)))}`,
                });
                break;
              }
              case "error":
                failure = event.v;
                break;
              case "meta": {
                const v = event.v as { modelo?: string; cortado?: boolean };
                if (v.modelo) modelo = v.modelo;
                if (v.cortado) cortado = true;
                break;
              }
              case "done":
                elapsedMs = (event.v.elapsedMs as number) ?? undefined;
                break;
            }
          },
          controller.signal,
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const crudo = err instanceof Error ? err.message : "";
          /*
            Lo que dice el navegador cuando se corta la conexión no le sirve a
            nadie: "network error" o "Failed to fetch", y en inglés. Suele pasar
            al cambiar de wifi a datos, al bloquearse el móvil un rato o cuando
            una respuesta muy larga tarda más de lo que el servidor aguanta.
          */
          failure = /network|failed to fetch|load failed|networkerror/i.test(crudo)
            ? "Se ha cortado la conexión antes de terminar la respuesta. Suele pasar al cambiar de wifi a datos o con respuestas muy largas. Dale a Reintentar."
            : crudo || "Error inesperado.";
        }
      }

      /*
        Que termine de escribirse lo que ya ha llegado, antes de cerrar.

        El mensaje definitivo sustituye al que se está escribiendo, así que
        soltarlo aquí sin más daría un salto del texto a medias al texto
        entero. Salvo que el usuario haya parado o haya fallado algo: ahí lo
        que toca es enseñar ya lo que hay y no hacerle esperar por una
        animación.
      */
      if (controller.signal.aborted || failure) {
        ritmoRef.current?.todo(bufferRef.current.text.length);
        setStream({ ...bufferRef.current });
      } else {
        await terminarDeEscribir();
      }

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      ritmoRef.current = null;

      const thinking = bufferRef.current.thinking;
      // La marca de retoque no se le enseña a nadie: es un encargo para el
      // motor de imagen, y el texto tiene que leerse igual sin ella.
      // La conversión primero: las dos marcas van al final, y si se pide
      // retocar Y convertir, la de convertir es la última. Al revés, quitar la
      // de retocar no encontraría nada y las dos se quedarían sin leer.
      const { limpio: sinConvertir, formato } = leerConversion(bufferRef.current.text);
      const { limpio: text, encargo } = leerRetoque(sinConvertir);
      const files = currentMode === "code" ? extractFiles(text) : archivosEjecutables(text);

      const reply = makeMessage("assistant", text, {
        thinking: thinking || undefined,
        sources: sources.length ? sources : undefined,
        error: failure,
        elapsedMs,
        mode: currentMode,
        modelo,
        cortado: cortado || undefined,
        pasos: pasos.length ? pasos : undefined,
        artifacts:
          files.length || archivos.length
            ? [
                ...(files.length
                  ? [
                      {
                        type: "code" as const,
                        files,
                        title: projectName(history.at(-1)?.content ?? "proyecto"),
                      },
                    ]
                  : []),
                ...archivos,
              ]
            : undefined,
      });

      document.removeEventListener("visibilitychange", alOcultarse);
      clearEnCurso();

      // Si la continuación falló sin escribir nada, el mensaje se queda como
      // estaba: cortado, con su botón. Pintar un error encima sería peor.
      if (continuarDe && failure && !text.trim()) {
        setStream({ text: "", thinking: "" });
        setPasosVivos([]);
        setStatus("idle");
        abortRef.current = null;
        return;
      }

      if (continuarDe) {
        upsert(conversationId, (c) => ({
          ...c,
          messages: c.messages.map((m) => {
            if (m.id !== continuarDe) return m;

            const entero = pegarContinuacion(m.content, text);
            const trozos = currentMode === "code" ? extractFiles(entero) : archivosEjecutables(entero);

            return {
              ...m,
              content: entero,
              cortado: cortado || undefined,
              error: failure,
              // Los archivos se rehacen sobre el texto ya cosido: es lo que
              // convierte las dos mitades en un proyecto entero.
              artifacts: trozos.length
                ? [
                    {
                      type: "code" as const,
                      files: trozos,
                      title:
                        m.artifacts?.find((a) => a.type === "code")?.title ?? "proyecto",
                    },
                    ...(m.artifacts ?? []).filter((a) => a.type !== "code"),
                  ]
                : m.artifacts,
            };
          }),
        }));
      } else {
        upsert(conversationId, (c) => ({ ...c, messages: [...c.messages, reply] }));
      }
      setStream({ text: "", thinking: "" });
      setPasosVivos([]);

      // La explicación ya está a la vista; la imagen retocada llega detrás, que
      // tarda lo suyo. Al revés se quedaría la pantalla en blanco esperando.
      // La foto más reciente de la conversación, no solo la del último mensaje:
      // se manda una foto, se habla de ella y después se pide el retoque sin
      // volver a adjuntarla.
      const original = [...history]
        .reverse()
        .flatMap((m) => (m.role === "user" ? (m.attachments ?? []) : []))
        .find((a) => a.kind === "image" && a.data);
      if (encargo && original && !failure)
        await retocar(conversationId, reply.id, original, encargo);

      /*
        La conversión se decide aquí, no en el modelo.

        Pasar una imagen a PNG o a PDF no necesita entender nada: es una orden
        con una respuesta única. Dejársela al modelo era lo que hacía que a la
        primera contestara "no puedo" y a la segunda sí, según le diera por
        escribir la marca. Así que se mira lo que ha pedido el usuario y se
        hace; la marca del modelo se queda como segundo camino, por si lo pide
        de una forma que aquí no se reconozca.
      */
      const { formatoPedido } = await import("@/lib/convertir");
      const pedido = formato ?? formatoPedido(history.at(-1)?.content ?? "");

      if (pedido && original && !failure)
        await convertir(conversationId, reply.id, original, pedido);

      /*
        Se ha quedado a medias: se sigue solo, sin que haya que pedirlo.

        El botón de "que siga" funciona, pero tener que pulsarlo es un fallo de
        la aplicación asomando: lo que se pidió fue un archivo entero. Así que
        se continúa aquí mismo, con las instrucciones mínimas, y el usuario ve
        el archivo completarse. Como mucho dos veces seguidas: si a la tercera
        sigue sin caber, se deja el botón y que decida él.
      */
      const quedaCortado = cortado && !failure;
      const aQuienTerminar = continuarDe ?? reply.id;
      const yaEscrito = continuarDe ? undefined : reply;

      if (quedaCortado && vuelta < 2) {
        const peticion = makeMessage("user", PIDE_SEGUIR);
        const base = yaEscrito ? [...history, yaEscrito] : history;
        await runChatRef.current?.(
          conversationId,
          [...base, peticion],
          currentMode,
          aQuienTerminar,
          vuelta + 1,
        );
        return;
      }

      setStatus("idle");
      abortRef.current = null;
    },
    [convertir, plan, prefs.speed, prefs.deepSearch, retocar, scheduleFlush, terminarDeEscribir, upsert],
  );

  runChatRef.current = runChat;

  const runImage = useCallback(
    /**
     * `anterior` es la descripción de la última imagen de esta conversación. Sin
     * ella, un «cámbiala, más profesional» llega al modelo de imagen a secas y
     * dibuja cualquier cosa, porque un modelo de imagen no recuerda nada.
     */
    async (conversationId: string, prompt: string, anterior?: string) => {
      setStatus("generando_imagen");
      try {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, anterior }),
        });
        const data = (await res.json()) as {
          dataUrl?: string;
          note?: string;
          error?: string;
          prompt?: string;
          restantes?: number;
        };
        if (typeof data.restantes === "number") setRestantes(data.restantes);
        if (!res.ok || !data.dataUrl) throw new Error(data.error ?? "No se pudo crear la imagen.");

        upsert(conversationId, (c) => ({
          ...c,
          messages: [
            ...c.messages,
            makeMessage("assistant", data.note?.trim() || "Aquí tienes la imagen.", {
              // Se guarda la descripción con la que se dibujó de verdad, no la
              // frase original: es la que sirve de punto de partida al retocar.
              artifacts: [{ type: "image", url: data.dataUrl, prompt: data.prompt || prompt }],
            }),
          ],
        }));
      } catch (err) {
        upsert(conversationId, (c) => ({
          ...c,
          messages: [
            ...c.messages,
            makeMessage("assistant", "", {
              error: err instanceof Error ? err.message : "No se pudo crear la imagen.",
            }),
          ],
        }));
      } finally {
        setStatus("idle");
      }
    },
    [upsert],
  );

  /**
   * Terminar una respuesta que se quedó a medias.
   *
   * No es un mensaje nuevo: la petición de seguir no se guarda en la
   * conversación ni se le enseña a nadie, y lo que escriba se cose al final del
   * mensaje cortado. Para el usuario es el mismo mensaje, que se completa.
   */
  const continuar = useCallback(
    async (messageId: string) => {
      if (busy || !active) return;

      const hasta = active.messages.findIndex((m) => m.id === messageId);
      if (hasta === -1) return;

      const peticion = makeMessage("user", PIDE_SEGUIR);

      stickToBottom.current = true;
      await runChat(
        active.id,
        [...active.messages.slice(0, hasta + 1), peticion],
        active.messages[hasta].mode ?? mode,
        messageId,
      );
    },
    [active, busy, mode, runChat],
  );

  const send = useCallback(
    async (overrideText?: string, overrideMode?: Mode) => {
      const text = (overrideText ?? input).trim();
      const currentMode = overrideMode ?? mode;
      if (busy || (!text && attachments.length === 0)) return;

      let conversation = active;
      if (!conversation) {
        conversation = emptyConversation();
        setConversations((list) => [conversation as Conversation, ...list]);
        setActiveId(conversation.id);
      }
      const id = conversation.id;

      const userMessage = makeMessage("user", text, {
        attachments: attachments.length ? attachments : undefined,
      });
      const history = [...conversation.messages, userMessage];

      upsert(id, (c) => ({ ...c, messages: [...c.messages, userMessage] }));
      setInput("");
      setAttachments([]);
      stickToBottom.current = true;

      if (conversation.messages.length === 0 && text) nameConversation(id, text);

      await runChat(id, history, currentMode);
    },
    [
      input,
      mode,
      busy,
      attachments,
      active,
      upsert,
      nameConversation,
      runImage,
      runChat,
    ],
  );

  const retry = useCallback(() => {
    if (!active || busy) return;
    const messages = [...active.messages];
    while (messages.length && messages.at(-1)?.role === "assistant") messages.pop();
    if (messages.length === 0) return;
    upsert(active.id, (c) => ({ ...c, messages }));
    void runChat(active.id, messages, mode);
  }, [active, busy, mode, runChat, upsert]);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  };

  /* ----------------------------- Adjuntos ----------------------------- */
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const accepted: Attachment[] = [];
    let rejected = 0;

    for (const file of Array.from(files).slice(0, 6)) {
      try {
        const attachment = await toAttachment(file);
        // No dejamos que el conjunto supere lo que aguanta una petición.
        if (encodedSize([...attachments, ...accepted, attachment]) > MAX_TOTAL_ENCODED) {
          rejected++;
          continue;
        }
        accepted.push(attachment);
      } catch (err) {
        setNotice(err instanceof FileTooLarge ? err.message : `No se pudo leer "${file.name}".`);
      }
    }

    if (rejected > 0)
      setNotice(
        "Los archivos juntos ocupan demasiado. Envíalos en varios mensajes y los leo igual.",
      );
    if (accepted.length) setAttachments((list) => [...list, ...accepted].slice(0, 8));
  };

  /* ------------------------------ Render ------------------------------ */
  const streamingMessage: Message | null =
    busy && (stream.text || stream.thinking)
      ? {
          id: "streaming",
          role: "assistant",
          content: stream.text,
          thinking: stream.thinking || undefined,
          createdAt: Date.now(),
          mode,
        }
      : null;

  return (
    <div className="flex h-dvh overflow-hidden bg-void">
      <Sidebar
        open={sidebar}
        onClose={() => setSidebar(false)}
        conversations={conversations}
        activeId={activeId}
        plan={plan}
        onSelect={(id) => {
          setActiveId(id);
          // El modo viaja con la conversación: abrir una de CODE y que
          // contestase como un chat normal sería desconcertante.
          const elegida = conversations.find((c) => c.id === id);
          setMode(modoVigente(elegida?.mode ?? elegida?.messages.at(-1)?.mode));
        }}
        onNew={() => newConversation("chat")}
        onTemporal={() => newConversation("chat", true)}
        onCode={() => {
          if (plan !== "pro") return setUpgradeOpen(true);
          newConversation("code");
        }}
        onDelete={deleteConversation}
        onRename={(id, title) => upsert(id, (c) => ({ ...c, title }))}
        onUpgrade={() => setUpgradeOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onConexiones={() => setConexionesOpen(true)}
        onProgramar={() => setProgramarOpen(true)}
        onBiblioteca={() => setBibliotecaOpen(true)}
        onGrupos={() => setGruposOpen(true)}
        tareasNuevas={tareasNuevas}
        onInicio={() => {
          setSidebar(false);
          onInicio?.();
        }}
        user={user}
        onSignOut={async () => {
          await fetch("/api/auth", { method: "DELETE" }).catch(() => {});
          setSidebar(false);
          onSignOut?.();
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="flex items-center gap-2 border-b border-line-soft px-3 py-2.5 sm:px-4">
          <button
            onClick={() => setSidebar(true)}
            className="rounded-lg p-2 text-muted transition hover:bg-panel hover:text-ink lg:hidden"
            aria-label="Abrir menú"
          >
            <Icon.Menu />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <EclipseLogo size={22} className="shrink-0 lg:hidden" />
            <span className="truncate text-[13.5px] text-muted">
              {active?.title ?? "Nueva conversación"}
            </span>
            {/*
              Que se vea SIEMPRE que esta conversación no se guarda.

              Una promesa que solo se dice al empezar se olvida a los tres
              mensajes, y entonces o no te fías o escribes cosas creyendo que se
              guardan. La etiqueta va en la cabecera, encima de todo, mientras
              dure.
            */}
            {active?.temporal && (
              <span className="flex shrink-0 items-center gap-1 rounded-md bg-panel px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-faint">
                <Icon.Ghost width={11} height={11} />
                No se guarda
              </span>
            )}
          </div>

          {/*
            Llamar, en la cabecera y no escondido en el menú: es lo que se busca
            cuando se tienen las manos ocupadas, y entonces no se va a rebuscar.
          */}
          <button
            onClick={() => setLlamando(true)}
            aria-label="Llamar a ECLIPSE"
            className="rounded-lg p-2 text-muted transition hover:bg-panel hover:text-ink"
          >
            <Icon.Phone width={19} height={19} />
          </button>

          {plan === "free" && (
            <button
              onClick={() => setUpgradeOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-pro/30 px-3 py-1.5 text-[12px] text-pro transition hover:bg-pro/10"
            >
              <Icon.Sparkle width={13} height={13} />
              Pro
            </button>
          )}

          <button
            onClick={() => newConversation()}
            className="rounded-lg p-2 text-muted transition hover:bg-panel hover:text-ink"
            aria-label="Nueva conversación"
          >
            <Icon.Plus />
          </button>
        </header>

        {notice && (
          <div className="animate-fade-up mx-3 mt-2 rounded-lg border border-line bg-panel px-3.5 py-2 text-[12.5px] text-muted sm:mx-4">
            {notice}
          </div>
        )}

        {/* Mensajes */}
        <main
          ref={scrollRef}
          onScroll={onScroll}
          className="scroll-thin min-h-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto w-full max-w-3xl">
            {!active || active.messages.length === 0 ? (
              <Welcome plan={plan} mode={mode} />
            ) : (
              <>
                {active.messages.map((m, i) => (
                  <MessageItem
                    key={m.id}
                    message={m}
                    showThinking={prefs.showThinking}
                    onRetry={
                      m.role === "assistant" && i === active.messages.length - 1 && !busy
                        ? retry
                        : undefined
                    }
                    onContinuar={() => void continuar(m.id)}
                    onArreglar={(fallo) =>
                      void send(
                        `Al abrir la vista previa da este error:\n\n${fallo}\n\nArréglalo y devuélveme el archivo completo y corregido.`,
                      )
                    }
                  />
                ))}

                {streamingMessage && (
                  <MessageItem
                    message={streamingMessage}
                    streaming
                    showThinking={prefs.showThinking}
                  />
                )}

                {busy && !streamingMessage && (
                  <div className="px-4 py-3">
                    <ThinkingBar status={status} />
                    {/* Lo que va haciendo, mientras lo hace: veinte segundos de
                        silencio se parecen demasiado a estar roto. */}
                    {pasosVivos.length > 0 && (
                      <div className="mt-2.5 pl-[42px]">
                        <Pasos pasos={pasosVivos} vivos />
                      </div>
                    )}
                  </div>
                )}

                {busy && streamingMessage && status !== "escribiendo" && (
                  <div className="px-4 pb-2 pl-[52px]">
                    <ThinkingBar status={status} />
                  </div>
                )}

                <div className="h-6" />
              </>
            )}
          </div>
        </main>

        <Composer
          value={input}
          onChange={setInput}
          onSend={() => void send()}
          onStop={stop}
          busy={busy}
          mode={mode}
          plan={plan}
          speed={prefs.speed}
          onSpeedChange={(speed) => setPrefs((p) => ({ ...p, speed }))}
          deepSearch={prefs.deepSearch}
          onDeepSearch={(deepSearch) => setPrefs((p) => ({ ...p, deepSearch }))}
          attachments={attachments}
          onFiles={(files) => void addFiles(files)}
          onRemoveAttachment={(id) => setAttachments((list) => list.filter((a) => a.id !== id))}
          onProNeeded={() => setUpgradeOpen(true)}
          restantes={restantes}
        />
      </div>

      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        plan={plan}
        onPlanChange={setPlan}
        proCodeConfigured={caps.proCodeConfigured}
        billing={billing}
        regalado={proRegalado}
      />

      {/*
        La llamada.

        Al colgar, lo hablado se guarda como una conversación normal: lo que se
        dice en una llamada no se pierde por haberlo dicho en voz alta, y así se
        puede releer, copiar o seguir por escrito.
      */}
      <Llamada
        abierta={llamando}
        nombre={nombre}
        onCerrar={() => setLlamando(false)}
        onGuardar={(turnos) => {
          const fresh = emptyConversation();
          fresh.title = "Llamada";
          fresh.mode = "chat";
          fresh.messages = turnos.map((t) =>
            makeMessage(t.role, t.content, { mode: "chat" }),
          );
          setConversations((list) => [fresh, ...list]);
          setActiveId(fresh.id);
        }}
      />

      <GruposDialog
        open={gruposOpen}
        onClose={() => setGruposOpen(false)}
        plan={plan}
        onUpgrade={() => {
          setGruposOpen(false);
          setUpgradeOpen(true);
        }}
      />

      <BibliotecaDialog
        open={bibliotecaOpen}
        onClose={() => setBibliotecaOpen(false)}
        onInspirar={(prompt) => {
          setBibliotecaOpen(false);
          setInput(prompt);
        }}
      />

      <ProgramarDialog
        open={programarOpen}
        onClose={() => setProgramarOpen(false)}
        plan={plan}
        onUpgrade={() => {
          setProgramarOpen(false);
          setUpgradeOpen(true);
        }}
        onLeidos={() => setTareasNuevas(false)}
      />

      <ConexionesDialog
        open={conexionesOpen}
        onClose={() => setConexionesOpen(false)}
        plan={plan}
        onUpgrade={() => {
          setConexionesOpen(false);
          setUpgradeOpen(true);
        }}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        plan={plan}
        capabilities={caps}
        providerLabel={providerLabel}
        keySources={keySources}
        engine={engine}
        engineCode={engineCode}
        nombre={nombre}
        // Solo se puede guardar con cuenta: sin ella no hay dónde escribirlo.
        puedeCambiarNombre={Boolean(user)}
        onNombre={onNombre}
        onKeysChange={() => {
          // Con la clave puesta cambia lo que la aplicación puede hacer.
          void fetch("/api/pro")
            .then((r) => r.json())
            .then(
              (d: {
                capabilities?: Capabilities;
                providerLabel?: string;
                keySources?: KeySources;
                engine?: Engine | null;
                engineCode?: Engine | null;
              }) => {
                if (d.capabilities) setCaps(d.capabilities);
                if (d.providerLabel) setProviderLabel(d.providerLabel);
                if (d.keySources) setKeySources(d.keySources);
                setEngine(d.engine ?? null);
                setEngineCode(d.engineCode ?? null);
              },
            )
            .catch(() => {});
        }}
        showThinking={prefs.showThinking}
        onShowThinking={(showThinking) => setPrefs((p) => ({ ...p, showThinking }))}
        onClearAll={() => {
          setConversations([]);
          setActiveId(null);
        }}
        conversationCount={conversations.length}
      />
    </div>
  );
}
