"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { Plus, Search, MessageCircle, Phone, Mail, Loader2, Users, Copy, Check, MoreHorizontal, Pencil, Trash2, Power, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { contactsService, clientsService } from "@/services"
import { useDataFetch } from "@/hooks"
import type { Contact, ContactCreate, ContactUpdate, Client, ContactWithInviteCode } from "@/types"

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  operador: "Operador",
  readonly: "Solo lectura",
}

const roleColors: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  supervisor: "secondary",
  operador: "outline",
  readonly: "outline",
}

const roleOptions = [
  { value: "admin", label: "Administrador" },
  { value: "supervisor", label: "Supervisor" },
  { value: "operador", label: "Operador" },
  { value: "readonly", label: "Solo lectura" },
]

export default function ContactosPage() {
  const [searchQuery, setSearchQuery] = useState("")

  // Data fetching with unified hook (fixes double-flicker)
  const { data, loading, refetch } = useDataFetch({
    fetchFn: async () => {
      const [contactsRes, clientsRes] = await Promise.all([
        contactsService.list({ search: searchQuery || undefined, page_size: 100 }),
        clientsService.list({ page_size: 100 }),
      ])
      return { contacts: contactsRes.items, clients: clientsRes.items }
    },
    deps: [searchQuery],
    initialData: { contacts: [] as Contact[], clients: [] as Client[] },
    onError: (err) => toast.error(err.message || "Error al cargar datos"),
  })

  const { contacts, clients } = data

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null)
  const [newContact, setNewContact] = useState<ContactWithInviteCode | null>(null)
  const [copied, setCopied] = useState(false)

  // Form state
  const [formData, setFormData] = useState<ContactCreate>({
    client_id: 0,
    name: "",
    phone: "",
    email: "",
    role: "operador",
  })

  // Get client name by ID
  const getClientName = (clientId: number) => {
    return clients.find(c => c.id === clientId)?.name || "Cliente desconocido"
  }

  // Open dialog for create
  const handleCreate = () => {
    setEditingContact(null)
    setFormData({ client_id: 0, name: "", phone: "", email: "", role: "operador" })
    setIsDialogOpen(true)
  }

  // Open dialog for edit
  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
    setFormData({
      client_id: contact.client_id,
      name: contact.name,
      phone: contact.phone || "",
      email: contact.email || "",
      role: contact.role,
    })
    setIsDialogOpen(true)
  }

  // Handle form submit
  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.client_id) return

    try {
      setSaving(true)

      if (editingContact) {
        const updateData: ContactUpdate = {
          name: formData.name,
          phone: formData.phone || undefined,
          email: formData.email || undefined,
          role: formData.role,
        }
        await contactsService.update(editingContact.id, updateData)
        toast.success("Contacto actualizado correctamente")
        setIsDialogOpen(false)
        refetch()
      } else {
        const created = await contactsService.create(formData)
        setNewContact(created)
        setIsDialogOpen(false)
        setIsInviteDialogOpen(true)
      }

      setFormData({ client_id: 0, name: "", phone: "", email: "", role: "operador" })
      setEditingContact(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar contacto")
    } finally {
      setSaving(false)
    }
  }

  // Close invite dialog
  const handleCloseInviteDialog = () => {
    setIsInviteDialogOpen(false)
    setNewContact(null)
    refetch()
  }

  // Copy invite code
  const copyInviteCode = () => {
    if (newContact?.invite_code) {
      navigator.clipboard.writeText(newContact.invite_code)
      setCopied(true)
      toast.success("Código copiado al portapapeles")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Regenerate invite code
  const handleRegenerateCode = async (contact: Contact) => {
    try {
      const updated = await contactsService.regenerateInviteCode(contact.id)
      toast.success("Nuevo código generado")
      setNewContact(updated)
      setIsInviteDialogOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al regenerar código")
    }
  }

  // Open delete confirmation
  const handleDeleteClick = (contact: Contact) => {
    setDeletingContact(contact)
    setIsDeleteDialogOpen(true)
  }

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!deletingContact) return

    try {
      await contactsService.delete(deletingContact.id)
      toast.success("Contacto eliminado correctamente")
      setIsDeleteDialogOpen(false)
      setDeletingContact(null)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar contacto")
    }
  }

  // Toggle active status
  const handleToggleActive = async (contact: Contact) => {
    try {
      await contactsService.update(contact.id, { active: !contact.active })
      toast.success(contact.active ? "Contacto desactivado" : "Contacto activado")
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar estado")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contactos</h1>
          <p className="text-muted-foreground">
            Personas vinculadas a los clientes
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Contacto
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar contactos..."
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
      {!loading && contacts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {searchQuery ? "No se encontraron contactos" : "No hay contactos registrados"}
            </p>
            {!searchQuery && clients.length > 0 && (
              <Button className="mt-4" onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar primer contacto
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contact Cards */}
      {!loading && contacts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact) => (
            <Card key={contact.id} className={`overflow-hidden ${!contact.active ? "opacity-60" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base truncate">{contact.name}</CardTitle>
                        <p className="text-sm text-muted-foreground truncate">
                          {getClientName(contact.client_id)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(contact)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {!contact.telegram_id && (
                            <DropdownMenuItem onClick={() => handleRegenerateCode(contact)}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Nuevo código
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleToggleActive(contact)}>
                            <Power className="h-4 w-4 mr-2" />
                            {contact.active ? "Desactivar" : "Activar"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(contact)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant={roleColors[contact.role]}>
                    {roleLabels[contact.role]}
                  </Badge>
                  {contact.telegram_id ? (
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                      <MessageCircle className="h-3 w-3 mr-1" />
                      Telegram
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                      Sin vincular
                    </Badge>
                  )}
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {contact.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      {contact.phone}
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      {contact.email}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Editar Contacto" : "Nuevo Contacto"}</DialogTitle>
            <DialogDescription>
              {editingContact ? "Modifica los datos del contacto" : "Agrega un contacto a un cliente existente"}
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
                disabled={!!editingContact}
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
              <Label htmlFor="name">Nombre completo *</Label>
              <Input
                id="name"
                placeholder="Nombre del contacto"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Rol</Label>
              <select
                id="role"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as ContactCreate["role"] })}
              >
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
                placeholder="contacto@email.com"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
              {editingContact ? "Guardar cambios" : "Crear contacto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Code Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={handleCloseInviteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Contacto Creado</DialogTitle>
            <DialogDescription>
              Comparte el código de invitación con el contacto
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-2xl font-mono font-bold tracking-wider">
                  {newContact?.invite_code}
                </p>
              </div>
              <Button variant="outline" onClick={copyInviteCode}>
                {copied ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copied ? "Copiado" : "Copiar código"}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                El contacto debe enviar este código al bot de Telegram <strong>@biorem_compliance_bot</strong> para vincular su cuenta.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCloseInviteDialog}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará a <strong>{deletingContact?.name}</strong>. Esta acción no se puede deshacer.
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
