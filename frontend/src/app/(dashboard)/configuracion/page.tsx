"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Settings,
  Bell,
  Clock,
  Info,
  Server,
  Smartphone,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

export default function ConfiguracionPage() {
  const [saving, setSaving] = useState(false)

  // Default settings (these could be loaded from an API)
  const [settings, setSettings] = useState({
    defaultReminderTime: "09:00",
    defaultFrequencyDays: 7,
    escalationMinutes: 30,
    timezone: "America/Mexico_City",
  })

  const handleSave = async () => {
    try {
      setSaving(true)
      // Simulate save - in a real app, this would call an API
      await new Promise(resolve => setTimeout(resolve, 500))
      toast.success("Configuración guardada correctamente")
    } catch (err) {
      toast.error("Error al guardar configuración")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Ajustes del sistema Biorem Compliance
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Default Reminder Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Recordatorios por defecto</CardTitle>
            </div>
            <CardDescription>
              Valores predeterminados para nuevas ubicaciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="defaultTime">Hora de recordatorio</Label>
              <Input
                id="defaultTime"
                type="time"
                value={settings.defaultReminderTime}
                onChange={(e) => setSettings({ ...settings, defaultReminderTime: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Hora predeterminada para enviar recordatorios
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="defaultFrequency">Frecuencia (días)</Label>
              <Input
                id="defaultFrequency"
                type="number"
                min="1"
                value={settings.defaultFrequencyDays}
                onChange={(e) => setSettings({ ...settings, defaultFrequencyDays: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Cada cuántos días se envía un recordatorio
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="escalation">Tiempo de escalamiento (minutos)</Label>
              <Input
                id="escalation"
                type="number"
                min="5"
                value={settings.escalationMinutes}
                onChange={(e) => setSettings({ ...settings, escalationMinutes: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Tiempo antes de escalar a supervisor si no hay respuesta
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar cambios
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Notificaciones</CardTitle>
            </div>
            <CardDescription>
              Configuración del bot de Telegram
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Bot de Telegram</p>
                  <p className="text-xs text-muted-foreground">@BioremComplianceBot</p>
                </div>
              </div>
              <Badge variant="default" className="bg-green-100 text-green-700">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Activo
              </Badge>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Recordatorios automáticos</span>
                <Badge variant="secondary">Habilitado</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Validación con IA</span>
                <Badge variant="secondary">Habilitado</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Escalamiento automático</span>
                <Badge variant="secondary">Habilitado</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Información del sistema</CardTitle>
            </div>
            <CardDescription>
              Detalles de la configuración actual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Server className="h-4 w-4" />
                  Versión
                </div>
                <p className="text-lg font-semibold">1.0.0</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  Zona horaria
                </div>
                <p className="text-lg font-semibold">{settings.timezone}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Bell className="h-4 w-4" />
                  Recordatorios hoy
                </div>
                <p className="text-lg font-semibold">-</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Settings className="h-4 w-4" />
                  Entorno
                </div>
                <p className="text-lg font-semibold">Producción</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Ayuda y soporte</CardTitle>
            <CardDescription>
              Recursos para utilizar el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                <h3 className="font-medium mb-1">Cómo vincular Telegram</h3>
                <p className="text-sm text-muted-foreground">
                  Guía para conectar contactos al bot
                </p>
              </div>
              <div className="p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                <h3 className="font-medium mb-1">Configurar recordatorios</h3>
                <p className="text-sm text-muted-foreground">
                  Aprende a programar alertas
                </p>
              </div>
              <div className="p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                <h3 className="font-medium mb-1">Reportes de compliance</h3>
                <p className="text-sm text-muted-foreground">
                  Generar y exportar reportes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
