import { api, API_URL } from "@/lib/api"

// ==================== TYPES ====================

export interface OrderItem {
  product_id: number
  product_name: string
  quantity: number
  notes?: string
}

export interface OrderCreate {
  location_id: number
  items: OrderItem[]
  notes?: string
  signature_data: string
  signed_by_name: string
  signature_latitude?: number
  signature_longitude?: number
  telegram_user_id: string
}

export type OrderStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"

export interface Order {
  id: number
  location_id: number
  contact_id: number
  items: OrderItem[]
  notes?: string
  status: OrderStatus
  signed_by_name: string
  signed_at: string
  signature_latitude?: number
  signature_longitude?: number
  reviewed_by_id?: number
  reviewed_at?: string
  rejection_reason?: string
  admin_notes?: string
  telegram_user_id?: string
  created_at: string
  updated_at?: string
}

export interface OrderWithDetails extends Order {
  location_name?: string
  location_address?: string
  contact_name?: string
  contact_phone?: string
  client_id?: number
  client_name?: string
  reviewed_by_name?: string
}

export interface OrderList {
  items: OrderWithDetails[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface OrderStats {
  total: number
  pending: number
  approved: number
  rejected: number
  processing: number
  shipped: number
  delivered: number
  cancelled: number
  created_this_month: number
  delivered_this_month: number
}

interface OrderListParams {
  location_id?: number
  contact_id?: number
  client_id?: number
  status?: OrderStatus
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

// ==================== SERVICE ====================

export const ordersService = {
  /**
   * Crea un nuevo pedido desde WebApp
   */
  async create(data: OrderCreate): Promise<Order> {
    return api.post<Order>("/api/orders", data)
  },

  /**
   * Lista pedidos con filtros y paginación
   */
  async list(params: OrderListParams = {}): Promise<OrderList> {
    return api.get<OrderList>("/api/orders", { params })
  },

  /**
   * Obtiene un pedido por ID
   */
  async get(id: number): Promise<OrderWithDetails> {
    return api.get<OrderWithDetails>(`/api/orders/${id}`)
  },

  /**
   * Aprueba un pedido
   */
  async approve(
    id: number,
    reviewedById: number,
    adminNotes?: string
  ): Promise<Order> {
    return api.patch<Order>(
      `/api/orders/${id}/approve`,
      { admin_notes: adminNotes },
      { params: { reviewed_by_id: reviewedById } }
    )
  },

  /**
   * Rechaza un pedido
   */
  async reject(
    id: number,
    reviewedById: number,
    reason: string,
    adminNotes?: string
  ): Promise<Order> {
    return api.patch<Order>(
      `/api/orders/${id}/reject`,
      { rejection_reason: reason, admin_notes: adminNotes },
      { params: { reviewed_by_id: reviewedById } }
    )
  },

  /**
   * Actualiza el estado de un pedido
   */
  async updateStatus(
    id: number,
    status: OrderStatus,
    adminNotes?: string
  ): Promise<Order> {
    return api.patch<Order>(`/api/orders/${id}/status`, {
      status,
      admin_notes: adminNotes,
    })
  },

  /**
   * Obtiene la URL de la firma de un pedido
   */
  getSignatureUrl(id: number): string {
    return `${API_URL}/api/orders/${id}/signature`
  },

  /**
   * Obtiene estadísticas de pedidos
   */
  async getStats(): Promise<OrderStats> {
    return api.get<OrderStats>("/api/orders/stats/summary")
  },
}
