import type { Metadata } from "next";

import AvisoDeDatos from "@/components/artesania/AvisoDeDatos";
import Navegacion from "@/components/artesania/Navegacion";
import Pie from "@/components/artesania/Pie";
import { EMPRESA, RUTA_BASE } from "@/lib/artesania/config";
import { SITE_URL } from "@/lib/site";
import "./artesania.css";

/**
 * La web corporativa vive bajo su propia carpeta y con su propia piel.
 * ---------------------------------------------------------------------------
 * Comparte el `layout` raíz —las fuentes ya cargadas, la analítica, el idioma—
 * y encima pone lo suyo: la hoja de estilo `artesania.css`, la cabecera, el pie
 * y unos metadatos propios. La aplicación ECLIPSE sigue intacta en su sitio.
 *
 * Todo cuelga de `div.web-artesania`, que es de donde cuelga también la paleta.
 * Esa clase es la frontera: dentro manda la marca, fuera manda el tema de la
 * aplicación.
 */

const TITULO = `${EMPRESA.nombreCorto} · Artesanía de Zaragoza al por mayor`;

export const metadata: Metadata = {
  title: {
    default: TITULO,
    template: `%s · ${EMPRESA.nombreCorto}`,
  },
  description: EMPRESA.descripcion,
  applicationName: EMPRESA.nombre,
  keywords: [
    "artesanía Zaragoza",
    "productos artesanales al por mayor",
    "mayorista souvenir Zaragoza",
    "El Pilar recuerdos",
    "distribuidor producto artesanal",
    "regalo corporativo artesanal",
    "venta al por mayor Aragón",
  ],
  alternates: { canonical: RUTA_BASE },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: RUTA_BASE,
    siteName: EMPRESA.nombre,
    title: TITULO,
    description: EMPRESA.descripcion,
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: EMPRESA.descripcion,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export default function ArtesaniaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="web-artesania relative min-h-screen">
      {/* Saltar el menú: lo primero que encuentra el tabulador y lo único que
          hace que una web larga se pueda recorrer con teclado sin sufrir. */}
      <a href="#contenido" className="arte-saltar arte-boton">
        Saltar al contenido
      </a>

      <Navegacion />
      <main id="contenido">{children}</main>
      <Pie />
      <AvisoDeDatos />

      {/*
        Lo que Google necesita para entender que esto es una empresa que vende a
        otras empresas. Se construye con lo que HAY: si no hay teléfono, no se
        escribe un teléfono. Un dato inventado en los datos estructurados es
        peor que no ponerlos.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: EMPRESA.nombre,
            url: `${SITE_URL}${RUTA_BASE}`,
            description: EMPRESA.descripcion,
            areaServed: "ES",
            ...(EMPRESA.email ? { email: EMPRESA.email } : {}),
            ...(EMPRESA.telefono ? { telephone: EMPRESA.telefono } : {}),
            ...(EMPRESA.direccion
              ? {
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: EMPRESA.direccion,
                    addressLocality: "Zaragoza",
                    addressCountry: "ES",
                  },
                }
              : {}),
            ...(Object.values(EMPRESA.redes).some(Boolean)
              ? { sameAs: Object.values(EMPRESA.redes).filter(Boolean) }
              : {}),
          }),
        }}
      />
    </div>
  );
}
