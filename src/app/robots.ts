import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Los buscadores pueden mirarlo todo menos las rutas internas de la API. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
