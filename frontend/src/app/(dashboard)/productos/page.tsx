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
import { Plus, Search, Package, Loader2, Beaker } from "lucide-react"
import { productsService } from "@/services"
import type { Product, ProductCreate } from "@/types"

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

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

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await productsService.list({ search: searchQuery || undefined, page_size: 100 })
      setProducts(response.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar productos")
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
    if (!formData.name.trim()) return

    try {
      setSaving(true)
      await productsService.create(formData)
      setIsDialogOpen(false)
      setFormData({
        name: "",
        sku: "",
        description: "",
        application_instructions: "",
        dosage: "",
        frequency_recommended: 7,
        category: "",
      })
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear producto")
    } finally {
      setSaving(false)
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Producto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nuevo Producto</DialogTitle>
              <DialogDescription>
                Agrega un producto al catálogo
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
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
                <Label htmlFor="frequency">Frecuencia recomendada (días)</Label>
                <Input
                  id="frequency"
                  type="number"
                  min="1"
                  value={formData.frequency_recommended || 7}
                  onChange={(e) => setFormData({ ...formData, frequency_recommended: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="instructions">Instrucciones de aplicación</Label>
                <textarea
                  id="instructions"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
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
            <Card key={product.id}>
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
                  <Badge variant={product.active ? "default" : "secondary"}>
                    {product.active ? "Activo" : "Inactivo"}
                  </Badge>
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
    </div>
  )
}
