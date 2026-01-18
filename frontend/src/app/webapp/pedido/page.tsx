"use client";

import { useEffect } from "react";
import { ArrowLeft, Package, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getTelegramWebApp,
  setupBackButton,
  hideBackButton,
} from "@/lib/telegram";

export default function PedidoPage() {
  useEffect(() => {
    const tg = getTelegramWebApp();
    if (tg) {
      tg.ready();
      tg.expand();

      // Configurar botón de retroceso
      setupBackButton(() => {
        window.history.back();
      });
    }

    return () => {
      hideBackButton();
    };
  }, []);

  const handleBack = () => {
    window.history.back();
  };

  return (
    <div className="flex flex-col min-h-screen p-4">
      {/* Header */}
      <header className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Pedir Producto</h1>
          <p className="text-sm text-muted-foreground">
            Solicitud con firma de autorización
          </p>
        </div>
      </header>

      {/* Coming Soon Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
          <Construction className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>

        <h2 className="text-lg font-semibold mb-2">En Desarrollo</h2>

        <p className="text-muted-foreground mb-6 max-w-xs">
          El módulo de pre-órdenes estará disponible próximamente.
          Podrás solicitar productos con firma de autorización.
        </p>

        <div className="bg-card border rounded-lg p-4 text-left w-full max-w-sm">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Características:
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Catálogo de productos</li>
            <li>• Selección de cantidades</li>
            <li>• Firma de autorización</li>
            <li>• Notificación a admin</li>
            <li>• Seguimiento del pedido</li>
          </ul>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-muted-foreground pt-4">
        <p>Fase 5 del Bot v2.0</p>
      </footer>
    </div>
  );
}
