"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Package, User, Loader2 } from "lucide-react";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface WebAppData {
  user: TelegramUser | null;
  isReady: boolean;
  colorScheme: "light" | "dark";
}

export default function WebAppHome() {
  const [webApp, setWebApp] = useState<WebAppData>({
    user: null,
    isReady: false,
    colorScheme: "light",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Esperar a que Telegram SDK esté listo
    const initWebApp = () => {
      try {
        const tg = (window as any).Telegram?.WebApp;

        if (!tg) {
          setError("Esta app debe abrirse desde Telegram");
          return;
        }

        // Notificar a Telegram que la app está lista
        tg.ready();

        // Expandir a pantalla completa
        tg.expand();

        // Obtener datos del usuario
        const user = tg.initDataUnsafe?.user;

        setWebApp({
          user: user || null,
          isReady: true,
          colorScheme: tg.colorScheme || "light",
        });

        // Configurar el botón principal (opcional)
        tg.MainButton.hide();

        // Habilitar botón de cerrar
        tg.BackButton.hide();
      } catch (err) {
        console.error("Error initializing Telegram WebApp:", err);
        setError("Error al inicializar la app");
      }
    };

    // Pequeño delay para asegurar que el SDK esté cargado
    const timer = setTimeout(initWebApp, 100);
    return () => clearTimeout(timer);
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-xl font-semibold mb-2">Error</h1>
        <p className="text-muted-foreground">{error}</p>
        <p className="text-sm text-muted-foreground mt-4">
          Abre esta app desde el bot de Telegram @BioremComplianceBot
        </p>
      </div>
    );
  }

  if (!webApp.isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-4">
      {/* Header */}
      <header className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#93d500] to-[#0083ad] flex items-center justify-center">
          <span className="text-3xl">🌀</span>
        </div>
        <h1 className="text-2xl font-bold">Biorem</h1>
        {webApp.user && (
          <p className="text-muted-foreground mt-1">
            Hola, {webApp.user.first_name}
          </p>
        )}
      </header>

      {/* Menu Options */}
      <nav className="flex-1 space-y-3">
        <Link
          href="/webapp/evaluacion"
          className="flex items-center gap-4 p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <ClipboardCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Autoevaluación</h2>
            <p className="text-sm text-muted-foreground">
              Realiza una inspección con fotos y firma
            </p>
          </div>
          <span className="text-muted-foreground">→</span>
        </Link>

        <Link
          href="/webapp/pedido"
          className="flex items-center gap-4 p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Package className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Pedir Producto</h2>
            <p className="text-sm text-muted-foreground">
              Solicita productos con firma de autorización
            </p>
          </div>
          <span className="text-muted-foreground">→</span>
        </Link>

        <Link
          href="/webapp/perfil"
          className="flex items-center gap-4 p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <User className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Mi Perfil</h2>
            <p className="text-sm text-muted-foreground">
              Ve tu información y estadísticas
            </p>
          </div>
          <span className="text-muted-foreground">→</span>
        </Link>
      </nav>

      {/* Footer */}
      <footer className="text-center text-xs text-muted-foreground mt-8 pb-4">
        <p>Biorem Compliance v2.0</p>
        <p className="mt-1">
          {webApp.user?.id && `ID: ${webApp.user.id}`}
        </p>
      </footer>
    </div>
  );
}
