"""Schemas Pydantic para Compliance y Recordatorios."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Any
from datetime import datetime

from app.models.reminder import ReminderStatus


# ==================== RECORDATORIOS ====================

class ReminderBase(BaseModel):
    """Base schema para Recordatorio."""
    location_id: int
    contact_id: int
    scheduled_for: datetime
    timezone: str = "America/Mexico_City"


class ReminderCreate(ReminderBase):
    """Schema para crear un Recordatorio."""
    pass


class ReminderResponse(BaseModel):
    """Schema de respuesta para Recordatorio."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    location_id: int
    contact_id: Optional[int]
    scheduled_for: datetime
    timezone: str
    status: ReminderStatus
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    responded_at: Optional[datetime]
    escalation_count: int
    escalated_at: Optional[datetime]
    compliance_record_id: Optional[int]
    created_at: datetime


class ReminderList(BaseModel):
    """Schema para lista de recordatorios."""
    items: list[ReminderResponse]
    total: int
    page: int
    page_size: int
    pages: int


# ==================== COMPLIANCE ====================

class ComplianceBase(BaseModel):
    """Base schema para registro de Compliance."""
    location_id: int
    contact_id: int
    reminder_id: Optional[int] = None
    contact_notes: Optional[str] = None


class ComplianceCreate(ComplianceBase):
    """Schema para crear un registro de Compliance (sin foto)."""
    pass


class AIValidationResult(BaseModel):
    """Resultado de validación de IA."""
    is_valid: bool
    confidence: float = Field(..., ge=0, le=1)
    product_detected: bool
    drainage_area_visible: bool
    appears_recent: bool
    issues: list[str]
    summary: str


class ComplianceResponse(BaseModel):
    """Schema de respuesta para Compliance."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    location_id: int
    contact_id: Optional[int]
    reminder_id: Optional[int]

    # Foto
    photo_url: Optional[str]
    photo_received_at: Optional[datetime]

    # Geolocalización
    photo_latitude: Optional[float]
    photo_longitude: Optional[float]

    # Validación IA
    ai_validated: Optional[bool]
    ai_confidence: Optional[float]
    ai_summary: Optional[str]
    ai_issues: Optional[list[str]]
    ai_validated_at: Optional[datetime]

    # Validación manual
    manual_validated: Optional[bool]
    manual_validated_at: Optional[datetime]
    validation_notes: Optional[str]

    # Estado final
    is_valid: Optional[bool]

    # Notas
    contact_notes: Optional[str]

    created_at: datetime
    updated_at: datetime


class ComplianceWithDetails(ComplianceResponse):
    """Schema con detalles completos de validación IA."""
    ai_validation: Optional[dict[str, Any]]
    ai_product_detected: Optional[bool]
    ai_drainage_visible: Optional[bool]
    ai_appears_recent: Optional[bool]
    ai_processing_time_ms: Optional[int]


class ComplianceList(BaseModel):
    """Schema para lista de compliance."""
    items: list[ComplianceResponse]
    total: int
    page: int
    page_size: int
    pages: int


class ManualValidationRequest(BaseModel):
    """Schema para validación manual."""
    is_valid: bool
    notes: Optional[str] = Field(None, max_length=500)


# ==================== DASHBOARD ====================

class DashboardStats(BaseModel):
    """Estadísticas del dashboard."""
    total_clients: int
    total_locations: int
    total_contacts: int
    linked_contacts: int
    pending_reminders: int
    completed_today: int
    compliance_rate_7d: float  # Porcentaje de cumplimiento últimos 7 días
    escalated_count: int


class LocationComplianceStatus(BaseModel):
    """Estado de compliance por ubicación."""
    location_id: int
    location_name: str
    client_name: str
    last_compliance_at: Optional[datetime]
    days_since_compliance: Optional[int]
    next_reminder_at: Optional[datetime]
    status: str  # "ok", "pending", "overdue", "critical"
