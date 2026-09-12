/**
 * La dirección pública de la aplicación: la que se enseña y la que se le da a
 * Google.
 *
 * No se deduce del despliegue: Vercel reparte varias direcciones para el mismo
 * sitio —la generada, la de cada rama, la de cada versión— y si el canónico
 * cambiara con ellas, el buscador vería varias copias de la misma página y
 * repartiría el crédito entre todas. Esta es la única que cuenta.
 *
 * Con NEXT_PUBLIC_SITE_URL se cambia sin tocar el código, que es lo suyo el
 * día que haya dominio propio.
 */
const CANONICA = "https://eclipse-ia.vercel.app";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")
  : process.env.NODE_ENV === "production"
    ? CANONICA
    : "http://localhost:3000";

export const SITE_DESCRIPTION =
  "ECLIPSE es un asistente de inteligencia artificial que responde cualquier pregunta buscando en la web y priorizando universidades, revistas científicas y organismos oficiales. Lee tus imágenes, PDF y archivos, crea imágenes y programa proyectos completos.";
