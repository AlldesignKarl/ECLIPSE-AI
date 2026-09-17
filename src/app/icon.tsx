import { ImageResponse } from "next/og";

import { monograma } from "@/lib/config";

/**
 * El icono de la pestaña de AlldesignKarl.
 *
 * Se dibuja aquí mismo con el monograma de `config.ts`: sin esto saldría el
 * icono gris de "sin favicon", que es lo primero que se ve en una pestaña. El
 * día que haya logotipo de verdad se sustituye este archivo por un `icon.png`
 * en esta misma carpeta y no hay que tocar nada más.
 */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #14306b, #060b18)",
          color: "#e8cf84",
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: 1,
          borderRadius: 14,
        }}
      >
        {monograma()}
      </div>
    ),
    size,
  );
}
