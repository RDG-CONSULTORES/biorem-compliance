"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Loader2,
  ShoppingCart,
  Truck,
  PackageCheck,
  Ban,
  Eye,
  FileSignature,
} from "lucide-react"
import { ordersService } from "@/services"
import type { OrderWithDetails, OrderStatus, OrderStats } from "@/services/orders"

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  approved: { label: "Aprobado", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  rejected: { label: "Rechazado", color: "bg-red-100 text-red-700", icon: XCircle },
  processing: { label: "Procesando", color: "bg-purple-100 text-purple-700", icon: Package },
  shipped: { label: "Enviado", color: "bg-indigo-100 text-indigo-700", icon: Truck },
  delivered: { label: "Entregado", color: "bg-green-100 text-green-700", icon: PackageCheck },
  cancelled: { label: "Cancelado", color: "bg-gray-100 text-gray-700", icon: Ban },
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    created_this_month: 0,
    delivered_this_month: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Modal states
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [adminNotes, setAdminNotes] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params: Record<string, unknown> = { page_size: 100 }
      if (statusFilter !== "all") {
        params.status = statusFilter
      }

      const [ordersRes, statsRes] = await Promise.all([
        ordersService.list(params),
        ordersService.getStats(),
      ])

      setOrders(ordersRes.items)
      setStats(statsRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos")
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleViewOrder = (order: OrderWithDetails) => {
    setSelectedOrder(order)
    setAdminNotes(order.admin_notes || "")
    setShowDetailModal(true)
  }

  const handleApprove = async () => {
    if (!selectedOrder) return

    try {
      setActionLoading(true)
      // Using 1 as default reviewer ID - in production this should come from auth context
      await ordersService.approve(selectedOrder.id, 1, adminNotes || undefined)
      setShowDetailModal(false)
      setSelectedOrder(null)
      setAdminNotes("")
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al aprobar pedido")
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpenReject = () => {
    setShowDetailModal(false)
    setShowRejectModal(true)
  }

  const handleReject = async () => {
    if (!selectedOrder || !rejectionReason.trim()) return

    try {
      setActionLoading(true)
      await ordersService.reject(selectedOrder.id, 1, rejectionReason, adminNotes || undefined)
      setShowRejectModal(false)
      setSelectedOrder(null)
      setRejectionReason("")
      setAdminNotes("")
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al rechazar pedido")
    } finally {
      setActionLoading(false)
    }
  }

  const handleStatusChange = async (orderId: number, newStatus: OrderStatus) => {
    try {
      setActionLoading(true)
      await ordersService.updateStatus(orderId, newStatus)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar estado")
    } finally {
      setActionLoading(false)
    }
  }

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.location_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.signed_by_name.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesSearch
  })

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-muted-foreground">
          Gestiona las solicitudes de productos de tus clientes
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
      <div className="grid gap-4 sm:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Requieren aprobacion</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aprobados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">Listos para procesar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Proceso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats.processing + stats.shipped}
            </div>
            <p className="text-xs text-muted-foreground">Procesando/Enviando</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entregados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
            <p className="text-xs text-muted-foreground">
              {stats.delivered_this_month > 0 ? `${stats.delivered_this_month} este mes` : "Total"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.created_this_month > 0 ? `${stats.created_this_month} este mes` : "Todos"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, ubicacion..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="approved">Aprobados</SelectItem>
            <SelectItem value="processing">Procesando</SelectItem>
            <SelectItem value="shipped">Enviados</SelectItem>
            <SelectItem value="delivered">Entregados</SelectItem>
            <SelectItem value="rejected">Rechazados</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && orders.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No hay pedidos registrados
            </p>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Los pedidos apareceran cuando los contactos soliciten productos via Telegram
            </p>
          </CardContent>
        </Card>
      )}

      {/* Mobile Cards */}
      {!loading && filteredOrders.length > 0 && (
        <div className="grid gap-4 sm:hidden">
          {filteredOrders.map((order) => {
            const status = statusConfig[order.status]
            const StatusIcon = status.icon

            return (
              <Card
                key={order.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleViewOrder(order)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">
                          {order.client_name || "Sin cliente"}
                        </span>
                        <Badge className={status.color} variant="secondary">
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.location_name || "Sin ubicacion"}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>{order.items.length} productos</span>
                        <span>{formatDate(order.created_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Firmado por: {order.signed_by_name}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Desktop Table */}
      {!loading && filteredOrders.length > 0 && (
        <Card className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Ubicacion</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Firmado por</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const status = statusConfig[order.status]
                const StatusIcon = status.icon

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">#{order.id}</TableCell>
                    <TableCell className="font-medium">
                      {order.client_name || "Sin cliente"}
                    </TableCell>
                    <TableCell>{order.location_name || "Sin ubicacion"}</TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {order.items.length} producto{order.items.length !== 1 ? "s" : ""}
                      </span>
                    </TableCell>
                    <TableCell>{order.signed_by_name}</TableCell>
                    <TableCell>{formatDate(order.created_at)}</TableCell>
                    <TableCell>
                      <Badge className={status.color} variant="secondary">
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewOrder(order)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {order.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => {
                                setSelectedOrder(order)
                                handleApprove()
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setSelectedOrder(order)
                                handleOpenReject()
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {order.status === "approved" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(order.id, "processing")}
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                        )}
                        {order.status === "processing" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(order.id, "shipped")}
                          >
                            <Truck className="h-4 w-4" />
                          </Button>
                        )}
                        {order.status === "shipped" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(order.id, "delivered")}
                          >
                            <PackageCheck className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido #{selectedOrder?.id}</DialogTitle>
            <DialogDescription>
              Creado el {selectedOrder && formatDate(selectedOrder.created_at)}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Estado:</span>
                <Badge
                  className={statusConfig[selectedOrder.status].color}
                  variant="secondary"
                >
                  {statusConfig[selectedOrder.status].label}
                </Badge>
              </div>

              {/* Client Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedOrder.client_name || "Sin cliente"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ubicacion</p>
                  <p className="font-medium">{selectedOrder.location_name || "Sin ubicacion"}</p>
                  {selectedOrder.location_address && (
                    <p className="text-sm text-muted-foreground">
                      {selectedOrder.location_address}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contacto</p>
                  <p className="font-medium">{selectedOrder.contact_name || "Sin contacto"}</p>
                  {selectedOrder.contact_phone && (
                    <p className="text-sm text-muted-foreground">
                      {selectedOrder.contact_phone}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Firmado por</p>
                  <p className="font-medium">{selectedOrder.signed_by_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(selectedOrder.signed_at)}
                  </p>
                </div>
              </div>

              {/* Products */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Productos</p>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead>Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {item.product_name}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Notas del pedido
                  </p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Signature */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Firma</p>
                <div className="border rounded-lg p-4 bg-white flex items-center justify-center">
                  <img
                    src={ordersService.getSignatureUrl(selectedOrder.id)}
                    alt="Firma"
                    className="max-h-32"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = "none"
                    }}
                  />
                </div>
                {selectedOrder.signature_latitude && selectedOrder.signature_longitude && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ubicacion: {selectedOrder.signature_latitude.toFixed(6)},{" "}
                    {selectedOrder.signature_longitude.toFixed(6)}
                  </p>
                )}
              </div>

              {/* Rejection reason */}
              {selectedOrder.status === "rejected" && selectedOrder.rejection_reason && (
                <div>
                  <p className="text-sm font-medium text-red-600 mb-1">
                    Razon del rechazo
                  </p>
                  <p className="text-sm bg-red-50 text-red-700 p-3 rounded-lg">
                    {selectedOrder.rejection_reason}
                  </p>
                </div>
              )}

              {/* Admin notes input for pending orders */}
              {selectedOrder.status === "pending" && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Notas del admin (opcional)
                  </p>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Agregar notas internas..."
                    rows={2}
                  />
                </div>
              )}

              {/* Existing admin notes */}
              {selectedOrder.admin_notes && selectedOrder.status !== "pending" && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Notas del admin
                  </p>
                  <p className="text-sm bg-muted p-3 rounded-lg">
                    {selectedOrder.admin_notes}
                  </p>
                </div>
              )}

              {/* Review info */}
              {selectedOrder.reviewed_by_name && selectedOrder.reviewed_at && (
                <div className="text-sm text-muted-foreground">
                  Revisado por {selectedOrder.reviewed_by_name} el{" "}
                  {formatDate(selectedOrder.reviewed_at)}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedOrder?.status === "pending" && (
              <>
                <Button variant="outline" onClick={handleOpenReject}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Rechazar
                </Button>
                <Button onClick={handleApprove} disabled={actionLoading}>
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Aprobar
                </Button>
              </>
            )}
            {selectedOrder?.status !== "pending" && (
              <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                Cerrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Pedido</DialogTitle>
            <DialogDescription>
              Por favor indica la razon del rechazo. Esta informacion sera enviada al
              solicitante.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Razon del rechazo *</p>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ej: Producto no disponible, cantidad excede limite, etc."
                rows={3}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Notas internas (opcional)
              </p>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Notas que solo veran los admins..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(false)
                setRejectionReason("")
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Rechazar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
