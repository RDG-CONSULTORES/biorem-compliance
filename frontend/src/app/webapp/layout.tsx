import type { Metadata, Viewport } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Biorem - Web App",
  description: "Mini App de Telegram para Biorem Compliance",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Telegram Web App colores
  themeColor: "#93d500",
};

export default function WebAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Telegram Web App SDK */}
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />

      <div className="min-h-screen bg-background webapp-container">
        {children}
      </div>
    </>
  );
}
