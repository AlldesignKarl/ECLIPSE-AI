import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";

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
  title: "ECLIPSE · IA",
  description:
    "Asistente de IA que responde cualquier pregunta buscando en fuentes fiables: universidades, revistas científicas y organismos oficiales.",
  applicationName: "ECLIPSE",
  creator: "Eclipse",
  publisher: "Eclipse",
  authors: [{ name: "Carlos Lafuente Pueyo" }],
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180" },
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ECLIPSE", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#06070a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
