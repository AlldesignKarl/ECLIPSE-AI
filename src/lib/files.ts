import type { Attachment } from "./types";
import { newId } from "./storage";

/**
 * Límite por archivo. Los adjuntos viajan en base64 dentro del cuerpo JSON de la
 * petición, así que ocupan un ~37 % más de lo que pesan en disco. Muchos hostings
 * (Vercel entre ellos) cortan las peticiones sobre 4,5 MB, de ahí estos números.
 */
export const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB por archivo

/** Tope del conjunto de adjuntos, ya codificados. */
export const MAX_TOTAL_ENCODED = 4_000_000;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const TEXT_EXTENSIONS =
  /\.(txt|md|markdown|csv|tsv|json|ya?ml|xml|html?|css|scss|jsx?|tsx?|py|rb|go|rs|java|kt|c|h|cpp|cs|php|sh|sql|ini|toml|env|log|srt|vtt)$/i;

function base64FromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export class FileTooLarge extends Error {}

/** Convierte un archivo del navegador en algo que el modelo pueda leer. */
export async function toAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_FILE_BYTES)
    throw new FileTooLarge(
      `"${file.name}" pesa demasiado. El máximo por archivo son ${Math.round(
        MAX_FILE_BYTES / 1024 / 1024,
      )} MB.`,
    );

  const base = { id: newId(), name: file.name, mime: file.type, size: file.size };

  if (IMAGE_TYPES.includes(file.type)) {
    return { ...base, kind: "image", data: base64FromBuffer(await file.arrayBuffer()) };
  }

  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return {
      ...base,
      mime: "application/pdf",
      kind: "pdf",
      data: base64FromBuffer(await file.arrayBuffer()),
    };
  }

  if (file.type.startsWith("text/") || TEXT_EXTENSIONS.test(file.name) || file.type === "application/json") {
    const text = await file.text();
    return { ...base, kind: "text", data: text.slice(0, 400_000) };
  }

  if (file.type.startsWith("image/")) {
    // Formato de imagen poco común (heic, bmp...): el modelo no lo acepta.
    throw new FileTooLarge(
      `El formato de "${file.name}" no es compatible. Usa PNG, JPG, WEBP o GIF.`,
    );
  }

  throw new FileTooLarge(
    `No puedo leer "${file.name}". Admito imágenes, PDF y archivos de texto o código.`,
  );
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Cuánto ocupa realmente lo que vamos a enviar. */
export function encodedSize(attachments: { data: string }[]): number {
  return attachments.reduce((total, a) => total + a.data.length, 0);
}
