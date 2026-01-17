import { api } from "@/lib/api"
import type {
  Location,
  LocationCreate,
  LocationUpdate,
  PaginatedResponse,
  PaginationParams,
} from "@/types"

interface LocationListParams extends PaginationParams {
  client_id?: number
  product_id?: number
  active_only?: boolean
}

export const locationsService = {
  /**
   * Lista todas las ubicaciones con paginación y filtros
   */
  async list(params: LocationListParams = {}): Promise<PaginatedResponse<Location>> {
    return api.get<PaginatedResponse<Location>>("/api/locations", { params })
  },

  /**
   * Obtiene una ubicación por ID
   */
  async get(id: number): Promise<Location> {
    return api.get<Location>(`/api/locations/${id}`)
  },

  /**
   * Crea una nueva ubicación
   */
  async create(data: LocationCreate): Promise<Location> {
    return api.post<Location>("/api/locations", data)
  },

  /**
   * Actualiza una ubicación existente
   */
  async update(id: number, data: LocationUpdate): Promise<Location> {
    return api.patch<Location>(`/api/locations/${id}`, data)
  },

  /**
   * Elimina una ubicación (soft delete por defecto)
   */
  async delete(id: number, hardDelete = false): Promise<void> {
    await api.delete(`/api/locations/${id}`, {
      params: { hard_delete: hardDelete },
    })
  },
}
