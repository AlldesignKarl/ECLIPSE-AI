import { ImageResponse } from "next/og";

import { monograma } from "@/lib/artesania/config";

/**
 * El icono de la pestaña de AlldesignKarl.
 *
 * Esta web comparte despliegue con ECLIPSE, así que sin esto saldría el eclipse
 * en la pestaña de una empresa de artesanía: dos marcas con la misma cara. Se
 * dibuja aquí mismo con el monograma de `config.ts`, así que el día que haya
 * logotipo de verdad se sustituye este archivo por un `icon.png` y ya está.
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
