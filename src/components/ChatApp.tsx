"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Composer from "./Composer";
import EclipseLogo from "./EclipseLogo";
import GithubDialog, { type GithubStatus } from "./GithubDialog";
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
import { extractFiles, projectName } from "@/lib/project";
import { readSSE } from "@/lib/sse";
import {
  DEFAULT_PREFS,
  emptyConversation,
  loadConversations,
  loadPrefs,
  makeMessage,
  saveConversations,
  savePrefs,
  type Prefs,
} from "@/lib/storage";
import type {
  Attachment,
  Conversation,
  GeneratedFile,
  Message,
  Mode,
  Plan,
  Source,
  Status,
} from "@/lib/types";

const EMPTY_CAPS: Capabilities = {
  chat: true,
  image: false,
  video: false,
  github: true,
  proCodeConfigured: false,
};

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
  const [github, setGithub] = useState<GithubStatus>({
    connected: false,
    user: null,
    oauthAvailable: false,
  });

  const [sidebar, setSidebar] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingPush, setPendingPush] = useState<{ files: GeneratedFile[]; title: string } | null>(
    null,
  );
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

    void fetch("/api/github")
      .then((r) => r.json())
      .then((d: Partial<GithubStatus>) =>
        setGithub({
          connected: Boolean(d.connected),
          user: d.user ?? null,
          oauthAvailable: Boolean(d.oauthAvailable),
        }),
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

    // Vuelta del login de GitHub.
    if (params.get("github") === "ok") {
      setNotice("Cuenta de GitHub conectada.");
      window.history.replaceState({}, "", "/");
    } else if (params.get("github") === "error") {
      setNotice(`No se pudo conectar con GitHub: ${params.get("reason") ?? "error desconocido"}`);
      window.history.replaceState({}, "", "/");
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
  const runChat = useCallback(
    async (conversationId: string, history: Message[], currentMode: Mode) => {
      const controller = new AbortController();
      abortRef.current = controller;
      bufferRef.current = { text: "", thinking: "" };
      setStream({ text: "", thinking: "" });
      setStatus("conectando");

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
          throw new Error(data.error ?? `Error ${res.status}`);
        }

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

      const text = bufferRef.current.text;
      const thinking = bufferRef.current.thinking;
      const files = currentMode === "code" ? extractFiles(text) : [];

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

      upsert(conversationId, (c) => ({ ...c, messages: [...c.messages, reply] }));
      setStream({ text: "", thinking: "" });
      setStatus("idle");
      abortRef.current = null;
    },
    [prefs.speed, prefs.deepSearch, scheduleFlush, upsert],
  );

  const runImage = useCallback(
    async (conversationId: string, prompt: string) => {
      setStatus("generando_imagen");
      try {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const data = (await res.json()) as { dataUrl?: string; note?: string; error?: string };
        if (!res.ok || !data.dataUrl) throw new Error(data.error ?? "No se pudo crear la imagen.");

        upsert(conversationId, (c) => ({
          ...c,
          messages: [
            ...c.messages,
            makeMessage("assistant", data.note?.trim() || "Aquí tienes la imagen.", {
              artifacts: [{ type: "image", url: data.dataUrl, prompt }],
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

  const runVideo = useCallback(
    async (conversationId: string, prompt: string) => {
      setStatus("generando_video");
      try {
        const start = await fetch("/api/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const startData = (await start.json()) as {
          operation?: string;
          error?: string;
          code?: string;
        };
        if (!start.ok || !startData.operation) {
          if (startData.code === "pro_required") setUpgradeOpen(true);
          throw new Error(startData.error ?? "No se pudo iniciar el vídeo.");
        }

        // Veo tarda: consultamos cada 8 segundos hasta 6 minutos.
        const deadline = Date.now() + 6 * 60_000;
        let uri: string | undefined;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 8000));
          const poll = await fetch(
            `/api/video/status?operation=${encodeURIComponent(startData.operation)}`,
          );
          const pollData = (await poll.json()) as {
            done?: boolean;
            uri?: string;
            error?: string;
          };
          if (pollData.error) throw new Error(pollData.error);
          if (pollData.done && pollData.uri) {
            uri = pollData.uri;
            break;
          }
        }
        if (!uri) throw new Error("El vídeo ha tardado demasiado. Inténtalo de nuevo.");

        upsert(conversationId, (c) => ({
          ...c,
          messages: [
            ...c.messages,
            makeMessage("assistant", "Vídeo listo.", {
              artifacts: [
                { type: "video", url: `/api/video/file?uri=${encodeURIComponent(uri)}`, prompt },
              ],
            }),
          ],
        }));
      } catch (err) {
        upsert(conversationId, (c) => ({
          ...c,
          messages: [
            ...c.messages,
            makeMessage("assistant", "", {
              error: err instanceof Error ? err.message : "No se pudo generar el vídeo.",
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

      if (currentMode === "image") await runImage(id, text);
      else if (currentMode === "video") await runVideo(id, text);
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
      runVideo,
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

  const requestPush = (files: GeneratedFile[], title: string) => {
    if (plan !== "pro") {
      setUpgradeOpen(true);
      return;
    }
    setPendingPush({ files, title });
    setGithubOpen(true);
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
        githubUser={github.user?.login ?? null}
        onSelect={setActiveId}
        onNew={() => newConversation()}
        onDelete={deleteConversation}
        onRename={(id, title) => upsert(id, (c) => ({ ...c, title }))}
        onUpgrade={() => setUpgradeOpen(true)}
        onGithub={() => {
          setPendingPush(null);
          setGithubOpen(true);
        }}
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
                    onPushProject={requestPush}
                  />
                ))}

                {streamingMessage && (
                  <MessageItem
                    message={streamingMessage}
                    streaming
                    showThinking={prefs.showThinking}
                    onPushProject={requestPush}
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

      <GithubDialog
        open={githubOpen}
        onClose={() => {
          setGithubOpen(false);
          setPendingPush(null);
        }}
        status={github}
        onStatusChange={setGithub}
        pending={pendingPush}
        plan={plan}
        onNeedPro={() => {
          setGithubOpen(false);
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
