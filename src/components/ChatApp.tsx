"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Composer from "./Composer";
import EclipseLogo from "./EclipseLogo";
import * as Icon from "./Icons";
import MessageItem from "./MessageItem";
import SettingsDialog, {
  EMPTY_KEY_SOURCES,
  type Capabilities,
  type Engine,
  type KeySources,
} from "./SettingsDialog";
import Sidebar from "./Sidebar";
import ThinkingBar from "./ThinkingBar";
import UpgradeDialog, { type Billing } from "./UpgradeDialog";
import Welcome from "./Welcome";
import { encodedSize, FileTooLarge, MAX_TOTAL_ENCODED, toAttachment } from "@/lib/files";
import { extractFiles, leerRetoque, projectName } from "@/lib/project";
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
  Attachment,
  Conversation,
  Message,
  Mode,
  Plan,
  Source,
  Status,
} from "@/lib/types";

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
  onSignOut?: () => void;
  /** Volver a la portada, la que explica qué es la aplicación. */
  onInicio?: () => void;
}

export default function ChatApp({ user = null, onSignOut, onInicio }: ChatAppProps) {
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
  const [proRegalado, setProRegalado] = useState(false);
  const [caps, setCaps] = useState<Capabilities>(EMPTY_CAPS);
  const [providerLabel, setProviderLabel] = useState("comprobando…");
  const [billing, setBilling] = useState<Billing>({ enabled: false, price: "10,00 €" });
  const [keySources, setKeySources] = useState<KeySources>(EMPTY_KEY_SOURCES);
  const [engine, setEngine] = useState<Engine | null>(null);

  const [sidebar, setSidebar] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  /**
   * Cuántas peticiones le quedan hoy, según lo último que dijo el servidor.
   * `null` mientras no se sepa: no se avisa de lo que no se ha medido.
   */
  const [restantes, setRestantes] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef({ text: "", thinking: "" });
  const rafRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const busy = status !== "idle";
  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

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
        }) => {
          if (d.plan) setPlan(d.plan);
          setProRegalado(Boolean(d.proRegalado));
          if (d.capabilities) setCaps(d.capabilities);
          if (d.providerLabel) setProviderLabel(d.providerLabel);
          if (d.billing) setBilling(d.billing);
          if (d.keySources) setKeySources(d.keySources);
          setEngine(d.engine ?? null);
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

  const newConversation = useCallback(() => {
    if (busy) return;
    const fresh = emptyConversation();
    setConversations((list) => [fresh, ...list]);
    setActiveId(fresh.id);
    setInput("");
    setAttachments([]);
    setMode("chat");
    return fresh;
  }, [busy]);

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

      saveEnCurso({ conversationId, content: text, thinking, mode: currentMode, at: ahora });
    },
    [],
  );

  const flushStream = useCallback(() => {
    rafRef.current = null;
    setStream({ ...bufferRef.current });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(flushStream);
  }, [flushStream]);

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

  const runChat = useCallback(
    async (conversationId: string, history: Message[], currentMode: Mode) => {
      const controller = new AbortController();
      abortRef.current = controller;
      bufferRef.current = { text: "", thinking: "" };
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
            messages: history.map((m) => ({
              role: m.role,
              content: m.content,
              attachments: m.attachments?.filter((a) => a.data),
            })),
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
              case "error":
                failure = event.v;
                break;
              case "done":
                elapsedMs = (event.v.elapsedMs as number) ?? undefined;
                break;
            }
          },
          controller.signal,
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError")
          failure = err instanceof Error ? err.message : "Error inesperado.";
      }

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const thinking = bufferRef.current.thinking;
      // La marca de retoque no se le enseña a nadie: es un encargo para el
      // motor de imagen, y el texto tiene que leerse igual sin ella.
      const { limpio: text, encargo } = leerRetoque(bufferRef.current.text);
      const files = currentMode === "bot" ? extractFiles(text) : [];

      const reply = makeMessage("assistant", text, {
        thinking: thinking || undefined,
        sources: sources.length ? sources : undefined,
        error: failure,
        elapsedMs,
        mode: currentMode,
        artifacts: files.length
          ? [
              {
                type: "code" as const,
                files,
                title: projectName(history.at(-1)?.content ?? "proyecto"),
              },
            ]
          : undefined,
      });

      document.removeEventListener("visibilitychange", alOcultarse);
      clearEnCurso();

      upsert(conversationId, (c) => ({ ...c, messages: [...c.messages, reply] }));
      setStream({ text: "", thinking: "" });

      // La explicación ya está a la vista; la imagen retocada llega detrás, que
      // tarda lo suyo. Al revés se quedaría la pantalla en blanco esperando.
      const original = history.at(-1)?.attachments?.find((a) => a.kind === "image");
      if (encargo && original && !failure)
        await retocar(conversationId, reply.id, original, encargo);

      setStatus("idle");
      abortRef.current = null;
    },
    [plan, prefs.speed, prefs.deepSearch, retocar, scheduleFlush, upsert],
  );

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

      if (currentMode === "image")
        await runImage(id, text, ultimaImagen(conversation.messages));
      else await runChat(id, history, currentMode);
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
        onSelect={setActiveId}
        onNew={() => newConversation()}
        onDelete={deleteConversation}
        onRename={(id, title) => upsert(id, (c) => ({ ...c, title }))}
        onUpgrade={() => setUpgradeOpen(true)}
        onSettings={() => setSettingsOpen(true)}
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
          </div>

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
              <Welcome
                plan={plan}
                onPick={(prompt, pickedMode) => {
                  setMode(pickedMode);
                  void send(prompt, pickedMode);
                }}
              />
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
          onModeChange={setMode}
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

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        plan={plan}
        capabilities={caps}
        providerLabel={providerLabel}
        keySources={keySources}
        engine={engine}
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
              }) => {
                if (d.capabilities) setCaps(d.capabilities);
                if (d.providerLabel) setProviderLabel(d.providerLabel);
                if (d.keySources) setKeySources(d.keySources);
                setEngine(d.engine ?? null);
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
