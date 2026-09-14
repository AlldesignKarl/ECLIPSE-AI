import type { MetadataRoute } from "next";

import { ICONOS } from "@/lib/iconos";

/**
 * Con esto el navegador ofrece "Añadir a pantalla de inicio" y la app se abre
 * a pantalla completa, sin barra de direcciones, con el icono del eclipse.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ECLIPSE AI",
    short_name: "ECLIPSE",
    description:
      "Asistente de IA que responde cualquier pregunta buscando en universidades, revistas científicas y organismos oficiales.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#06070a",
    theme_color: "#06070a",
    lang: "es",
    categories: ["productivity", "utilities"],
    /*
      El `?v=` no es adorno: sin él, un icono nuevo no se ve nunca.

      El archivo se llama igual que antes, así que el navegador y el móvil
      siguen enseñando el que tienen guardado por muchas veces que se despliegue
      uno mejor. Cambiando la dirección se les acaba la excusa. Al subir la
      versión de NOVEDADES, este número va detrás.
    */
    icons: [
      { src: `/icon-192.png?v=${ICONOS}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/icon-512.png?v=${ICONOS}`, sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: `/icon-maskable.png?v=${ICONOS}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
