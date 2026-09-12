import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Una sola página: la aplicación entera vive en la portada. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
