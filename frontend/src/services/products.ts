import { api } from "@/lib/api"
import type {
  Product,
  ProductCreate,
  ProductUpdate,
  PaginatedResponse,
  PaginationParams,
} from "@/types"

interface ProductListParams extends PaginationParams {
  category?: string
  active_only?: boolean
}

export const productsService = {
  /**
   * Lista todos los productos con paginación y filtros
   */
  async list(params: ProductListParams = {}): Promise<PaginatedResponse<Product>> {
    return api.get<PaginatedResponse<Product>>("/api/products", { params })
  },

  /**
   * Obtiene un producto por ID
   */
  async get(id: number): Promise<Product> {
    return api.get<Product>(`/api/products/${id}`)
  },

  /**
   * Crea un nuevo producto
   */
  async create(data: ProductCreate): Promise<Product> {
    return api.post<Product>("/api/products", data)
  },

  /**
   * Actualiza un producto existente
   */
  async update(id: number, data: ProductUpdate): Promise<Product> {
    return api.patch<Product>(`/api/products/${id}`, data)
  },

  /**
   * Elimina un producto (soft delete por defecto)
   */
  async delete(id: number, hardDelete = false): Promise<void> {
    await api.delete(`/api/products/${id}`, {
      params: { hard_delete: hardDelete },
    })
  },
}
