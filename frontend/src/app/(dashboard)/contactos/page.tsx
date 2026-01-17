"use client"

import { useState, useEffect } from "react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Search, MessageCircle, Phone, Mail, Loader2, Users, Copy, Check } from "lucide-react"
import { contactsService, clientsService } from "@/services"
import type { Contact, ContactCreate, Client, ContactWithInviteCode } from "@/types"

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

export default function ContactosPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
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

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [contactsRes, clientsRes] = await Promise.all([
        contactsService.list({ search: searchQuery || undefined, page_size: 100 }),
        clientsService.list({ page_size: 100 }),
      ])
      setContacts(contactsRes.items)
      setClients(clientsRes.items)
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
      const created = await contactsService.create(formData)
      setNewContact(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear contacto")
    } finally {
      setSaving(false)
    }
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setNewContact(null)
    setFormData({ client_id: 0, name: "", phone: "", email: "", role: "operador" })
    fetchData()
  }

  const copyInviteCode = () => {
    if (newContact?.invite_code) {
      navigator.clipboard.writeText(newContact.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Get client name by ID
  const getClientName = (clientId: number) => {
    return clients.find(c => c.id === clientId)?.name || "Cliente desconocido"
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
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Contacto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            {!newContact ? (
              <>
                <DialogHeader>
                  <DialogTitle>Nuevo Contacto</DialogTitle>
                  <DialogDescription>
                    Agrega un contacto a un cliente existente
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
                  <Button variant="outline" onClick={handleCloseDialog}>
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
              </>
            ) : (
              <>
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
                        {newContact.invite_code}
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
                      El contacto debe enviar este código al bot de Telegram para vincular su cuenta.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCloseDialog}>
                    Cerrar
                  </Button>
                </DialogFooter>
              </>
            )}
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
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
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
            <Card key={contact.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{contact.name}</CardTitle>
                    <p className="text-sm text-muted-foreground truncate">
                      {getClientName(contact.client_id)}
                    </p>
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
    </div>
  )
}
