import type { MetadataRoute } from "next";

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
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
