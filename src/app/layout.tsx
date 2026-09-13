import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Newsreader } from "next/font/google";
import { SITE_DESCRIPTION as DESCRIPTION, SITE_URL } from "@/lib/site";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

/**
 * La letra de ECLIPSE.
 *
 * Una grotesca cálida para toda la interfaz, una serif de titular para los dos
 * textos grandes de la portada, y una monoespaciada legible en móvil para el
 * código. Se cargan con `next/font`, así que viajan desde nuestro propio
 * dominio: ni una petición a Google desde el navegador del usuario.
 */
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-eclipse-sans",
});

const serif = Newsreader({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--font-eclipse-serif",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-eclipse-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ECLIPSE AI · Pregunta cualquier cosa, con las fuentes delante",
    template: "%s · ECLIPSE AI",
  },
  description: DESCRIPTION,
  applicationName: "ECLIPSE",
  creator: "Carlos Lafuente Pueyo",
  publisher: "Eclipse",
  authors: [{ name: "Carlos Lafuente Pueyo" }],
  keywords: [
    "ECLIPSE AI",
    "Eclipse IA",
    "inteligencia artificial",
    "asistente de IA",
    "IA gratis",
    "chat con IA",
    "buscar con fuentes",
    "crear imágenes con IA",
  ],
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180" },
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ECLIPSE", statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    siteName: "ECLIPSE AI",
    locale: "es_ES",
    url: "/",
    title: "ECLIPSE AI · Pregunta cualquier cosa, con las fuentes delante",
    description: DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "ECLIPSE AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ECLIPSE AI",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#06070a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

/**
 * La analítica de Vercel: cuántas visitas y de dónde llegan, sin cookies y sin
 * identificar a nadie. Hasta ahora no había forma de saber si alguien usaba
 * esto, y no se puede mejorar lo que no se mide.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        {children}
        <Analytics />
        {/* Le dice a Google qué es esto, quién lo hace y cuál es su logo. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${SITE_URL}#eclipse`,
                  name: "Eclipse",
                  url: SITE_URL,
                  logo: `${SITE_URL}/icon-512.png`,
                  founder: { "@type": "Person", name: "Carlos Lafuente Pueyo" },
                },
                {
                  "@type": "WebApplication",
                  name: "ECLIPSE AI",
                  url: SITE_URL,
                  applicationCategory: "UtilitiesApplication",
                  operatingSystem: "Web",
                  inLanguage: "es-ES",
                  image: `${SITE_URL}/og.png`,
                  description: DESCRIPTION,
                  publisher: { "@id": `${SITE_URL}#eclipse` },
                  offers: {
                    "@type": "Offer",
                    price: "0",
                    priceCurrency: "EUR",
                    description: "Plan gratuito, sin tarjeta.",
                  },
                },
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}
