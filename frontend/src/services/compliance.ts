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

/**
 * Estadísticas de validación de compliance.
 * Coincide con ComplianceValidationStats del backend.
 */
export interface ComplianceStats {
  total: number
  validated: number
  pending_review: number
  rejected: number
  // Desglose adicional
  validated_by_ai: number
  validated_manually: number
  // Métricas del mes
  validated_this_month: number
  rejected_this_month: number
  // Tasa de aprobación
  approval_rate: number
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
   * Obtiene estadísticas de validación de compliance.
   * Usa el endpoint /api/compliance/validation-stats
   */
  async getStats(): Promise<ComplianceStats> {
    return api.get<ComplianceStats>("/api/compliance/validation-stats")
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
