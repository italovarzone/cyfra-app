import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Cyfra",
  description: "Busque e toque cifras do CifraClub. Simples e offline.",
  manifest: "/manifest.webmanifest",
  applicationName: "Cyfra",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cyfra",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1115",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-bg text-[#e7e9ee] antialiased">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
