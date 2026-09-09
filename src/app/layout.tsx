import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ECLIPSE · IA",
  description:
    "Asistente de IA que responde cualquier pregunta buscando en fuentes fiables: universidades, revistas científicas y organismos oficiales.",
  applicationName: "ECLIPSE",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
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
