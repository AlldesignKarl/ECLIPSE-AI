/**
 * La dirección pública de la aplicación.
 *
 * Google y las redes sociales necesitan direcciones absolutas para la imagen
 * de portada y el enlace canónico, así que hay que saber dónde vive. Se puede
 * fijar con NEXT_PUBLIC_SITE_URL —lo suyo el día que haya dominio propio— y si
 * no, se deduce del despliegue.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

export const SITE_DESCRIPTION =
  "ECLIPSE es un asistente de inteligencia artificial que responde cualquier pregunta buscando en la web y priorizando universidades, revistas científicas y organismos oficiales. Lee tus imágenes, PDF y archivos, crea imágenes y programa proyectos completos.";
