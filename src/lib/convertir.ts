/**
 * Pasar una imagen de un formato a otro, aquí mismo y sin tocar sus píxeles.
 *
 * Esto NO es cosa de la IA. Convertir un PNG a JPG es una operación exacta: hay
 * una respuesta correcta y no admite interpretación. Pedírselo a un modelo de
 * imágenes daría otra foto parecida, que es justo lo contrario de lo que se
 * pide cuando alguien dice "pásamela a PDF": quiere LA MISMA, en otro archivo.
 *
 * Así que se hace en el propio navegador. Ventajas de hacerlo aquí y no en el
 * servidor: es instantáneo, no gasta cupo de nada, no hay límite de tamaño de
 * petición, y la imagen no sale del teléfono.
 */

export type Formato = "png" | "jpg" | "webp" | "pdf";

const NOMBRES: Record<Formato, string> = {
  png: "PNG",
  jpg: "JPG",
  webp: "WEBP",
  pdf: "PDF",
};

/** El formato que pide el usuario, escrito como sea. */
export function leerFormato(texto: string): Formato | null {
  const t = texto.trim().toLowerCase().replace(/^\./, "");
  if (t === "png") return "png";
  if (t === "jpg" || t === "jpeg") return "jpg";
  if (t === "webp") return "webp";
  if (t === "pdf") return "pdf";
  return null;
}

/**
 * ¿Está pidiendo convertir la imagen, y a qué?
 *
 * Esto se mira directamente sobre lo que escribe el usuario, sin pasar por el
 * modelo. Convertir no necesita entender nada ni mirar la foto: es una orden
 * con una respuesta única. Dejárselo al modelo era la causa de que a la primera
 * contestara "no puedo" y a la segunda sí: unas veces escribía la marca y otras
 * se liaba pensando que hacía falta ver la imagen para cambiarle el formato.
 *
 * Hace falta las dos cosas —un formato y una intención de convertir— para no
 * confundirlo con "créame una imagen png", que es otra cosa.
 */
export function formatoPedido(texto: string): Formato | null {
  const t = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const formato = /\b(png|jpe?g|webp|pdf)\b/.exec(t);
  if (!formato) return null;

  const quiereConvertir =
    /\b(pasa|pasala|pasalo|pasamela|pasamelo|convierte|conviertela|conviertelo|conviertemela|convertir|conversion|exporta|exportala|transforma|transformala|guarda|guardala|guardamela|descargala|ponla|ponlo|dejala|dejamela|hazla|hazmela)\b/.test(
      t,
    ) ||
    // "esta foto en pdf", "la imagen a png": la preposición delante del
    // formato ya dice que se quiere ESA imagen en ese formato.
    /\b(a|en|como|formato)\s+(png|jpe?g|webp|pdf)\b/.test(t);

  // Y que no esté pidiendo una imagen NUEVA, que eso es crear, no convertir.
  const quiereUnaNueva = /\b(crea|creame|crear|genera|generame|generar|dibuja|dibujame|imaginate|inventa)\b/.test(t);

  if (!quiereConvertir || quiereUnaNueva) return null;
  return leerFormato(formato[1]);
}

export function nombreDe(formato: Formato): string {
  return NOMBRES[formato];
}

function base64ABytes(b64: string): Uint8Array {
  const limpio = b64.startsWith("data:") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const binario = atob(limpio);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function bytesABase64(bytes: Uint8Array): string {
  let binario = "";
  const trozo = 0x8000;
  for (let i = 0; i < bytes.length; i += trozo)
    binario += String.fromCharCode(...bytes.subarray(i, i + trozo));
  return btoa(binario);
}

async function aLienzo(bytes: Uint8Array, mime: string): Promise<HTMLCanvasElement> {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const bitmap = await createImageBitmap(blob);

  const lienzo = document.createElement("canvas");
  lienzo.width = bitmap.width;
  lienzo.height = bitmap.height;

  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("El navegador no ha dejado preparar la imagen.");

  // Los formatos sin transparencia necesitan algo debajo, o lo transparente
  // sale negro y eso sí sería una diferencia visual.
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return lienzo;
}

function conFondoBlanco(lienzo: HTMLCanvasElement): HTMLCanvasElement {
  const plano = document.createElement("canvas");
  plano.width = lienzo.width;
  plano.height = lienzo.height;
  const ctx = plano.getContext("2d");
  if (!ctx) return lienzo;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, plano.width, plano.height);
  ctx.drawImage(lienzo, 0, 0);
  return plano;
}

async function aBlob(lienzo: HTMLCanvasElement, mime: string, calidad?: number): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, mime, calidad));
  if (!blob) throw new Error("No se ha podido generar el archivo.");
  return new Uint8Array(await blob.arrayBuffer());
}

/* ------------------------------- El PDF -------------------------------- */

/**
 * Un flujo zlib sin comprimir.
 *
 * El PDF exige que los datos en crudo vayan con FlateDecode, que es zlib. Pero
 * zlib admite bloques "almacenados", sin comprimir: cabecera, longitud, y los
 * bytes tal cual. Eso permite meter los píxeles exactos sin arrastrar ninguna
 * librería de compresión. Pesa más, sí; a cambio, la imagen del PDF es la misma
 * que la de origen, pixel a pixel.
 */
function zlibSinComprimir(datos: Uint8Array): Uint8Array {
  const MAX = 65535;
  const bloques = Math.max(1, Math.ceil(datos.length / MAX));
  const salida = new Uint8Array(2 + bloques * 5 + datos.length + 4);
  let p = 0;

  salida[p++] = 0x78; // método deflate, ventana de 32K
  salida[p++] = 0x01; // sin diccionario, compresión mínima

  for (let i = 0; i < bloques; i++) {
    const desde = i * MAX;
    const largo = Math.min(MAX, datos.length - desde);
    salida[p++] = i === bloques - 1 ? 1 : 0; // ¿último bloque?, tipo 00
    salida[p++] = largo & 0xff;
    salida[p++] = (largo >> 8) & 0xff;
    salida[p++] = ~largo & 0xff;
    salida[p++] = (~largo >> 8) & 0xff;
    salida.set(datos.subarray(desde, desde + largo), p);
    p += largo;
  }

  // Adler-32 de los datos originales, que es como zlib comprueba que llegaron
  // enteros.
  let a = 1;
  let b = 0;
  for (let i = 0; i < datos.length; i++) {
    a = (a + datos[i]) % 65521;
    b = (b + a) % 65521;
  }
  salida[p++] = (b >> 8) & 0xff;
  salida[p++] = b & 0xff;
  salida[p++] = (a >> 8) & 0xff;
  salida[p++] = a & 0xff;

  return salida.subarray(0, p);
}

/**
 * Un PDF de una página con la imagen dentro, a tamaño de página.
 *
 * Se escribe a mano porque lo que hace falta es minúsculo —un catálogo, una
 * página y la imagen— y meter una librería de PDF entera para esto serían
 * cientos de kilobytes que el usuario se descarga para nada.
 *
 * Si la imagen ya es un JPEG, sus bytes van TAL CUAL con DCTDecode: el PDF
 * lleva exactamente el mismo archivo, sin recodificar ni perder nada. Si no,
 * van los píxeles en crudo. En los dos casos, cero diferencia visual.
 */
function construirPdf(
  datos: Uint8Array,
  ancho: number,
  alto: number,
  filtro: "DCTDecode" | "FlateDecode",
): Uint8Array {
  const trozos: (string | Uint8Array)[] = [];
  const offsets: number[] = [];
  let largo = 0;

  const bytesDe = (t: string | Uint8Array) =>
    typeof t === "string" ? new TextEncoder().encode(t) : t;

  const escribir = (t: string | Uint8Array) => {
    const b = bytesDe(t);
    trozos.push(b);
    largo += b.length;
  };

  const objeto = (n: number, cuerpo: string, flujo?: Uint8Array) => {
    offsets[n] = largo;
    escribir(`${n} 0 obj\n${cuerpo}\n`);
    if (flujo) {
      escribir("stream\n");
      escribir(flujo);
      escribir("\nendstream\n");
    }
    escribir("endobj\n");
  };

  escribir("%PDF-1.4\n");

  objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objeto(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objeto(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ancho} ${alto}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  objeto(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${ancho} /Height ${alto} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${filtro} /Length ${datos.length} >>`,
    datos,
  );

  const dibujo = new TextEncoder().encode(`q\n${ancho} 0 0 ${alto} 0 0 cm\n/Im0 Do\nQ`);
  objeto(5, `<< /Length ${dibujo.length} >>`, dibujo);

  const inicioTabla = largo;
  let tabla = `xref\n0 6\n0000000000 65535 f \n`;
  for (let n = 1; n <= 5; n++) tabla += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  escribir(tabla);
  escribir(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${inicioTabla}\n%%EOF\n`);

  const salida = new Uint8Array(largo);
  let p = 0;
  for (const t of trozos) {
    const b = bytesDe(t);
    salida.set(b, p);
    p += b.length;
  }
  return salida;
}

/* ------------------------------ La entrada ------------------------------ */

export interface Convertida {
  /** El archivo, listo para descargar. */
  dataUrl: string;
  nombre: string;
  mime: string;
  bytes: number;
}

/** Convierte la imagen al formato pedido, sin cambiar lo que se ve. */
export async function convertirImagen(
  origen: { data: string; mime: string; name: string },
  formato: Formato,
): Promise<Convertida> {
  const bytes = base64ABytes(origen.data);
  const base = (origen.name.replace(/\.[^.]+$/, "") || "imagen").slice(0, 60);

  if (formato === "pdf") {
    const esJpeg = /jpe?g/i.test(origen.mime);
    const lienzo = await aLienzo(bytes, origen.mime);

    // Sin comprimir, los píxeles en crudo ocupan ancho x alto x 3. A partir de
    // cierto tamaño el PDF se pone imposible de descargar en un móvil, y
    // entonces compensa más un JPEG de calidad alta: la diferencia no se ve y
    // el archivo pesa veinte veces menos.
    // Sin comprimir, los píxeles en crudo ocupan ancho x alto x 3. Pasado
    // cierto tamaño el PDF se vuelve imposible de descargar en un móvil, y
    // entonces compensa un JPEG de calidad muy alta: la diferencia no se ve y
    // el archivo pesa veinte veces menos.
    const cabeEnCrudo = lienzo.width * lienzo.height * 3 <= 6_000_000;

    const pixelesEnCrudo = () => {
      const ctx = conFondoBlanco(lienzo).getContext("2d")!;
      const rgba = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;
      const rgb = new Uint8Array((rgba.length / 4) * 3);
      for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
        rgb[j] = rgba[i];
        rgb[j + 1] = rgba[i + 1];
        rgb[j + 2] = rgba[i + 2];
      }
      return rgb;
    };

    let pdf: Uint8Array;
    if (esJpeg) {
      // Los bytes del JPEG entran tal cual: el PDF lleva el mismo archivo.
      pdf = construirPdf(bytes, lienzo.width, lienzo.height, "DCTDecode");
    } else if (cabeEnCrudo) {
      pdf = construirPdf(
        zlibSinComprimir(pixelesEnCrudo()),
        lienzo.width,
        lienzo.height,
        "FlateDecode",
      );
    } else {
      pdf = construirPdf(
        await aBlob(conFondoBlanco(lienzo), "image/jpeg", 0.95),
        lienzo.width,
        lienzo.height,
        "DCTDecode",
      );
    }

    return {
      dataUrl: `data:application/pdf;base64,${bytesABase64(pdf)}`,
      nombre: `${base}.pdf`,
      mime: "application/pdf",
      bytes: pdf.length,
    };
  }

  const lienzo = await aLienzo(bytes, origen.mime);
  const mime = formato === "png" ? "image/png" : formato === "webp" ? "image/webp" : "image/jpeg";
  // JPG no tiene transparencia: sin fondo, lo transparente saldría negro.
  const listo = formato === "jpg" ? conFondoBlanco(lienzo) : lienzo;
  const salida = await aBlob(listo, mime, formato === "png" ? undefined : 0.95);

  return {
    dataUrl: `data:${mime};base64,${bytesABase64(salida)}`,
    nombre: `${base}.${formato}`,
    mime,
    bytes: salida.length,
  };
}
