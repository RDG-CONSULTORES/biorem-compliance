"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, CheckCircle2, XCircle, Clock, Image, Loader2, FileImage } from "lucide-react"
import { complianceService, locationsService, contactsService } from "@/services"
import type { ComplianceRecord, Location, Contact } from "@/types"
import type { ComplianceStats } from "@/services/compliance"

type ValidationStatus = "validated" | "pending_review" | "rejected"

const statusConfig = {
  validated: { label: "Validado", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  pending_review: { label: "En revisión", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  rejected: { label: "Rechazado", color: "bg-red-100 text-red-700", icon: XCircle },
}

function getValidationStatus(record: ComplianceRecord): ValidationStatus {
  if (record.is_valid === true) return "validated"
  if (record.is_valid === false) return "rejected"
  // Check AI validation confidence
  if (record.ai_validated === true && record.ai_confidence && record.ai_confidence >= 0.8) {
    return "validated"
  }
  return "pending_review"
}

export default function CompliancePage() {
  const router = useRouter()
  const [records, setRecords] = useState<ComplianceRecord[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [stats, setStats] = useState<ComplianceStats>({
    total: 0,
    validated: 0,
    pending_review: 0,
    rejected: 0,
    validated_by_ai: 0,
    validated_manually: 0,
    validated_this_month: 0,
    rejected_this_month: 0,
    approval_rate: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const handleRowClick = (recordId: number) => {
    router.push(`/compliance/${recordId}`)
  }

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [recordsRes, locationsRes, contactsRes, statsRes] = await Promise.all([
        complianceService.list({ page_size: 100 }),
        locationsService.list({ page_size: 100 }),
        contactsService.list({ page_size: 100 }),
        complianceService.getStats(),
      ])
      setRecords(recordsRes.items)
      setLocations(locationsRes.items)
      setContacts(contactsRes.items)

      // Calculate stats from records if API doesn't provide them
      if (statsRes.total === 0 && recordsRes.items.length > 0) {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const calculated = recordsRes.items.reduce(
          (acc, record) => {
            acc.total++
            const status = getValidationStatus(record)
            const isThisMonth = new Date(record.created_at) >= startOfMonth

            if (status === "validated") {
              acc.validated++
              if (record.ai_validated && record.ai_confidence && record.ai_confidence >= 0.8) {
                acc.validated_by_ai++
              } else if (record.manual_validated) {
                acc.validated_manually++
              }
              if (isThisMonth) acc.validated_this_month++
            } else if (status === "rejected") {
              acc.rejected++
              if (isThisMonth) acc.rejected_this_month++
            } else {
              acc.pending_review++
            }
            return acc
          },
          {
            total: 0,
            validated: 0,
            pending_review: 0,
            rejected: 0,
            validated_by_ai: 0,
            validated_manually: 0,
            validated_this_month: 0,
            rejected_this_month: 0,
            approval_rate: 0,
          }
        )
        // Calculate approval rate
        const reviewed = calculated.validated + calculated.rejected
        calculated.approval_rate = reviewed > 0 ? (calculated.validated / reviewed) * 100 : 0
        setStats(calculated)
      } else {
        setStats(statsRes)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Get location name by ID
  const getLocationName = (locationId: number) => {
    return locations.find(l => l.id === locationId)?.name || "Ubicación desconocida"
  }

  // Get contact name by ID
  const getContactName = (contactId: number | null) => {
    if (!contactId) return "Sin contacto"
    return contacts.find(c => c.id === contactId)?.name || "Contacto desconocido"
  }

  // Filter records
  const filteredRecords = records.filter((record) => {
    const locationName = getLocationName(record.location_id).toLowerCase()
    const contactName = getContactName(record.contact_id).toLowerCase()
    const query = searchQuery.toLowerCase()
    return locationName.includes(query) || contactName.includes(query)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compliance</h1>
        <p className="text-muted-foreground">
          Registros de evidencia y validaciones
        </p>
      </div>

      {/* Error message */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Validados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.validated}</div>
            <p className="text-xs text-muted-foreground">
              {stats.validated_by_ai > 0 && `${stats.validated_by_ai} por IA`}
              {stats.validated_by_ai > 0 && stats.validated_manually > 0 && " · "}
              {stats.validated_manually > 0 && `${stats.validated_manually} manual`}
              {stats.validated_by_ai === 0 && stats.validated_manually === 0 && "Total validados"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Revisión
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending_review}</div>
            <p className="text-xs text-muted-foreground">Requieren atención</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rechazados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">
              {stats.rejected_this_month > 0 ? `${stats.rejected_this_month} este mes` : "Total rechazados"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tasa Aprobación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.approval_rate >= 80 ? 'text-green-600' : stats.approval_rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {stats.approval_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.validated_this_month > 0 ? `+${stats.validated_this_month} este mes` : "Sin datos del mes"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar registros..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && records.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileImage className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No hay registros de compliance
            </p>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Los registros aparecerán cuando los contactos envíen fotos de evidencia vía Telegram
            </p>
          </CardContent>
        </Card>
      )}

      {/* Mobile Cards */}
      {!loading && filteredRecords.length > 0 && (
        <div className="grid gap-4 sm:hidden">
          {filteredRecords.map((record) => {
            const validationStatus = getValidationStatus(record)
            const status = statusConfig[validationStatus]
            const StatusIcon = status.icon

            return (
              <Card
                key={record.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleRowClick(record.id)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Image className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{getLocationName(record.location_id)}</span>
                        <Badge className={status.color} variant="secondary">
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{getContactName(record.contact_id)}</p>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>{new Date(record.photo_received_at).toLocaleString("es-MX", {
                          dateStyle: "short",
                          timeStyle: "short"
                        })}</span>
                      </div>
                      {record.ai_confidence !== null && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Confianza IA:</span>
                            <span className={`font-medium ${record.ai_confidence >= 0.8 ? 'text-green-600' : record.ai_confidence >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {Math.round(record.ai_confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      )}
                      {record.ai_summary && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {record.ai_summary}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Desktop Table */}
      {!loading && filteredRecords.length > 0 && (
        <Card className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ubicación</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-center">Confianza IA</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => {
                const validationStatus = getValidationStatus(record)
                const status = statusConfig[validationStatus]
                const StatusIcon = status.icon

                return (
                  <TableRow
                    key={record.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(record.id)}
                  >
                    <TableCell className="font-medium">{getLocationName(record.location_id)}</TableCell>
                    <TableCell>{getContactName(record.contact_id)}</TableCell>
                    <TableCell>
                      {new Date(record.photo_received_at).toLocaleString("es-MX", {
                        dateStyle: "short",
                        timeStyle: "short"
                      })}
                    </TableCell>
                    <TableCell className="text-center">
                      {record.ai_confidence !== null ? (
                        <span className={`font-medium ${record.ai_confidence >= 0.8 ? 'text-green-600' : record.ai_confidence >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {Math.round(record.ai_confidence * 100)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={status.color} variant="secondary">
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
