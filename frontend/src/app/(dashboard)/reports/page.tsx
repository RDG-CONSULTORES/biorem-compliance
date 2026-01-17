"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Building2,
  MapPin,
  AlertTriangle,
  Loader2,
  BarChart3,
  FileDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { reportsService, clientsService } from "@/services"
import type {
  PeriodPreset,
  ReportSummary,
  ClientComplianceReport,
  LocationComplianceReport,
  ComplianceTrend,
  Client,
} from "@/types"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { generateCompliancePDF } from "@/components/reports/compliance-pdf"
import { toast } from "sonner"

const periodOptions: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "this_week", label: "Esta semana" },
  { value: "this_month", label: "Este mes" },
  { value: "last_7_days", label: "Últimos 7 días" },
  { value: "last_30_days", label: "Últimos 30 días" },
  { value: "last_90_days", label: "Últimos 90 días" },
]

const statusConfig = {
  ok: { label: "OK", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  overdue: { label: "Atrasado", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  critical: { label: "Crítico", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<PeriodPreset>("this_month")
  const [clientId, setClientId] = useState<number | undefined>(undefined)
  const [clients, setClients] = useState<Client[]>([])

  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [clientReports, setClientReports] = useState<ClientComplianceReport[]>([])
  const [locationReports, setLocationReports] = useState<LocationComplianceReport[]>([])
  const [trends, setTrends] = useState<ComplianceTrend[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch clients for filter
  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await clientsService.list({ page_size: 100 })
        setClients(res.items.filter(c => c.active))
      } catch (err) {
        console.error("Error loading clients:", err)
      }
    }
    fetchClients()
  }, [])

  // Fetch report data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)

        const params = { period, client_id: clientId }

        const [summaryData, clientData, locationData, trendsData] = await Promise.all([
          reportsService.getSummary(params),
          reportsService.getByClient({ period }),
          reportsService.getByLocation(params),
          reportsService.getTrends({ ...params, group_by: period === "today" ? "day" : period === "this_week" || period === "last_7_days" ? "day" : "week" }),
        ])

        setSummary(summaryData)
        setClientReports(clientData)
        setLocationReports(locationData)
        setTrends(trendsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar reportes")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [period, clientId])

  const [exporting, setExporting] = useState(false)

  const handleExportPDF = async () => {
    if (!summary) return

    try {
      setExporting(true)
      const periodLabel = periodOptions.find(p => p.value === period)?.label || period
      const selectedClient = clients.find(c => c.id === clientId)

      await generateCompliancePDF({
        summary,
        clientReports,
        locationReports,
        periodLabel,
        clientName: selectedClient?.name,
      })

      toast.success("PDF generado correctamente")
    } catch (err) {
      console.error("Error generating PDF:", err)
      toast.error("Error al generar el PDF")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
          <p className="text-muted-foreground">
            Análisis de cumplimiento y tendencias
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={clientId?.toString() || "all"}
            onValueChange={(v) => setClientId(v === "all" ? undefined : Number(v))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos los clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id.toString()}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
            <SelectTrigger className="w-[180px]">
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
          <Button variant="outline" onClick={handleExportPDF} disabled={exporting || !summary}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            {exporting ? "Generando..." : "PDF"}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && summary && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Tasa de Cumplimiento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${summary.compliance_rate >= 80 ? 'text-green-600' : summary.compliance_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {summary.compliance_rate}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.validated} validados de {summary.total_records}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Registros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{summary.total_records}</div>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {summary.validated}
                  </span>
                  <span className="text-yellow-600 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {summary.pending_review}
                  </span>
                  <span className="text-red-600 flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> {summary.rejected}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Tiempo de Respuesta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{summary.avg_response_time_hours}h</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Promedio desde recordatorio
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Ubicaciones con Problemas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${summary.locations_with_issues > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {summary.locations_with_issues}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  de {summary.total_locations} ubicaciones
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Trends Chart */}
          {trends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tendencia de Cumplimiento</CardTitle>
                <CardDescription>Tasa de cumplimiento por período</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="period_label"
                        className="text-xs"
                        tick={{ fill: 'currentColor' }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        className="text-xs"
                        tick={{ fill: 'currentColor' }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value) => [`${value}%`, 'Cumplimiento']}
                      />
                      <Line
                        type="monotone"
                        dataKey="compliance_rate"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Two Column Layout */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* By Client */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Por Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clientReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay datos para el período seleccionado
                  </p>
                ) : (
                  <div className="space-y-3">
                    {clientReports.slice(0, 5).map((client) => (
                      <div key={client.client_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{client.client_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {client.total_locations} ubicaciones · {client.total_records} registros
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-lg font-bold ${client.compliance_rate >= 80 ? 'text-green-600' : client.compliance_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {client.compliance_rate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* By Location */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Ubicaciones Críticas
                </CardTitle>
                <CardDescription>Ubicaciones que requieren atención</CardDescription>
              </CardHeader>
              <CardContent>
                {locationReports.filter(l => l.status !== "ok").length === 0 ? (
                  <div className="text-center py-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Todas las ubicaciones están al día
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {locationReports.filter(l => l.status !== "ok").slice(0, 5).map((loc) => (
                      <div key={loc.location_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{loc.location_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {loc.client_name} · {loc.days_since_compliance !== null ? `${loc.days_since_compliance} días` : "Sin registros"}
                          </p>
                        </div>
                        <Badge className={statusConfig[loc.status].color} variant="secondary">
                          {statusConfig[loc.status].label}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Full Location Table */}
          <Card className="hidden lg:block">
            <CardHeader>
              <CardTitle className="text-lg">Todas las Ubicaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-center">Registros</TableHead>
                    <TableHead className="text-center">Cumplimiento</TableHead>
                    <TableHead className="text-center">Último</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationReports.map((loc) => (
                    <TableRow key={loc.location_id}>
                      <TableCell className="font-medium">{loc.location_name}</TableCell>
                      <TableCell>{loc.client_name}</TableCell>
                      <TableCell className="text-center">{loc.total_records}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-medium ${loc.compliance_rate >= 80 ? 'text-green-600' : loc.compliance_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {loc.compliance_rate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {loc.last_compliance_at
                          ? new Date(loc.last_compliance_at).toLocaleDateString("es-MX")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={statusConfig[loc.status].color} variant="secondary">
                          {statusConfig[loc.status].label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
