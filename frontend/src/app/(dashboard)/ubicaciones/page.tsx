"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Search, MapPin, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { locationsService, clientsService, productsService } from "@/services"
import type { Location, LocationCreate, Client, Product } from "@/types"

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

export default function UbicacionesPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState<LocationCreate>({
    client_id: 0,
    name: "",
    code: "",
    description: "",
    address: "",
    city: "",
    product_id: undefined,
    frequency_days: 7,
    reminder_time: "09:00",
  })

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [locationsRes, clientsRes, productsRes] = await Promise.all([
        locationsService.list({ search: searchQuery || undefined, page_size: 100 }),
        clientsService.list({ page_size: 100 }),
        productsService.list({ page_size: 100 }),
      ])
      setLocations(locationsRes.items)
      setClients(clientsRes.items)
      setProducts(productsRes.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Handle form submit
  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.client_id) return

    try {
      setSaving(true)
      await locationsService.create(formData)
      setIsDialogOpen(false)
      setFormData({
        client_id: 0,
        name: "",
        code: "",
        description: "",
        address: "",
        city: "",
        product_id: undefined,
        frequency_days: 7,
        reminder_time: "09:00",
      })
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear ubicación")
    } finally {
      setSaving(false)
    }
  }

  // Get client name by ID
  const getClientName = (clientId: number) => {
    return clients.find(c => c.id === clientId)?.name || "Cliente desconocido"
  }

  // Get product name by ID
  const getProductName = (productId: number | null) => {
    if (!productId) return "Sin producto"
    return products.find(p => p.id === productId)?.name || "Producto desconocido"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ubicaciones</h1>
          <p className="text-muted-foreground">
            Puntos de aplicación de productos
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Ubicación
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nueva Ubicación</DialogTitle>
              <DialogDescription>
                Agrega un punto de aplicación
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid gap-2">
                <Label htmlFor="client">Cliente *</Label>
                <select
                  id="client"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: Number(e.target.value) })}
                >
                  <option value={0}>Seleccionar cliente...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  placeholder="Ej: Cocina Principal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  placeholder="Ej: COC-01"
                  value={formData.code || ""}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product">Producto</Label>
                <select
                  id="product"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={formData.product_id || ""}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">Sin producto asignado</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="frequency">Frecuencia (días)</Label>
                  <Input
                    id="frequency"
                    type="number"
                    min="1"
                    value={formData.frequency_days || 7}
                    onChange={(e) => setFormData({ ...formData, frequency_days: Number(e.target.value) })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reminder_time">Hora recordatorio</Label>
                  <Input
                    id="reminder_time"
                    type="time"
                    value={formData.reminder_time || "09:00"}
                    onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  placeholder="Dirección completa"
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input
                  id="city"
                  placeholder="Ciudad"
                  value={formData.city || ""}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !formData.name.trim() || !formData.client_id}
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error message */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar ubicaciones..."
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
      {!loading && locations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {searchQuery ? "No se encontraron ubicaciones" : "No hay ubicaciones registradas"}
            </p>
            {!searchQuery && clients.length > 0 && (
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar primera ubicación
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Location Cards */}
      {!loading && locations.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => {
            const complianceStatus = getComplianceStatus(location)
            const status = statusConfig[complianceStatus]
            const StatusIcon = status.icon

            return (
              <Card key={location.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{location.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {getClientName(location.client_id)}
                        </p>
                      </div>
                    </div>
                    <Badge className={status.color} variant="secondary">
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Producto:</span>
                      <span className="font-medium">{getProductName(location.product_id)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frecuencia:</span>
                      <span>Cada {location.frequency_days} días</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Última aplicación:</span>
                      <span>
                        {location.last_compliance_at
                          ? new Date(location.last_compliance_at).toLocaleDateString("es-MX")
                          : "Sin registro"}
                      </span>
                    </div>
                    {location.city && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ciudad:</span>
                        <span>{location.city}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
