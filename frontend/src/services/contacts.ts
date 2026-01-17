import { api } from "@/lib/api"
import type {
  Contact,
  ContactCreate,
  ContactUpdate,
  ContactWithInviteCode,
  ContactRole,
  PaginatedResponse,
  PaginationParams,
} from "@/types"

interface ContactListParams extends PaginationParams {
  client_id?: number
  role?: ContactRole
  linked_only?: boolean
  active_only?: boolean
}

export const contactsService = {
  /**
   * Lista todos los contactos con paginación y filtros
   */
  async list(params: ContactListParams = {}): Promise<PaginatedResponse<Contact>> {
    return api.get<PaginatedResponse<Contact>>("/api/contacts", { params })
  },

  /**
   * Obtiene un contacto por ID
   */
  async get(id: number): Promise<Contact> {
    return api.get<Contact>(`/api/contacts/${id}`)
  },

  /**
   * Crea un nuevo contacto (retorna con código de invitación)
   */
  async create(data: ContactCreate): Promise<ContactWithInviteCode> {
    return api.post<ContactWithInviteCode>("/api/contacts", data)
  },

  /**
   * Actualiza un contacto existente
   */
  async update(id: number, data: ContactUpdate): Promise<Contact> {
    return api.patch<Contact>(`/api/contacts/${id}`, data)
  },

  /**
   * Elimina un contacto (soft delete por defecto)
   */
  async delete(id: number, hardDelete = false): Promise<void> {
    await api.delete(`/api/contacts/${id}`, {
      params: { hard_delete: hardDelete },
    })
  },

  /**
   * Regenera el código de invitación de un contacto
   */
  async regenerateInviteCode(id: number): Promise<ContactWithInviteCode> {
    return api.post<ContactWithInviteCode>(`/api/contacts/${id}/regenerate-invite`)
  },

  /**
   * Desvincula Telegram de un contacto
   */
  async unlinkTelegram(id: number): Promise<Contact> {
    return api.post<Contact>(`/api/contacts/${id}/unlink-telegram`)
  },
}
