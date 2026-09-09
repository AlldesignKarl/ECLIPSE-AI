export type Plan = "free" | "pro";

/** Modos de trabajo del asistente. Los `pro` requieren plan Pro. */
export type Mode = "chat" | "search" | "image" | "code" | "video";

export type Speed = "rapido" | "equilibrado" | "profundo";

export interface Attachment {
  id: string;
  name: string;
  /** MIME real del archivo. */
  mime: string;
  size: number;
  /** Cómo se envía al modelo. */
  kind: "image" | "pdf" | "text";
  /** base64 sin cabecera `data:` para image/pdf; texto plano para `text`. */
  data: string;
}

export interface Source {
  url: string;
  title: string;
  /** Dominio normalizado, p. ej. `mit.edu`. */
  domain: string;
  /** 0-100: qué tan fiable consideramos la fuente. */
  trust: number;
  /** Etiqueta legible: "Universidad", "Revista científica"... */
  label: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface Artifact {
  type: "image" | "video" | "code";
  /** data: URL para imagen, URL reproducible para vídeo. */
  url?: string;
  prompt?: string;
  files?: GeneratedFile[];
  /** Nombre del proyecto cuando `type === "code"`. */
  title?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Resumen del razonamiento, si el modelo lo devuelve. */
  thinking?: string;
  attachments?: Attachment[];
  sources?: Source[];
  artifacts?: Artifact[];
  error?: string;
  createdAt: number;
  /** Milisegundos que tardó la respuesta. */
  elapsedMs?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

/** Estados que se muestran junto al eclipse animado. */
export type Status =
  | "idle"
  | "conectando"
  | "pensando"
  | "buscando"
  | "leyendo"
  | "procesando"
  | "escribiendo"
  | "generando_imagen"
  | "generando_video"
  | "programando";

export const STATUS_LABEL: Record<Status, string> = {
  idle: "",
  conectando: "Conectando",
  pensando: "Pensando",
  buscando: "Buscando en la web",
  leyendo: "Leyendo fuentes",
  procesando: "Procesando",
  escribiendo: "Escribiendo",
  generando_imagen: "Creando la imagen",
  generando_video: "Generando el vídeo",
  programando: "Escribiendo código",
};
