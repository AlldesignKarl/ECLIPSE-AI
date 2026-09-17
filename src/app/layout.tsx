import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Newsreader } from "next/font/google";

import AvisoDeDatos from "@/components/AvisoDeDatos";
import Navegacion from "@/components/Navegacion";
import Pie from "@/components/Pie";
import { EMPRESA } from "@/lib/config";
import { rutaDelLogo } from "@/lib/logo";
import { SITE_URL } from "@/lib/sitio";
import "./globals.css";

/**
 * El armazón de toda la web: fuentes, metadatos, cabecera y pie.
 *
 * Las fuentes se cargan con `next/font`, así que se sirven desde nuestro propio
 * dominio y no desde Google: no hay ninguna petición a un tercero por el hecho
 * de abrir la página, y además no hay salto de letra al cargar.
 *
 * Una grotesca cálida para el texto y una serif editorial para los titulares.
 * Dos familias y ninguna más: cada fuente extra es medio segundo en móvil.
 */
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--fuente-sans",
});

const serif = Newsreader({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--fuente-serif",
});

const TITULO = `${EMPRESA.nombreCorto} · Artesanía de Zaragoza al por mayor`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
  alternates: { canonical: "/" },
  appleWebApp: { capable: true, title: EMPRESA.nombreCorto, statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "/",
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

export const viewport: Viewport = {
  // La barra de estado del móvil, del color del fondo de la portada.
  themeColor: "#060b18",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Se mira el disco UNA vez por render de servidor, no una por componente.
  const logo = rutaDelLogo();

  return (
    <html lang="es" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <div className="sitio relative min-h-screen">
          {/* Saltar el menú: lo primero que encuentra el tabulador y lo único
              que hace que una web larga se pueda recorrer con teclado sin
              sufrir. */}
          <a href="#contenido" className="arte-saltar arte-boton">
            Saltar al contenido
          </a>

          <Navegacion logo={logo} />
          <main id="contenido">{children}</main>
          <Pie logo={logo} />
          <AvisoDeDatos />

          {/*
            Lo que Google necesita para entender que esto es una empresa que
            vende a otras empresas. Se construye con lo que HAY: si no hay
            teléfono, no se escribe un teléfono. Un dato inventado en los datos
            estructurados es peor que no ponerlos.
          */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                name: EMPRESA.nombre,
                url: SITE_URL,
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
      </body>
    </html>
  );
}
