from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class ComplianceRecord(Base):
    """
    Modelo de Registro de Cumplimiento.

    Representa una evidencia de aplicación de producto enviada por un contacto.
    Incluye la foto, validación de IA y validación manual si aplica.
    """
    __tablename__ = "compliance_records"

    id = Column(Integer, primary_key=True, index=True)

    # Ubicación y contacto que reportó
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)

    # Recordatorio asociado (si aplica)
    reminder_id = Column(Integer, ForeignKey("scheduled_reminders.id"), nullable=True)

    # Foto de evidencia
    photo_url = Column(String(500))  # URL en storage
    photo_file_id = Column(String(100))  # File ID de Telegram
    photo_file_path = Column(String(500))  # Ruta local si aplica

    # Metadata de la foto
    photo_received_at = Column(DateTime, default=datetime.utcnow)
    photo_size_bytes = Column(Integer)
    photo_width = Column(Integer)
    photo_height = Column(Integer)

    # Geolocalización de la foto (si el usuario la compartió)
    photo_latitude = Column(Float, nullable=True)
    photo_longitude = Column(Float, nullable=True)
    photo_location_accuracy = Column(Float, nullable=True)  # metros

    # Validación con IA (Claude Vision)
    ai_validation = Column(JSONB, nullable=True)  # Resultado completo de Claude
    ai_validated = Column(Boolean, nullable=True)  # True si IA aprobó
    ai_confidence = Column(Float, nullable=True)  # 0.0 a 1.0
    ai_validated_at = Column(DateTime, nullable=True)
    ai_processing_time_ms = Column(Integer, nullable=True)

    # Campos específicos de validación IA
    ai_product_detected = Column(Boolean, nullable=True)
    ai_drainage_visible = Column(Boolean, nullable=True)
    ai_appears_recent = Column(Boolean, nullable=True)
    ai_issues = Column(JSONB, nullable=True)  # Lista de problemas detectados
    ai_summary = Column(Text, nullable=True)

    # Validación manual (por admin)
    manual_validated = Column(Boolean, nullable=True)
    manual_validated_at = Column(DateTime, nullable=True)
    validated_by = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    validation_notes = Column(Text, nullable=True)

    # Estado final
    is_valid = Column(Boolean, nullable=True)  # Validación final (IA + manual)

    # Notas del contacto
    contact_notes = Column(Text, nullable=True)  # Notas que envió el usuario

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    location = relationship("Location", back_populates="compliance_records")
    contact = relationship("Contact", back_populates="compliance_records", foreign_keys=[contact_id])
    reminder = relationship("ScheduledReminder", foreign_keys=[reminder_id])

    def __repr__(self):
        return f"<ComplianceRecord(id={self.id}, location_id={self.location_id}, is_valid={self.is_valid})>"

    def set_ai_validation(self, validation_result: dict, processing_time_ms: int = None):
        """Establece el resultado de validación de IA."""
        self.ai_validation = validation_result
        self.ai_validated = validation_result.get("is_valid", False)
        self.ai_confidence = validation_result.get("confidence", 0.0)
        self.ai_product_detected = validation_result.get("product_detected")
        self.ai_drainage_visible = validation_result.get("drainage_area_visible")
        self.ai_appears_recent = validation_result.get("appears_recent")
        self.ai_issues = validation_result.get("issues", [])
        self.ai_summary = validation_result.get("summary")
        self.ai_validated_at = datetime.utcnow()
        if processing_time_ms:
            self.ai_processing_time_ms = processing_time_ms

        # Si la IA valida con alta confianza Y detectó ambos criterios, marcar como válido
        # Requiere: confianza >= 90%, producto detectado Y área de drenaje visible
        if (self.ai_validated and
            self.ai_confidence >= 0.90 and
            self.ai_product_detected and
            self.ai_drainage_visible):
            self.is_valid = True

    def set_manual_validation(self, is_valid: bool, validated_by_id: int, notes: str = None):
        """Establece validación manual."""
        self.manual_validated = is_valid
        self.manual_validated_at = datetime.utcnow()
        self.validated_by = validated_by_id
        self.validation_notes = notes
        self.is_valid = is_valid  # La validación manual es definitiva
