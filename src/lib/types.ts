export type Plan = "free" | "pro";

/** Modos de trabajo del asistente. Los `pro` requieren plan Pro. */
export type Mode = "chat" | "search" | "image" | "bot";

export type Speed = "rapido" | "equilibrado" | "profundo";

export interface Attachment {
  id: string;
  name: string;
  /** MIME real del archivo. */
  mime: string;
  size: number;
  /** Cómo se envía al modelo. */
  kind: "image" | "pdf" | "text" | "video";
  /** base64 sin cabecera `data:` para image/pdf/video; texto plano para `text`. */
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
  type: "image" | "video" | "code" | "file";
  /** data: URL para imagen, URL reproducible para vídeo. */
  url?: string;
  prompt?: string;
  files?: GeneratedFile[];
  /** Nombre del proyecto cuando `type === "code"`, del archivo cuando es "file". */
  title?: string;
  /** Tipo de contenido del archivo generado. */
  mime?: string;
}

/** Un paso de herramienta, para poder contar qué hizo ECLIPSE y en qué orden. */
export interface Paso {
  nombre: string;
  detalle: string;
  /** Sin terminar mientras está en marcha. */
  ok?: boolean;
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
  /** En qué modo se pidió. En código, el texto se enseña sin los archivos. */
  mode?: Mode;
  /** Las herramientas que usó para responder, en orden. */
  pasos?: Paso[];
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
  | "retocando_imagen"
  | "programando"
  | "esperando";

export const STATUS_LABEL: Record<Status, string> = {
  idle: "",
  conectando: "Conectando",
  pensando: "Pensando",
  buscando: "Buscando en la web",
  leyendo: "Leyendo fuentes",
  procesando: "Procesando",
  escribiendo: "Escribiendo",
  generando_imagen: "Creando la imagen",
  retocando_imagen: "Retocando tu imagen",
  programando: "Escribiendo código",
  esperando: "Sin cuota ahora mismo, reintentando solo",
};
