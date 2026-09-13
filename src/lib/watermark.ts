import sharp from "sharp";

/**
 * La marca de agua de ECLIPSE, abajo a la derecha.
 *
 * Se estampa en el servidor, sobre los píxeles, y no como un adorno encima en
 * la pantalla: así la imagen que alguien descarga o reenvía por WhatsApp sigue
 * llevando el logo. Si solo se pintara en la página, la marca desaparecería en
 * cuanto la imagen saliera de la aplicación, que es justo cuando hace falta.
 */

/** El eclipse dibujado, con el mismo trazo que el logo de la aplicación. */
function marcaSVG(lado: number): Buffer {
  const flare =
    "M 2 120 C 44 118.4, 62 114, 70 99 C 75.5 110.5, 75.5 129.5, 70 141 C 62 126, 44 121.6, 2 120 Z";

  // Debajo del trazo blanco va el mismo trazo en negro y más grueso. Sin él, el
  // logo desaparece sobre un cielo claro; con él se lee sobre cualquier fondo,
  // y no hace falta ningún desenfoque, que no todos los servidores saben pintar.
  // El disco va MACIZO, no como un anillo. Con el anillo se veía el fondo por
  // el agujero del medio y la marca se leía como un donut sucio en vez de como
  // un eclipse; encima, sobre un cielo con nubes, por el hueco asomaba de todo.
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 240 240">
  <g opacity="0.45">
    <circle cx="120" cy="120" r="63" fill="#000"/>
    <path d="${flare}" fill="#000" stroke="#000" stroke-width="9" stroke-linejoin="round"/>
    <path d="${flare}" fill="#000" stroke="#000" stroke-width="9" stroke-linejoin="round" transform="translate(240,0) scale(-1,1)"/>
  </g>
  <g opacity="0.95">
    <circle cx="120" cy="120" r="58" fill="#fff"/>
    <path d="${flare}" fill="#fff"/>
    <path d="${flare}" fill="#fff" transform="translate(240,0) scale(-1,1)"/>
  </g>
</svg>`);
}

/**
 * Devuelve la misma imagen con el logo estampado en la esquina inferior
 * derecha. Si algo falla, devuelve la imagen tal cual: quedarse sin marca es
 * molesto, quedarse sin imagen es un error.
 */
export async function estampar(
  entrada: Buffer,
): Promise<{ bytes: Buffer; mime: string }> {
  try {
    const img = sharp(entrada, { failOn: "none" });
    const meta = await img.metadata();
    const ancho = meta.width ?? 1024;
    const alto = meta.height ?? 1024;

    // Proporcional al lado corto: en una imagen apaisada, medir por el ancho
    // daría un logo gigante. Con mínimo, para que en las pequeñas se vea.
    const corto = Math.min(ancho, alto);
    const lado = Math.max(52, Math.round(corto * 0.115));
    const margen = Math.max(12, Math.round(corto * 0.035));

    const compuesta = await img
      .composite([
        {
          input: marcaSVG(lado),
          top: alto - lado - margen,
          left: ancho - lado - margen,
        },
      ])
      .png()
      .toBuffer();

    return { bytes: compuesta, mime: "image/png" };
  } catch {
    return { bytes: entrada, mime: "" };
  }
}

/** La versión cómoda: entra un data URL y sale otro, ya con la marca. */
export async function estamparDataUrl(dataUrl: string): Promise<string> {
  const coma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || coma < 0) return dataUrl;

  const cabecera = dataUrl.slice(5, coma);
  if (!cabecera.includes("base64")) return dataUrl;

  const { bytes, mime } = await estampar(Buffer.from(dataUrl.slice(coma + 1), "base64"));
  if (!mime) return dataUrl;
  return `data:${mime};base64,${bytes.toString("base64")}`;
}
