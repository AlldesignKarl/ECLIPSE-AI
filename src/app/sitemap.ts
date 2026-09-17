import type { MetadataRoute } from "next";
import { RUTA_BASE } from "@/lib/artesania/config";
import { SITE_URL } from "@/lib/site";

/**
 * Dos sitios en el mismo despliegue: la aplicación, que vive entera en la
 * portada, y la web corporativa de artesanía, que cuelga de `/artesania`.
 *
 * Las páginas legales no van aquí a propósito: llevan `robots: index false` y
 * pedirle a Google que indexe lo que se le acaba de decir que no indexe es
 * mandarle señales contradictorias.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();

  return [
    {
      url: SITE_URL,
      lastModified: ahora,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}${RUTA_BASE}`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];
}
