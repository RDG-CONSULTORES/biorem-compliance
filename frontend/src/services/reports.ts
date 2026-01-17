import { api } from "@/lib/api"
import type {
  PeriodPreset,
  PeriodType,
  ReportSummary,
  ClientComplianceReport,
  LocationComplianceReport,
  ComplianceTrend,
} from "@/types"

interface ReportParams {
  period?: PeriodPreset
  from_date?: string
  to_date?: string
  client_id?: number
}

interface TrendParams extends ReportParams {
  group_by?: PeriodType
}

export const reportsService = {
  /**
   * Obtiene resumen general de compliance
   */
  async getSummary(params: ReportParams = {}): Promise<ReportSummary> {
    return api.get<ReportSummary>("/api/reports/summary", { params })
  },

  /**
   * Obtiene reporte desglosado por cliente
   */
  async getByClient(params: ReportParams = {}): Promise<ClientComplianceReport[]> {
    return api.get<ClientComplianceReport[]>("/api/reports/by-client", { params })
  },

  /**
   * Obtiene reporte desglosado por ubicación
   */
  async getByLocation(params: ReportParams = {}): Promise<LocationComplianceReport[]> {
    return api.get<LocationComplianceReport[]>("/api/reports/by-location", { params })
  },

  /**
   * Obtiene tendencias de compliance
   */
  async getTrends(params: TrendParams = {}): Promise<ComplianceTrend[]> {
    return api.get<ComplianceTrend[]>("/api/reports/trends", { params })
  },
}
