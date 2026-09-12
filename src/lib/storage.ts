import type { Conversation, Message, Mode } from "./types";

const KEY = "eclipse.conversations.v1";
const PREFS_KEY = "eclipse.prefs.v1";
const MAX_CONVERSATIONS = 200;

export interface Prefs {
  speed: "rapido" | "equilibrado" | "profundo";
  deepSearch: boolean;
  showThinking: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  speed: "equilibrado",
  deepSearch: false,
  showThinking: true,
};

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyConversation(): Conversation {
  const now = Date.now();
  return { id: newId(), title: "Nueva conversación", messages: [], createdAt: now, updatedAt: now };
}

export function makeMessage(
  role: Message["role"],
  content: string,
  extra: Partial<Message> = {},
): Message {
  return { id: newId(), role, content, createdAt: Date.now(), ...extra };
}

/**
 * Los adjuntos pueden ocupar megas en base64. No los guardamos en disco:
 * se usan durante la sesión y luego dejamos solo la ficha del archivo.
 */
function slim(conversation: Conversation): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((m) => ({
      ...m,
      attachments: m.attachments?.map((a) => ({ ...a, data: "" })),
      artifacts: m.artifacts?.map((a) =>
        a.type === "image" && a.url && a.url.length > 400_000 ? { ...a, url: undefined } : a,
      ),
    })),
  };
}

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages));
  } catch {
    return [];
  }
}

export function saveConversations(list: Conversation[]): void {
  if (typeof window === "undefined") return;
  const trimmed = list.slice(0, MAX_CONVERSATIONS).map(slim);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // Cuota llena: conservamos solo lo más reciente antes de rendirnos.
    try {
      window.localStorage.setItem(KEY, JSON.stringify(trimmed.slice(0, 20)));
    } catch {
      /* sin espacio; la sesión sigue funcionando en memoria */
    }
  }
}

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignorar */
  }
}

/** Agrupa por fecha para la lista lateral. */
export function groupByDate(list: Conversation[]): { label: string; items: Conversation[] }[] {
  const day = 86_400_000;
  const now = Date.now();
  const buckets: { label: string; items: Conversation[] }[] = [
    { label: "Hoy", items: [] },
    { label: "Ayer", items: [] },
    { label: "Últimos 7 días", items: [] },
    { label: "Últimos 30 días", items: [] },
    { label: "Anteriores", items: [] },
  ];

  for (const c of list) {
    const age = now - c.updatedAt;
    if (age < day) buckets[0].items.push(c);
    else if (age < day * 2) buckets[1].items.push(c);
    else if (age < day * 7) buckets[2].items.push(c);
    else if (age < day * 30) buckets[3].items.push(c);
    else buckets[4].items.push(c);
  }

  return buckets.filter((b) => b.items.length > 0);
}

/* ------------------------- Respuesta a medias ------------------------- */

const DRAFT_KEY = "eclipse.enCurso.v1";

/**
 * Lo que la IA llevaba escrito cuando se cortó.
 *
 * Al cambiar de aplicación, el móvil congela la página y a veces la descarta
 * entera para liberar memoria. Al volver, la respuesta que iba por la mitad se
 * había perdido sin dejar rastro. Guardándola según llega, lo escrito hasta
 * ese momento sigue ahí cuando se vuelve.
 */
export interface EnCurso {
  conversationId: string;
  content: string;
  thinking?: string;
  mode?: Mode;
  at: number;
}

export function saveEnCurso(draft: EnCurso): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* sin espacio: se pierde, que es lo que pasaba siempre */
  }
}

export function loadEnCurso(): EnCurso | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;

    const draft = JSON.parse(raw) as EnCurso;
    if (!draft?.conversationId || !draft.content?.trim()) return null;

    // Más de un día es de otra sesión y ya no le interesa a nadie.
    if (Date.now() - draft.at > 24 * 60 * 60 * 1000) return null;
    return draft;
  } catch {
    return null;
  }
}

export function clearEnCurso(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* da igual */
  }
}
