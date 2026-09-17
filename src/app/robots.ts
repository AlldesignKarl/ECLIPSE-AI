import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/sitio";

/** Se puede mirar todo menos la ruta del formulario, que no es una página. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
