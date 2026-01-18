"use client"

import { useState } from "react"
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
  Package,
  Loader2,
  Beaker,
  MoreHorizontal,
  Pencil,
  Trash2,
  Power,
} from "lucide-react"
import { toast } from "sonner"
import { productsService } from "@/services"
import { useListFetch } from "@/hooks"
import type { Product, ProductCreate, ProductUpdate } from "@/types"

export default function ProductosPage() {
  const [searchQuery, setSearchQuery] = useState("")

  // Data fetching with unified hook (fixes double-flicker)
  const { items: products, loading, refetch } = useListFetch<Product>({
    fetchFn: (params) => productsService.list(params),
    searchQuery,
    onError: (err) => toast.error(err.message || "Error al cargar productos"),
  })

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

  // Form state
  const [formData, setFormData] = useState<ProductCreate>({
    name: "",
    sku: "",
    description: "",
    application_instructions: "",
    dosage: "",
    frequency_recommended: 7,
    category: "",
  })

  // Open dialog for create
  const handleCreate = () => {
    setEditingProduct(null)
    setFormData({
      name: "",
      sku: "",
      description: "",
      application_instructions: "",
      dosage: "",
      frequency_recommended: 7,
      category: "",
    })
    setIsDialogOpen(true)
  }

  // Open dialog for edit
  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      sku: product.sku || "",
      description: product.description || "",
      application_instructions: product.application_instructions || "",
      dosage: product.dosage || "",
      frequency_recommended: product.frequency_recommended,
      category: product.category || "",
    })
    setIsDialogOpen(true)
  }

  // Handle form submit
  const handleSubmit = async () => {
    if (!formData.name.trim()) return

    try {
      setSaving(true)

      if (editingProduct) {
        const updateData: ProductUpdate = {
          name: formData.name,
          sku: formData.sku || undefined,
          description: formData.description || undefined,
          application_instructions: formData.application_instructions || undefined,
          dosage: formData.dosage || undefined,
          frequency_recommended: formData.frequency_recommended,
          category: formData.category || undefined,
        }
        await productsService.update(editingProduct.id, updateData)
        toast.success("Producto actualizado correctamente")
      } else {
        await productsService.create(formData)
        toast.success("Producto creado correctamente")
      }

      setIsDialogOpen(false)
      setEditingProduct(null)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar producto")
    } finally {
      setSaving(false)
    }
  }

  // Open delete confirmation
  const handleDeleteClick = (product: Product) => {
    setDeletingProduct(product)
    setIsDeleteDialogOpen(true)
  }

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return

    try {
      await productsService.delete(deletingProduct.id)
      toast.success("Producto eliminado correctamente")
      setIsDeleteDialogOpen(false)
      setDeletingProduct(null)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar producto")
    }
  }

  // Toggle active status
  const handleToggleActive = async (product: Product) => {
    try {
      await productsService.update(product.id, { active: !product.active })
      toast.success(product.active ? "Producto desactivado" : "Producto activado")
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
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="text-muted-foreground">
            Catálogo de productos Biorem
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar productos..."
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
      {!loading && products.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {searchQuery ? "No se encontraron productos" : "No hay productos registrados"}
            </p>
            {!searchQuery && (
              <Button className="mt-4" onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar primer producto
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Product Cards */}
      {!loading && products.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className={!product.active ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Beaker className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{product.name}</CardTitle>
                      {product.sku && (
                        <p className="text-sm text-muted-foreground">
                          SKU: {product.sku}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={product.active ? "default" : "secondary"}>
                      {product.active ? "Activo" : "Inactivo"}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(product)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(product)}>
                          <Power className="h-4 w-4 mr-2" />
                          {product.active ? "Desactivar" : "Activar"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(product)}
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
                  {product.category && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Categoría:</span>
                      <span>{product.category}</span>
                    </div>
                  )}
                  {product.dosage && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dosis:</span>
                      <span>{product.dosage}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frecuencia:</span>
                    <span>Cada {product.frequency_recommended} días</span>
                  </div>
                  {product.description && (
                    <p className="text-muted-foreground text-xs mt-2 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? "Modifica los datos del producto" : "Agrega un producto al catálogo"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                placeholder="Ej: Biorem Drenajes"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  placeholder="Ej: BIO-DRN-001"
                  value={formData.sku || ""}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Categoría</Label>
                <Input
                  id="category"
                  placeholder="Ej: Drenajes"
                  value={formData.category || ""}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                placeholder="Descripción del producto"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dosage">Dosificación</Label>
                <Input
                  id="dosage"
                  placeholder="Ej: 50ml por aplicación"
                  value={formData.dosage || ""}
                  onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="frequency">Frecuencia (días)</Label>
                <Input
                  id="frequency"
                  type="number"
                  min="1"
                  value={formData.frequency_recommended || 7}
                  onChange={(e) => setFormData({ ...formData, frequency_recommended: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="instructions">Instrucciones de aplicación</Label>
              <textarea
                id="instructions"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Instrucciones detalladas para aplicar el producto..."
                value={formData.application_instructions || ""}
                onChange={(e) => setFormData({ ...formData, application_instructions: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !formData.name.trim()}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingProduct ? "Guardar cambios" : "Crear producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará <strong>{deletingProduct?.name}</strong>. Las ubicaciones que usan este producto quedarán sin producto asignado.
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
