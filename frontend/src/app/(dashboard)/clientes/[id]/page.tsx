"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Building2,
  MapPin,
  Users,
  Phone,
  Mail,
  Clock,
  Loader2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
} from "lucide-react"
import { toast } from "sonner"
import { clientsService, contactsService, locationsService } from "@/services"
import type { Client, Contact, Location } from "@/types"

const businessTypeLabels: Record<string, string> = {
  plaza: "Plaza",
  casino: "Casino",
  supermercado: "Supermercado",
  hotel: "Hotel",
  restaurante: "Restaurante",
  hospital: "Hospital",
  otro: "Otro",
}

type ComplianceStatus = "ok" | "pending" | "overdue"

const statusConfig = {
  ok: { label: "Al día", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  overdue: { label: "Vencido", color: "bg-red-100 text-red-700", icon: AlertCircle },
}

function getComplianceStatus(location: Location): ComplianceStatus {
  if (!location.last_compliance_at) return "pending"

  const lastCompliance = new Date(location.last_compliance_at)
  const now = new Date()
  const daysSinceCompliance = Math.floor((now.getTime() - lastCompliance.getTime()) / (1000 * 60 * 60 * 24))

  if (daysSinceCompliance <= location.frequency_days) return "ok"
  if (daysSinceCompliance <= location.frequency_days + 2) return "pending"
  return "overdue"
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = Number(params.id)

  const [client, setClient] = useState<Client | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [clientData, contactsData, locationsData] = await Promise.all([
          clientsService.get(clientId),
          contactsService.list({ client_id: clientId, page_size: 100 }),
          locationsService.list({ client_id: clientId, page_size: 100 }),
        ])
        setClient(clientData)
        setContacts(contactsData.items)
        setLocations(locationsData.items)
      } catch (err) {
        toast.error("Error al cargar cliente")
        router.push("/clientes")
      } finally {
        setLoading(false)
      }
    }

    if (clientId) {
      fetchData()
    }
  }, [clientId, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cliente no encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/clientes")}>
          Volver a clientes
        </Button>
      </div>
    )
  }

  const linkedContacts = contacts.filter(c => c.telegram_id)
  const pendingContacts = contacts.filter(c => !c.telegram_id)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/clientes")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
              <Badge variant={client.active ? "default" : "secondary"}>
                {client.active ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <Building2 className="h-4 w-4" />
              <span>{businessTypeLabels[client.business_type] || "Otro"}</span>
              {client.city && (
                <>
                  <span>•</span>
                  <MapPin className="h-4 w-4" />
                  <span>{client.city}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Link href={`/clientes`}>
          <Button variant="outline">
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{contacts.length}</p>
                <p className="text-sm text-muted-foreground">Contactos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{locations.length}</p>
                <p className="text-sm text-muted-foreground">Ubicaciones</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100">
                <MessageCircle className="h-6 w-6 text-green-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{linkedContacts.length}</p>
                <p className="text-sm text-muted-foreground">Vinculados a Telegram</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Details */}
      <Card>
        <CardHeader>
          <CardTitle>Información de contacto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{client.phone}</p>
                </div>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{client.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Hora de recordatorio</p>
                <p className="font-medium">{client.default_reminder_time}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Frecuencia</p>
                <p className="font-medium">Cada {client.default_frequency_days} días</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Contactos ({contacts.length})</CardTitle>
          <Link href="/contactos">
            <Button size="sm">Ver todos</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay contactos registrados
            </p>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {contact.telegram_id ? (
                      <Badge variant="default" className="bg-green-100 text-green-700">
                        <MessageCircle className="h-3 w-3 mr-1" />
                        Vinculado
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Pendiente
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Locations Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Ubicaciones ({locations.length})</CardTitle>
          <Link href="/ubicaciones">
            <Button size="sm">Ver todas</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay ubicaciones registradas
            </p>
          ) : (
            <div className="space-y-3">
              {locations.map((location) => {
                const complianceStatus = getComplianceStatus(location)
                const status = statusConfig[complianceStatus]
                const StatusIcon = status.icon

                return (
                  <div
                    key={location.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{location.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {location.code ? `${location.code} • ` : ""}
                          Cada {location.frequency_days} días
                        </p>
                      </div>
                    </div>
                    <Badge className={status.color} variant="secondary">
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
