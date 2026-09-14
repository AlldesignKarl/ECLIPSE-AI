export type Plan = "free" | "pro";

/**
 * Cómo trabaja el asistente.
 *
 * Solo dos, y a propósito. Antes había cuatro y había que elegir el correcto
 * ANTES de escribir: pedir una imagen desde el modo Chat no creaba ninguna
 * imagen. Eso obliga a la persona a saber cómo está hecha la aplicación por
 * dentro. Ahora `chat` lo hace todo —busca, crea imágenes, escribe archivos—
 * porque quien decide es el modelo con sus herramientas.
 *
 * `code` se queda aparte porque no es lo mismo: ahí la respuesta son archivos
 * de un proyecto, no una conversación, y mezclarlo estorbaría a los dos.
 *
 * Los nombres viejos siguen en las conversaciones ya guardadas, así que se
 * traducen al leerlas.
 */
export type Mode = "chat" | "code";

/** Un modo de los de antes, tal y como quedó escrito en el móvil de alguien. */
export type ModeGuardado = Mode | "search" | "image" | "bot";

/** Traduce un modo antiguo al que existe hoy. */
export function modoVigente(m: ModeGuardado | undefined): Mode {
  return m === "bot" || m === "code" ? "code" : "chat";
}

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
  /** Qué modelo escribió esta respuesta. Sirve para saber por qué salió así. */
  modelo?: string;
  /** Se quedó a medias por longitud: se le puede pedir que siga. */
  cortado?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  /**
   * En qué modo vive esta conversación. Va aquí y no en el componente porque
   * al cambiar de conversación tiene que cambiar con ella: si no, se abre una
   * de ECLIPSE CODE y se contesta como si fuera un chat normal.
   */
  mode?: Mode;
  /**
   * Temporal: no se guarda en ningún sitio y desaparece al cerrarla.
   *
   * Sirve para lo que uno no quiere que quede escrito en su propio móvil —una
   * consulta médica, una nómina, una idea a medias— sin tener que acordarse de
   * borrarla después. Y "no se guarda" es literal: no llega ni a escribirse,
   * no es que se escriba y se borre.
   */
  temporal?: boolean;
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
