/**
 * La dirección pública de la web: la que se enseña y la que se le da a Google.
 *
 * No se deduce del despliegue. Vercel reparte varias direcciones para el mismo
 * sitio —la generada, la de cada rama, la de cada versión— y si el canónico
 * cambiara con ellas, el buscador vería varias copias de la misma web y
 * repartiría el crédito entre todas.
 *
 * Con `NEXT_PUBLIC_SITE_URL` se cambia sin tocar el código, que es lo que hay
 * que hacer el día que haya dominio propio.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")
  : process.env.NODE_ENV === "production"
    ? "https://alldesignkarl.vercel.app"
    : "http://localhost:3000";
