import { api } from "@/lib/api"
import type {
  Client,
  ClientCreate,
  ClientUpdate,
  PaginatedResponse,
  PaginationParams,
  BusinessType,
  Contact,
  Location,
} from "@/types"

interface ClientListParams extends PaginationParams {
  business_type?: BusinessType
  active_only?: boolean
}

export const clientsService = {
  /**
   * Lista todos los clientes con paginación y filtros
   */
  async list(params: ClientListParams = {}): Promise<PaginatedResponse<Client>> {
    return api.get<PaginatedResponse<Client>>("/api/clients", { params })
  },

  /**
   * Obtiene un cliente por ID
   */
  async get(id: number): Promise<Client> {
    return api.get<Client>(`/api/clients/${id}`)
  },

  /**
   * Crea un nuevo cliente
   */
  async create(data: ClientCreate): Promise<Client> {
    return api.post<Client>("/api/clients", data)
  },

  /**
   * Actualiza un cliente existente
   */
  async update(id: number, data: ClientUpdate): Promise<Client> {
    return api.patch<Client>(`/api/clients/${id}`, data)
  },

  /**
   * Elimina un cliente (soft delete por defecto)
   */
  async delete(id: number, hardDelete = false): Promise<void> {
    await api.delete(`/api/clients/${id}`, {
      params: { hard_delete: hardDelete },
    })
  },

  /**
   * Obtiene las ubicaciones de un cliente
   */
  async getLocations(clientId: number, activeOnly = true): Promise<Location[]> {
    return api.get<Location[]>(`/api/clients/${clientId}/locations`, {
      params: { active_only: activeOnly },
    })
  },

  /**
   * Obtiene los contactos de un cliente
   */
  async getContacts(clientId: number, activeOnly = true): Promise<Contact[]> {
    return api.get<Contact[]>(`/api/clients/${clientId}/contacts`, {
      params: { active_only: activeOnly },
    })
  },
}
