import { api, API_URL } from "@/lib/api"
import type {
  ComplianceRecord,
  ComplianceRecordWithDetails,
  PaginatedResponse,
  PaginationParams,
} from "@/types"

interface ComplianceListParams extends PaginationParams {
  location_id?: number
  contact_id?: number
  is_valid?: boolean
  date_from?: string
  date_to?: string
}

export interface ComplianceStats {
  total: number
  validated: number
  pending_review: number
  rejected: number
}

export const complianceService = {
  /**
   * Lista todos los registros de compliance con paginación y filtros
   */
  async list(params: ComplianceListParams = {}): Promise<PaginatedResponse<ComplianceRecord>> {
    return api.get<PaginatedResponse<ComplianceRecord>>("/api/compliance/records", { params })
  },

  /**
   * Obtiene un registro de compliance por ID con detalles completos
   */
  async get(id: number): Promise<ComplianceRecordWithDetails> {
    return api.get<ComplianceRecordWithDetails>(`/api/compliance/records/${id}`)
  },

  /**
   * Obtiene la URL de la foto de un registro de compliance
   */
  getPhotoUrl(id: number): string {
    return `${API_URL}/api/compliance/records/${id}/photo`
  },

  /**
   * Obtiene estadísticas de compliance del dashboard
   */
  async getStats(): Promise<ComplianceStats> {
    try {
      return await api.get<ComplianceStats>("/api/compliance/dashboard/stats")
    } catch {
      // If endpoint doesn't exist, return default stats
      return { total: 0, validated: 0, pending_review: 0, rejected: 0 }
    }
  },

  /**
   * Valida manualmente un registro de compliance
   */
  async validate(id: number, validatedById: number, isValid: boolean, notes?: string): Promise<ComplianceRecord> {
    return api.post<ComplianceRecord>(
      `/api/compliance/records/${id}/validate`,
      { is_valid: isValid, notes },
      { params: { validated_by_id: validatedById } }
    )
  },

  /**
   * Crea un recordatorio manual para una ubicación
   */
  async createReminder(data: {
    location_id: number
    contact_id: number
    scheduled_for: string
    timezone?: string
  }): Promise<{ id: number }> {
    return api.post<{ id: number }>("/api/compliance/reminders", {
      ...data,
      timezone: data.timezone || "America/Mexico_City",
    })
  },
}
