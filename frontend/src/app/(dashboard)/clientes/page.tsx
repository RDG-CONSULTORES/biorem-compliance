"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
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
import { Plus, Search, Building2, MapPin, Loader2, MoreHorizontal, Pencil, Trash2, Power, Users, Eye } from "lucide-react"
import { toast } from "sonner"
import { clientsService } from "@/services"
import type { Client, ClientCreate, ClientUpdate } from "@/types"

const businessTypeLabels: Record<string, string> = {
  plaza: "Plaza",
  casino: "Casino",
  supermercado: "Supermercado",
  hotel: "Hotel",
  restaurante: "Restaurante",
  hospital: "Hospital",
  otro: "Otro",
}

const businessTypeOptions = [
  { value: "plaza", label: "Plaza" },
  { value: "casino", label: "Casino" },
  { value: "supermercado", label: "Supermercado" },
  { value: "hotel", label: "Hotel" },
  { value: "restaurante", label: "Restaurante" },
  { value: "hospital", label: "Hospital" },
  { value: "otro", label: "Otro" },
]

export default function ClientesPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)

  // Form state
  const [formData, setFormData] = useState<ClientCreate>({
    name: "",
    city: "",
    phone: "",
    email: "",
    business_type: "otro",
  })

  // Fetch clients
  const fetchClients = async () => {
    try {
      setLoading(true)
      const response = await clientsService.list({
        search: searchQuery || undefined,
        page_size: 100,
      })
      setClients(response.items)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar clientes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Open dialog for create
  const handleCreate = () => {
    setEditingClient(null)
    setFormData({ name: "", city: "", phone: "", email: "", business_type: "otro" })
    setIsDialogOpen(true)
  }

  // Open dialog for edit
  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      city: client.city || "",
      phone: client.phone || "",
      email: client.email || "",
      business_type: client.business_type,
    })
    setIsDialogOpen(true)
  }

  // Handle form submit (create or update)
  const handleSubmit = async () => {
    if (!formData.name.trim()) return

    try {
      setSaving(true)

      if (editingClient) {
        // Update existing client
        const updateData: ClientUpdate = {
          name: formData.name,
          city: formData.city || undefined,
          phone: formData.phone || undefined,
          email: formData.email || undefined,
          business_type: formData.business_type,
        }
        await clientsService.update(editingClient.id, updateData)
        toast.success("Cliente actualizado correctamente")
      } else {
        // Create new client
        await clientsService.create(formData)
        toast.success("Cliente creado correctamente")
      }

      setIsDialogOpen(false)
      setFormData({ name: "", city: "", phone: "", email: "", business_type: "otro" })
      setEditingClient(null)
      fetchClients()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar cliente")
    } finally {
      setSaving(false)
    }
  }

  // Open delete confirmation
  const handleDeleteClick = (client: Client) => {
    setDeletingClient(client)
    setIsDeleteDialogOpen(true)
  }

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!deletingClient) return

    try {
      await clientsService.delete(deletingClient.id)
      toast.success("Cliente eliminado correctamente")
      setIsDeleteDialogOpen(false)
      setDeletingClient(null)
      fetchClients()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar cliente")
    }
  }

  // Toggle active status
  const handleToggleActive = async (client: Client) => {
    try {
      await clientsService.update(client.id, { active: !client.active })
      toast.success(client.active ? "Cliente desactivado" : "Cliente activado")
      fetchClients()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar estado")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Administra los clientes de Biorem
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar clientes..."
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
      {!loading && clients.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {searchQuery ? "No se encontraron clientes" : "No hay clientes registrados"}
            </p>
            {!searchQuery && (
              <Button className="mt-4" onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar primer cliente
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mobile Cards */}
      {!loading && clients.length > 0 && (
        <div className="grid gap-4 sm:hidden">
          {clients.map((client) => (
            <Card key={client.id} className={!client.active ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{client.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={client.active ? "default" : "secondary"}>
                      {client.active ? "Activo" : "Inactivo"}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/clientes/${client.id}`)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(client)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(client)}>
                          <Power className="h-4 w-4 mr-2" />
                          {client.active ? "Desactivar" : "Activar"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(client)}
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
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {businessTypeLabels[client.business_type] || "Otro"}
                  </div>
                  {client.city && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {client.city}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Desktop Table */}
      {!loading && clients.length > 0 && (
        <Card className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id} className={!client.active ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{businessTypeLabels[client.business_type] || "Otro"}</TableCell>
                  <TableCell>{client.city || "-"}</TableCell>
                  <TableCell>{client.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={client.active ? "default" : "secondary"}>
                      {client.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/clientes/${client.id}`)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(client)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(client)}>
                          <Power className="h-4 w-4 mr-2" />
                          {client.active ? "Desactivar" : "Activar"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(client)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
            <DialogDescription>
              {editingClient ? "Modifica los datos del cliente" : "Agrega un nuevo cliente al sistema"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                placeholder="Nombre del cliente"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="business_type">Tipo de negocio</Label>
              <select
                id="business_type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={formData.business_type}
                onChange={(e) => setFormData({ ...formData, business_type: e.target.value as ClientCreate["business_type"] })}
              >
                {businessTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                placeholder="+52 55 1234 5678"
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="contacto@cliente.com"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !formData.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingClient ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará a <strong>{deletingClient?.name}</strong> y todos sus contactos y ubicaciones asociados. Esta acción no se puede deshacer.
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
    </div>
  )
}
