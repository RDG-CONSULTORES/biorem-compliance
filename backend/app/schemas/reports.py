"""Schemas Pydantic para Reportes de Compliance."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class PeriodType(str, Enum):
    """Tipos de agrupación por período."""
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class ReportSummary(BaseModel):
    """Resumen general de compliance para un período."""
    period_start: Optional[datetime]
    period_end: Optional[datetime]
    total_records: int
    validated: int
    rejected: int
    pending_review: int
    compliance_rate: float  # Porcentaje 0-100
    avg_response_time_hours: float
    avg_ai_confidence: float  # Porcentaje 0-100
    total_locations: int
    locations_with_issues: int


class ClientComplianceReport(BaseModel):
    """Reporte de compliance por cliente."""
    client_id: int
    client_name: str
    business_type: Optional[str]
    total_locations: int
    total_records: int
    validated: int
    rejected: int
    pending_review: int
    compliance_rate: float  # Porcentaje 0-100
    last_activity: Optional[datetime]


class LocationComplianceReport(BaseModel):
    """Reporte de compliance por ubicación."""
    location_id: int
    location_name: str
    client_id: int
    client_name: str
    total_records: int
    validated: int
    rejected: int
    pending_review: int
    compliance_rate: float  # Porcentaje 0-100
    last_compliance_at: Optional[datetime]
    days_since_compliance: Optional[int]
    frequency_days: int
    status: str  # "ok", "pending", "overdue", "critical"


class ComplianceTrend(BaseModel):
    """Tendencia de compliance para un período específico."""
    period_key: str  # Identificador único del período (fecha ISO)
    period_label: str  # Etiqueta legible (ej: "15 Ene", "Sem 1 Ene")
    total_records: int
    validated: int
    rejected: int
    pending_review: int
    compliance_rate: float  # Porcentaje 0-100
