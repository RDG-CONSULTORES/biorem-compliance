"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, User, MapPin, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getTelegramWebApp,
  getTelegramUser,
  setupBackButton,
  hideBackButton,
} from "@/lib/telegram";

interface UserProfile {
  telegram_id: number;
  telegram_name: string;
  contact_name?: string;
  client_name?: string;
  locations_count?: number;
}

export default function PerfilPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (tg) {
      tg.ready();
      tg.expand();

      // Configurar botón de retroceso
      setupBackButton(() => {
        window.history.back();
      });

      // Obtener info del usuario
      const user = getTelegramUser();
      if (user) {
        setProfile({
          telegram_id: user.id,
          telegram_name: `${user.first_name}${user.last_name ? ` ${user.last_name}` : ""}`,
        });

        // TODO: Cargar datos adicionales del API
        // fetchUserContext(user.id);
      }

      setLoading(false);
    }

    return () => {
      hideBackButton();
    };
  }, []);

  const handleBack = () => {
    window.history.back();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
          <h1 className="text-xl font-bold">Mi Perfil</h1>
          <p className="text-sm text-muted-foreground">
            Información y estadísticas
          </p>
        </div>
      </header>

      {/* Profile Card */}
      <div className="bg-card border rounded-xl p-6 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#93d500] to-[#0083ad] flex items-center justify-center">
            <User className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {profile?.telegram_name || "Usuario"}
            </h2>
            <p className="text-sm text-muted-foreground">
              ID: {profile?.telegram_id}
            </p>
          </div>
        </div>

        {profile?.contact_name && (
          <div className="flex items-center gap-2 text-sm py-2 border-t">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>Contacto: {profile.contact_name}</span>
          </div>
        )}

        {profile?.client_name && (
          <div className="flex items-center gap-2 text-sm py-2 border-t">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>Cliente: {profile.client_name}</span>
          </div>
        )}

        {profile?.locations_count !== undefined && (
          <div className="flex items-center gap-2 text-sm py-2 border-t">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>Ubicaciones: {profile.locations_count}</span>
          </div>
        )}
      </div>

      {/* Stats placeholder */}
      <div className="bg-card border rounded-xl p-4">
        <h3 className="font-medium mb-3">Estadísticas</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-primary">--</p>
            <p className="text-xs text-muted-foreground">Fotos enviadas</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">--</p>
            <p className="text-xs text-muted-foreground">Score promedio</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">--</p>
            <p className="text-xs text-muted-foreground">Evaluaciones</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">--</p>
            <p className="text-xs text-muted-foreground">Pedidos</p>
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-3">
          Estadísticas disponibles próximamente
        </p>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-muted-foreground mt-auto pt-4">
        <p>Biorem Compliance v2.0</p>
      </footer>
    </div>
  );
}
