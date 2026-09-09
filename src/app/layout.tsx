import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
