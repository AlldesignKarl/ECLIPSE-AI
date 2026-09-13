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
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/mpeg", "video/3gpp"];

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

/**
 * El lado largo al que se encoge una foto antes de mandarla.
 *
 * No es un recorte de calidad: los modelos que miran imágenes las reducen ellos
 * a un tamaño parecido antes de mirarlas, así que mandar los doce megapíxeles
 * de la cámara no mejora en nada lo que ve. Lo que sí hace es que una foto del
 * móvil de seis megas no quepa en la petición y se rechace entera, que era
 * justo lo que pasaba: "pesa demasiado" a una foto normal de un teléfono
 * normal. Encogida ocupa unos cientos de kilobytes y se ve igual de bien.
 */
const LADO_LARGO = 1568;

/** Calidad del JPEG resultante. Por encima de 0,85 solo se gana peso. */
const CALIDAD = 0.82;

/**
 * Encoge una foto en el propio navegador. Si no se puede, devuelve null y se
 * sigue con el archivo original: mejor mandarlo tal cual que no mandar nada.
 */
async function encoger(file: File): Promise<{ data: string; mime: string; size: number } | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;

  try {
    const bitmap = await createImageBitmap(file);
    const mayor = Math.max(bitmap.width, bitmap.height);
    const escala = mayor > LADO_LARGO ? LADO_LARGO / mayor : 1;

    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(bitmap.width * escala));
    lienzo.height = Math.max(1, Math.round(bitmap.height * escala));

    const ctx = lienzo.getContext("2d");
    if (!ctx) return null;
    // Fondo blanco: un PNG con transparencia sobre JPEG saldría con manchas
    // negras donde no había nada, y eso el modelo lo ve como parte de la foto.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((listo) =>
      lienzo.toBlob(listo, "image/jpeg", CALIDAD),
    );
    if (!blob) return null;

    // Si encoger no ha servido de nada (una imagen ya pequeña), se deja la
    // original, que conserva su formato y su transparencia.
    if (blob.size >= file.size && file.size <= MAX_FILE_BYTES) return null;

    return {
      data: base64FromBuffer(await blob.arrayBuffer()),
      mime: "image/jpeg",
      size: blob.size,
    };
  } catch {
    return null;
  }
}

export class FileTooLarge extends Error {}

/** Convierte un archivo del navegador en algo que el modelo pueda leer. */
export async function toAttachment(file: File): Promise<Attachment> {
  // Los vídeos de móvil pesan muchísimo y la petición entera no puede pasar de
  // 4,5 MB, así que casi siempre habrá que recortarlos antes.
  if (file.type.startsWith("video/") && file.size > MAX_FILE_BYTES)
    throw new FileTooLarge(
      `"${file.name}" pesa ${humanSize(file.size)} y el máximo son ${Math.round(
        MAX_FILE_BYTES / 1024 / 1024,
      )} MB. Recorta el vídeo a unos segundos (o haz una captura del momento que te interesa) y vuelve a probar.`,
    );

  // Las fotos se encogen antes de pesarlas: una foto de móvil pasa de los 3 MB
  // con facilidad, y rechazarla sería impedir lo único que se quería hacer.
  if (file.type.startsWith("image/")) {
    const encogida = await encoger(file);
    if (encogida) {
      if (encogida.size > MAX_FILE_BYTES)
        throw new FileTooLarge(
          `"${file.name}" sigue pesando demasiado incluso reducida. Prueba con una captura de pantalla.`,
        );
      return {
        id: newId(),
        name: file.name,
        mime: encogida.mime,
        size: encogida.size,
        kind: "image",
        data: encogida.data,
      };
    }
  }

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

  if (VIDEO_TYPES.includes(file.type) || /\.(mp4|webm|mov|m4v|3gp)$/i.test(file.name)) {
    return {
      ...base,
      mime: VIDEO_TYPES.includes(file.type) ? file.type : "video/mp4",
      kind: "video",
      data: base64FromBuffer(await file.arrayBuffer()),
    };
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
    `No puedo leer "${file.name}". Admito imágenes, vídeos cortos, PDF y archivos de texto o código.`,
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
