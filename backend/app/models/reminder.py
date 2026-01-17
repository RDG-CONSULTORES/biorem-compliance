from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class ReminderStatus(str, enum.Enum):
    """Estados posibles de un recordatorio."""
    PENDING = "pending"  # Programado, aún no enviado
    SENT = "sent"  # Enviado, esperando respuesta
    COMPLETED = "completed"  # Completado exitosamente
    FAILED = "failed"  # Falló el envío
    ESCALATED = "escalated"  # Escalado por falta de respuesta
    CANCELLED = "cancelled"  # Cancelado manualmente
    EXPIRED = "expired"  # Expiró sin respuesta


class ScheduledReminder(Base):
    """
    Modelo de Recordatorio Programado.

    Representa un recordatorio específico que debe enviarse a un contacto
    para que realice la aplicación del producto en una ubicación.
    """
    __tablename__ = "scheduled_reminders"

    id = Column(Integer, primary_key=True, index=True)

    # Ubicación y contacto
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)

    # Programación
    scheduled_for = Column(DateTime, nullable=False, index=True)  # Cuándo enviar
    timezone = Column(String(50), default="America/Mexico_City")

    # Estado del recordatorio
    status = Column(Enum(ReminderStatus), default=ReminderStatus.PENDING, index=True)

    # Timestamps de envío
    sent_at = Column(DateTime, nullable=True)  # Cuándo se envió
    delivered_at = Column(DateTime, nullable=True)  # Confirmación de entrega de Telegram
    responded_at = Column(DateTime, nullable=True)  # Cuándo respondió el usuario

    # Escalamiento
    escalation_count = Column(Integer, default=0)  # Cuántas veces se ha escalado
    escalated_at = Column(DateTime, nullable=True)
    escalated_to = Column(Integer, ForeignKey("contacts.id"), nullable=True)  # A quién se escaló

    # Referencia al registro de compliance (cuando se completa)
    compliance_record_id = Column(Integer, ForeignKey("compliance_records.id"), nullable=True)

    # Mensaje de Telegram
    telegram_message_id = Column(String(50), nullable=True)  # ID del mensaje enviado

    # Notas
    notes = Column(String(500))
    failure_reason = Column(String(255))  # Razón de fallo si aplica

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    location = relationship("Location", back_populates="reminders")
    contact = relationship("Contact", back_populates="reminders", foreign_keys=[contact_id])
    compliance_record = relationship("ComplianceRecord", foreign_keys=[compliance_record_id])

    def __repr__(self):
        return f"<ScheduledReminder(id={self.id}, location_id={self.location_id}, status={self.status})>"

    def is_pending(self) -> bool:
        return self.status == ReminderStatus.PENDING

    def is_awaiting_response(self) -> bool:
        return self.status == ReminderStatus.SENT

    def mark_as_sent(self, message_id: str = None):
        """Marca el recordatorio como enviado."""
        self.status = ReminderStatus.SENT
        self.sent_at = datetime.utcnow()
        if message_id:
            self.telegram_message_id = message_id

    def mark_as_completed(self, compliance_record_id: int):
        """Marca el recordatorio como completado."""
        self.status = ReminderStatus.COMPLETED
        self.responded_at = datetime.utcnow()
        self.compliance_record_id = compliance_record_id

    def mark_as_escalated(self, escalated_to_id: int):
        """Marca el recordatorio como escalado."""
        self.status = ReminderStatus.ESCALATED
        self.escalation_count += 1
        self.escalated_at = datetime.utcnow()
        self.escalated_to = escalated_to_id
