import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/sitio";

/**
 * La portada y nada más.
 *
 * Las páginas legales no van aquí a propósito: llevan `robots: index false`, y
 * pedirle a Google que indexe lo que se le acaba de decir que no indexe es
 * mandarle señales contradictorias.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
