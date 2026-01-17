"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Building2,
  Users,
  MapPin,
  ClipboardCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  TrendingUp,
  BarChart3,
  ArrowRight,
} from "lucide-react"
import { clientsService, contactsService, locationsService, complianceService, reportsService } from "@/services"
import type { Client, Contact, Location, ComplianceRecord, PeriodPreset, ReportSummary } from "@/types"

const periodOptions: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "this_week", label: "Esta semana" },
  { value: "this_month", label: "Este mes" },
  { value: "last_7_days", label: "Últimos 7 días" },
  { value: "last_30_days", label: "Últimos 30 días" },
]

interface DashboardStats {
  clients: { total: number; active: number }
  contacts: { total: number; linked: number }
  locations: { total: number; active: number }
  compliance: { rate: number; validated: number; pending: number; rejected: number }
}

interface RecentActivity {
  id: number
  type: "success" | "pending" | "warning"
  message: string
  detail: string
  time: string
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "Ahora"
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`
  return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<PeriodPreset>("this_month")
  const [stats, setStats] = useState<DashboardStats>({
    clients: { total: 0, active: 0 },
    contacts: { total: 0, linked: 0 },
    locations: { total: 0, active: 0 },
    compliance: { rate: 0, validated: 0, pending: 0, rejected: 0 },
  })
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [clientsRes, contactsRes, locationsRes, complianceRes, summaryRes] = await Promise.all([
          clientsService.list({ page_size: 100 }),
          contactsService.list({ page_size: 100 }),
          locationsService.list({ page_size: 100 }),
          complianceService.list({ page_size: 100 }),
          reportsService.getSummary({ period }),
        ])

        // Calculate stats
        const clients = clientsRes.items as Client[]
        const contacts = contactsRes.items as Contact[]
        const locations = locationsRes.items as Location[]
        const compliance = complianceRes.items as ComplianceRecord[]

        const activeClients = clients.filter(c => c.active).length
        const linkedContacts = contacts.filter(c => c.telegram_id).length
        const activeLocations = locations.filter(l => l.active).length

        setStats({
          clients: { total: clients.length, active: activeClients },
          contacts: { total: contacts.length, linked: linkedContacts },
          locations: { total: locations.length, active: activeLocations },
          compliance: {
            rate: summaryRes.compliance_rate,
            validated: summaryRes.validated,
            pending: summaryRes.pending_review,
            rejected: summaryRes.rejected,
          },
        })

        setReportSummary(summaryRes)

        // Build recent activity from compliance records
        const activities: RecentActivity[] = compliance
          .sort((a, b) => new Date(b.photo_received_at).getTime() - new Date(a.photo_received_at).getTime())
          .slice(0, 5)
          .map((record) => {
            const location = locations.find(l => l.id === record.location_id)
            const client = clients.find(c => c.id === location?.client_id)
            const locationName = location?.name || "Ubicación"
            const clientName = client?.name || "Cliente"

            let type: "success" | "pending" | "warning" = "pending"
            let detail = "Esperando validación"

            if (record.is_valid === true || (record.ai_validated && record.ai_confidence && record.ai_confidence >= 0.8)) {
              type = "success"
              detail = "Validación exitosa"
            } else if (record.is_valid === false) {
              type = "warning"
              detail = "Rechazado"
            } else if (record.ai_confidence && record.ai_confidence < 0.5) {
              type = "warning"
              detail = "Requiere revisión manual"
            }

            return {
              id: record.id,
              type,
              message: `${clientName} - ${locationName}`,
              detail,
              time: getTimeAgo(new Date(record.photo_received_at)),
            }
          })

        setRecentActivity(activities)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar datos")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [period])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const statsCards = [
    {
      title: "Clientes",
      value: stats.clients.total.toString(),
      description: "Total registrados",
      icon: Building2,
      trend: `${stats.clients.active} activos`,
    },
    {
      title: "Contactos",
      value: stats.contacts.total.toString(),
      description: "Total registrados",
      icon: Users,
      trend: `${stats.contacts.linked} vinculados a Telegram`,
      trendIcon: MessageCircle,
    },
    {
      title: "Ubicaciones",
      value: stats.locations.total.toString(),
      description: "Puntos de aplicación",
      icon: MapPin,
      trend: `${stats.locations.active} activas`,
    },
    {
      title: "Compliance",
      value: `${stats.compliance.rate}%`,
      description: "Tasa de cumplimiento",
      icon: ClipboardCheck,
      trend: `${stats.compliance.validated} validados`,
      trendColor: stats.compliance.rate >= 80 ? "text-green-500" : stats.compliance.rate >= 60 ? "text-yellow-500" : "text-red-500",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen general del sistema de compliance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" asChild>
            <Link href="/reports">
              <BarChart3 className="h-4 w-4 mr-2" />
              Ver Reportes
            </Link>
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
              <div className="flex items-center gap-1 mt-2">
                {stat.trendIcon ? (
                  <stat.trendIcon className="h-3 w-3 text-blue-500" />
                ) : (
                  <CheckCircle2 className={`h-3 w-3 ${stat.trendColor || 'text-green-500'}`} />
                )}
                <span className="text-xs text-muted-foreground">{stat.trend}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Compliance Summary Card */}
      {reportSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Resumen de Compliance
            </CardTitle>
            <CardDescription>
              Métricas del período seleccionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Validados</span>
                </div>
                <p className="text-2xl font-bold mt-1">{reportSummary.validated}</p>
              </div>
              <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">En Revisión</span>
                </div>
                <p className="text-2xl font-bold mt-1">{reportSummary.pending_review}</p>
              </div>
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Rechazados</span>
                </div>
                <p className="text-2xl font-bold mt-1">{reportSummary.rejected}</p>
              </div>
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Tiempo Respuesta</span>
                </div>
                <p className="text-2xl font-bold mt-1">{reportSummary.avg_response_time_hours}h</p>
              </div>
            </div>
            {reportSummary.locations_with_issues > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  <span className="text-sm text-orange-700 dark:text-orange-400">
                    {reportSummary.locations_with_issues} ubicaciones requieren atención
                  </span>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/reports">
                    Ver detalles
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>
            Últimas validaciones y alertas del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Clock className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No hay actividad reciente</p>
              <p className="text-xs text-muted-foreground mt-1">
                La actividad aparecerá cuando se reciban fotos de compliance
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <Link
                  key={activity.id}
                  href={`/compliance/${activity.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  {activity.type === "success" && (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  )}
                  {activity.type === "pending" && (
                    <Clock className="h-5 w-5 text-yellow-500 shrink-0" />
                  )}
                  {activity.type === "warning" && (
                    <AlertCircle className="h-5 w-5 text-orange-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {activity.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.detail}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {activity.time}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
