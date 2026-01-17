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
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Plus,
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Power,
  Send,
  Calendar,
} from "lucide-react"
import { toast } from "sonner"
import { locationsService, clientsService, productsService, contactsService, complianceService } from "@/services"
import type { Location, LocationCreate, LocationUpdate, Client, Product, Contact } from "@/types"

type ComplianceStatus = "ok" | "pending" | "overdue"

const statusConfig = {
  ok: { label: "Al día", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  overdue: { label: "Vencido", color: "bg-red-100 text-red-700", icon: AlertCircle },
}

// Days of week configuration (1=Lunes, 7=Domingo - matches backend)
const daysOfWeek = [
  { value: "1", label: "L", fullLabel: "Lunes" },
  { value: "2", label: "M", fullLabel: "Martes" },
  { value: "3", label: "Mi", fullLabel: "Miércoles" },
  { value: "4", label: "J", fullLabel: "Jueves" },
  { value: "5", label: "V", fullLabel: "Viernes" },
  { value: "6", label: "S", fullLabel: "Sábado" },
  { value: "7", label: "D", fullLabel: "Domingo" },
]

function getComplianceStatus(location: Location): ComplianceStatus {
  if (!location.last_compliance_at) return "pending"

  const lastCompliance = new Date(location.last_compliance_at)
  const now = new Date()
  const daysSinceCompliance = Math.floor((now.getTime() - lastCompliance.getTime()) / (1000 * 60 * 60 * 24))

  if (daysSinceCompliance <= location.frequency_days) return "ok"
  if (daysSinceCompliance <= location.frequency_days + 2) return "pending"
  return "overdue"
}

function parseDays(daysString: string | null): string[] {
  if (!daysString) return ["1", "2", "3", "4", "5"] // Default: weekdays
  return daysString.split(",").filter(Boolean)
}

function formatDays(days: string[]): string {
  return days.join(",")
}

function getDaysLabel(daysString: string | null): string {
  const days = parseDays(daysString)
  if (days.length === 7) return "Todos los días"
  if (days.length === 5 && ["1", "2", "3", "4", "5"].every(d => days.includes(d))) return "L-V"
  return days.map(d => daysOfWeek.find(dw => dw.value === d)?.label).filter(Boolean).join(", ")
}

export default function UbicacionesPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(null)
  const [reminderLocation, setReminderLocation] = useState<Location | null>(null)
  const [selectedContactId, setSelectedContactId] = useState<number>(0)
  const [sendingReminder, setSendingReminder] = useState(false)

  // Form state
  const [formData, setFormData] = useState<LocationCreate & { selectedDays: string[] }>({
    client_id: 0,
    name: "",
    code: "",
    description: "",
    address: "",
    city: "",
    product_id: undefined,
    frequency_days: 7,
    reminder_time: "09:00",
    reminder_days: "1,2,3,4,5",
    selectedDays: ["1", "2", "3", "4", "5"],
  })

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true)
      const [locationsRes, clientsRes, productsRes, contactsRes] = await Promise.all([
        locationsService.list({ search: searchQuery || undefined, page_size: 100 }),
        clientsService.list({ page_size: 100 }),
        productsService.list({ page_size: 100 }),
        contactsService.list({ page_size: 100 }),
      ])
      setLocations(locationsRes.items)
      setClients(clientsRes.items)
      setProducts(productsRes.items)
      setContacts(contactsRes.items.filter(c => c.telegram_id)) // Only linked contacts
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar datos")
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

  // Open dialog for create
  const handleCreate = () => {
    setEditingLocation(null)
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
      reminder_days: "1,2,3,4,5",
      selectedDays: ["1", "2", "3", "4", "5"],
    })
    setIsDialogOpen(true)
  }

  // Open dialog for edit
  const handleEdit = (location: Location) => {
    setEditingLocation(location)
    const selectedDays = parseDays(location.reminder_days)
    setFormData({
      client_id: location.client_id,
      name: location.name,
      code: location.code || "",
      description: location.description || "",
      address: location.address || "",
      city: location.city || "",
      product_id: location.product_id || undefined,
      frequency_days: location.frequency_days,
      reminder_time: location.reminder_time,
      reminder_days: location.reminder_days,
      selectedDays,
    })
    setIsDialogOpen(true)
  }

  // Handle form submit
  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.client_id) return

    try {
      setSaving(true)

      const dataToSend = {
        ...formData,
        reminder_days: formatDays(formData.selectedDays),
      }
      // Remove selectedDays from payload
      const { selectedDays, ...payload } = dataToSend

      if (editingLocation) {
        const updateData: LocationUpdate = {
          name: payload.name,
          code: payload.code || undefined,
          description: payload.description || undefined,
          address: payload.address || undefined,
          city: payload.city || undefined,
          product_id: payload.product_id,
          frequency_days: payload.frequency_days,
          reminder_time: payload.reminder_time,
          reminder_days: payload.reminder_days,
        }
        await locationsService.update(editingLocation.id, updateData)
        toast.success("Ubicación actualizada correctamente")
      } else {
        await locationsService.create(payload)
        toast.success("Ubicación creada correctamente")
      }

      setIsDialogOpen(false)
      setEditingLocation(null)
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar ubicación")
    } finally {
      setSaving(false)
    }
  }

  // Open delete confirmation
  const handleDeleteClick = (location: Location) => {
    setDeletingLocation(location)
    setIsDeleteDialogOpen(true)
  }

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!deletingLocation) return

    try {
      await locationsService.delete(deletingLocation.id)
      toast.success("Ubicación eliminada correctamente")
      setIsDeleteDialogOpen(false)
      setDeletingLocation(null)
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar ubicación")
    }
  }

  // Toggle active status
  const handleToggleActive = async (location: Location) => {
    try {
      await locationsService.update(location.id, { active: !location.active })
      toast.success(location.active ? "Ubicación desactivada" : "Ubicación activada")
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar estado")
    }
  }

  // Open send reminder dialog
  const handleSendReminderClick = (location: Location) => {
    setReminderLocation(location)
    // Pre-select first contact of the client
    const clientContacts = contacts.filter(c => c.client_id === location.client_id)
    setSelectedContactId(clientContacts.length > 0 ? clientContacts[0].id : 0)
    setIsReminderDialogOpen(true)
  }

  // Send reminder now
  const handleSendReminder = async () => {
    if (!reminderLocation || !selectedContactId) return

    try {
      setSendingReminder(true)
      // Schedule for now (1 minute in the future to ensure it goes through)
      const scheduledFor = new Date(Date.now() + 60 * 1000).toISOString()
      await complianceService.createReminder({
        location_id: reminderLocation.id,
        contact_id: selectedContactId,
        scheduled_for: scheduledFor,
      })
      toast.success("Recordatorio enviado correctamente")
      setIsReminderDialogOpen(false)
      setReminderLocation(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar recordatorio")
    } finally {
      setSendingReminder(false)
    }
  }

  // Toggle day selection
  const toggleDay = (dayValue: string) => {
    setFormData(prev => {
      const newDays = prev.selectedDays.includes(dayValue)
        ? prev.selectedDays.filter(d => d !== dayValue)
        : [...prev.selectedDays, dayValue]
      return { ...prev, selectedDays: newDays }
    })
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

  // Get contacts for a client
  const getClientContacts = (clientId: number) => {
    return contacts.filter(c => c.client_id === clientId)
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
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Ubicación
        </Button>
      </div>

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
              <Button className="mt-4" onClick={handleCreate}>
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
              <Card key={location.id} className={!location.active ? "opacity-60" : ""}>
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
                    <div className="flex items-center gap-2">
                      <Badge className={status.color} variant="secondary">
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleSendReminderClick(location)}>
                            <Send className="h-4 w-4 mr-2" />
                            Enviar recordatorio
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(location)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(location)}>
                            <Power className="h-4 w-4 mr-2" />
                            {location.active ? "Desactivar" : "Activar"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(location)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
                      <span className="text-muted-foreground">Días:</span>
                      <span>{getDaysLabel(location.reminder_days)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hora:</span>
                      <span>{location.reminder_time}</span>
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLocation ? "Editar Ubicación" : "Nueva Ubicación"}</DialogTitle>
            <DialogDescription>
              {editingLocation ? "Modifica los datos de la ubicación" : "Agrega un punto de aplicación"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="client">Cliente *</Label>
              <select
                id="client"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: Number(e.target.value) })}
                disabled={!!editingLocation}
              >
                <option value={0}>Seleccionar cliente...</option>
                {clients.filter(c => c.active).map((client) => (
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
                {products.filter(p => p.active).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reminder Configuration */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4" />
                Configuración de recordatorios
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
                  <Label htmlFor="reminder_time">Hora</Label>
                  <Input
                    id="reminder_time"
                    type="time"
                    value={formData.reminder_time || "09:00"}
                    onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Días de la semana</Label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                        formData.selectedDays.includes(day.value)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                      title={day.fullLabel}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecciona los días en que se enviarán recordatorios
                </p>
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
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <textarea
                id="description"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Descripción o notas adicionales..."
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !formData.name.trim() || !formData.client_id || formData.selectedDays.length === 0}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingLocation ? "Guardar cambios" : "Crear ubicación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ubicación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará <strong>{deletingLocation?.name}</strong> y todos sus registros de compliance asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Reminder Dialog */}
      <Dialog open={isReminderDialogOpen} onOpenChange={setIsReminderDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Enviar recordatorio ahora</DialogTitle>
            <DialogDescription>
              Envía un recordatorio inmediato para <strong>{reminderLocation?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="contact">Contacto *</Label>
              <select
                id="contact"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(Number(e.target.value))}
              >
                <option value={0}>Seleccionar contacto...</option>
                {reminderLocation && getClientContacts(reminderLocation.client_id).map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} {contact.telegram_username ? `(@${contact.telegram_username})` : ""}
                  </option>
                ))}
              </select>
              {reminderLocation && getClientContacts(reminderLocation.client_id).length === 0 && (
                <p className="text-xs text-destructive">
                  No hay contactos vinculados a Telegram para este cliente
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReminderDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendReminder}
              disabled={sendingReminder || !selectedContactId}
            >
              {sendingReminder && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Enviar ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
