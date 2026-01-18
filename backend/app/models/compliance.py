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

    # Ubicación y contacto que reportó (nullable para fotos sin recordatorio)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=True, index=True)
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

    # Coordenadas esperadas (de la ubicación registrada)
    expected_latitude = Column(Float, nullable=True)
    expected_longitude = Column(Float, nullable=True)

    # Score de autenticidad (Photo Guard)
    authenticity_score = Column(Integer, nullable=True)  # 0-100
    location_verified = Column(Boolean, nullable=True)  # Ubicación coincide
    time_verified = Column(Boolean, nullable=True)  # Dentro de ventana válida
    distance_from_expected = Column(Float, nullable=True)  # Distancia en metros
    time_diff_minutes = Column(Integer, nullable=True)  # Diferencia con recordatorio

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
    ai_appears_screenshot = Column(Boolean, nullable=True)  # Detecta foto de pantalla
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
        self.ai_appears_screenshot = validation_result.get("appears_screenshot", False)
        self.ai_issues = validation_result.get("issues", [])
        self.ai_summary = validation_result.get("summary")
        self.ai_validated_at = datetime.utcnow()
        if processing_time_ms:
            self.ai_processing_time_ms = processing_time_ms

        # Calcular score de autenticidad después de la validación IA
        self.calculate_authenticity_score()

        # Si el score es alto y no hay problemas, marcar como válido
        if (self.authenticity_score and
            self.authenticity_score >= 80 and
            not self.ai_appears_screenshot):
            self.is_valid = True

    def calculate_authenticity_score(self):
        """
        Calcula el score de autenticidad basado en 3 factores:
        - Geolocalización (40 puntos)
        - Ventana de tiempo (30 puntos)
        - Validación IA (30 puntos)
        """
        score = 0

        # Factor 1: Geolocalización (40 puntos)
        if self.photo_latitude and self.photo_longitude:
            if self.distance_from_expected is not None:
                if self.distance_from_expected <= 100:
                    score += 40  # Muy cerca
                    self.location_verified = True
                elif self.distance_from_expected <= 300:
                    score += 30  # Cerca
                    self.location_verified = True
                elif self.distance_from_expected <= 500:
                    score += 20  # Aceptable
                    self.location_verified = True
                else:
                    self.location_verified = False
            else:
                # Sin ubicación esperada, dar puntos parciales por compartir ubicación
                score += 15
                self.location_verified = None
        else:
            self.location_verified = False

        # Factor 2: Ventana de tiempo (30 puntos)
        if self.time_diff_minutes is not None:
            abs_diff = abs(self.time_diff_minutes)
            if abs_diff <= 30:
                score += 30  # Muy reciente
                self.time_verified = True
            elif abs_diff <= 120:
                score += 20  # Reciente
                self.time_verified = True
            elif abs_diff <= 240:
                score += 10  # Aceptable
                self.time_verified = True
            else:
                self.time_verified = False
        else:
            # Sin recordatorio asociado, dar puntos base
            score += 15
            self.time_verified = None

        # Factor 3: Validación IA (30 puntos)
        if self.ai_confidence is not None:
            if self.ai_confidence >= 0.8:
                score += 30
            elif self.ai_confidence >= 0.6:
                score += 20
            elif self.ai_confidence >= 0.4:
                score += 10

        # Penalización por screenshot detectado
        if self.ai_appears_screenshot:
            score -= 50

        self.authenticity_score = max(0, min(100, score))

    def set_manual_validation(self, is_valid: bool, validated_by_id: int, notes: str = None):
        """Establece validación manual."""
        self.manual_validated = is_valid
        self.manual_validated_at = datetime.utcnow()
        self.validated_by = validated_by_id
        self.validation_notes = notes
        self.is_valid = is_valid  # La validación manual es definitiva
