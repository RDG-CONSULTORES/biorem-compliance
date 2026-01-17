"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  User,
  Calendar,
  Brain,
  AlertTriangle,
  Loader2,
  ImageOff,
  ThumbsUp,
  ThumbsDown,
  Package,
  Eye,
  Timer,
} from "lucide-react"
import { complianceService, locationsService, contactsService } from "@/services"
import type { ComplianceRecordWithDetails, Location, Contact } from "@/types"
import { toast } from "sonner"

type ValidationStatus = "validated" | "pending_review" | "rejected"

const statusConfig = {
  validated: { label: "Validado", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  pending_review: { label: "En revisión", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  rejected: { label: "Rechazado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
}

function getValidationStatus(record: ComplianceRecordWithDetails): ValidationStatus {
  if (record.is_valid === true) return "validated"
  if (record.is_valid === false) return "rejected"
  if (record.ai_validated === true && record.ai_confidence && record.ai_confidence >= 0.9) {
    return "validated"
  }
  return "pending_review"
}

export default function ComplianceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const recordId = Number(params.id)

  const [record, setRecord] = useState<ComplianceRecordWithDetails | null>(null)
  const [location, setLocation] = useState<Location | null>(null)
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)

  // Manual validation state
  const [validating, setValidating] = useState(false)
  const [validationNotes, setValidationNotes] = useState("")
  const [showValidationForm, setShowValidationForm] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)

        const recordData = await complianceService.get(recordId)
        setRecord(recordData)

        // Fetch location and contact in parallel
        const [locData, contData] = await Promise.all([
          locationsService.get(recordData.location_id).catch(() => null),
          recordData.contact_id ? contactsService.get(recordData.contact_id).catch(() => null) : null,
        ])

        setLocation(locData)
        setContact(contData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar el registro")
      } finally {
        setLoading(false)
      }
    }

    if (recordId) {
      fetchData()
    }
  }, [recordId])

  const handleValidation = async (isValid: boolean) => {
    if (!record) return

    // For now, use contact ID 1 as validator (TODO: implement auth)
    const validatorId = 1

    try {
      setValidating(true)
      await complianceService.validate(record.id, validatorId, isValid, validationNotes || undefined)
      toast.success(isValid ? "Registro aprobado" : "Registro rechazado")

      // Refresh record
      const updated = await complianceService.get(recordId)
      setRecord(updated)
      setShowValidationForm(false)
      setValidationNotes("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al validar")
    } finally {
      setValidating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/compliance">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Compliance
          </Link>
        </Button>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error || "Registro no encontrado"}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const validationStatus = getValidationStatus(record)
  const status = statusConfig[validationStatus]
  const StatusIcon = status.icon
  const photoUrl = complianceService.getPhotoUrl(record.id)
  const needsManualReview = validationStatus === "pending_review" && !record.manual_validated

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/compliance">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Registro #{record.id}
            </h1>
            <p className="text-muted-foreground">
              {new Date(record.photo_received_at).toLocaleString("es-MX", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </p>
          </div>
        </div>
        <Badge className={status.color} variant="secondary">
          <StatusIcon className="h-4 w-4 mr-1" />
          {status.label}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Photo Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evidencia Fotográfica</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              {imageLoading && !imageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {imageError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                  <ImageOff className="h-12 w-12 mb-2" />
                  <p className="text-sm">No se pudo cargar la imagen</p>
                </div>
              ) : (
                <Image
                  src={photoUrl}
                  alt="Evidencia de compliance"
                  fill
                  className="object-contain"
                  onLoad={() => setImageLoading(false)}
                  onError={() => {
                    setImageError(true)
                    setImageLoading(false)
                  }}
                  unoptimized
                />
              )}
            </div>

            {/* Location info */}
            {record.photo_latitude && record.photo_longitude && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>
                  Ubicación: {record.photo_latitude.toFixed(6)}, {record.photo_longitude.toFixed(6)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details Section */}
        <div className="space-y-6">
          {/* Context Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ubicación</p>
                  <p className="font-medium">{location?.name || "Desconocida"}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contacto</p>
                  <p className="font-medium">{contact?.name || "Sin contacto"}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha de recepción</p>
                  <p className="font-medium">
                    {new Date(record.photo_received_at).toLocaleString("es-MX")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Validation Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Validación IA
              </CardTitle>
              {record.ai_processing_time_ms && (
                <CardDescription className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  Procesado en {record.ai_processing_time_ms}ms
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {record.ai_validated_at ? (
                <>
                  {/* Confidence */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Confianza</span>
                    <span className={`font-bold text-lg ${
                      (record.ai_confidence || 0) >= 0.9 ? 'text-green-600' :
                      (record.ai_confidence || 0) >= 0.7 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {Math.round((record.ai_confidence || 0) * 100)}%
                    </span>
                  </div>

                  <Separator />

                  {/* Detection flags */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Package className={`h-4 w-4 ${record.ai_product_detected ? 'text-green-600' : 'text-red-600'}`} />
                      <span className="text-sm">
                        {record.ai_product_detected ? "Producto detectado" : "Sin producto"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Eye className={`h-4 w-4 ${record.ai_drainage_visible ? 'text-green-600' : 'text-red-600'}`} />
                      <span className="text-sm">
                        {record.ai_drainage_visible ? "Drenaje visible" : "Sin drenaje"}
                      </span>
                    </div>
                  </div>

                  {/* Summary */}
                  {record.ai_summary && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Resumen</p>
                        <p className="text-sm">{record.ai_summary}</p>
                      </div>
                    </>
                  )}

                  {/* Issues */}
                  {record.ai_issues && record.ai_issues.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          Observaciones
                        </p>
                        <ul className="space-y-1">
                          {record.ai_issues.map((issue, i) => (
                            <li key={i} className="text-sm text-yellow-700 dark:text-yellow-400 flex items-start gap-2">
                              <span className="text-yellow-500 mt-1">•</span>
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pendiente de validación automática
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Manual Validation Section */}
      {needsManualReview && (
        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-5 w-5" />
              Requiere Revisión Manual
            </CardTitle>
            <CardDescription>
              La validación automática no alcanzó el umbral de confianza. Revisa la evidencia y decide.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showValidationForm ? (
              <Button onClick={() => setShowValidationForm(true)}>
                Revisar y Validar
              </Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Notas de validación (opcional)
                  </label>
                  <Textarea
                    placeholder="Agrega notas sobre tu decisión..."
                    value={validationNotes}
                    onChange={(e) => setValidationNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleValidation(true)}
                    disabled={validating}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {validating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ThumbsUp className="h-4 w-4 mr-2" />
                    )}
                    Aprobar
                  </Button>
                  <Button
                    onClick={() => handleValidation(false)}
                    disabled={validating}
                    variant="destructive"
                    className="flex-1"
                  >
                    {validating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ThumbsDown className="h-4 w-4 mr-2" />
                    )}
                    Rechazar
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowValidationForm(false)
                    setValidationNotes("")
                  }}
                  className="w-full"
                >
                  Cancelar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual Validation Result */}
      {record.manual_validated !== null && (
        <Card className={record.manual_validated ? "border-green-500/50" : "border-red-500/50"}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {record.manual_validated ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-green-700 dark:text-green-400">Aprobado Manualmente</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-700 dark:text-red-400">Rechazado Manualmente</span>
                </>
              )}
            </CardTitle>
            {record.manual_validated_at && (
              <CardDescription>
                {new Date(record.manual_validated_at).toLocaleString("es-MX")}
              </CardDescription>
            )}
          </CardHeader>
          {record.validation_notes && (
            <CardContent>
              <p className="text-sm">{record.validation_notes}</p>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
