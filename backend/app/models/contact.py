from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import secrets

from app.database import Base


class ContactRole(str, enum.Enum):
    """Roles de contacto dentro del cliente."""
    ADMIN = "admin"  # Puede ver todo el cliente
    SUPERVISOR = "supervisor"  # Puede ver múltiples ubicaciones
    OPERADOR = "operador"  # Solo su ubicación asignada
    READONLY = "readonly"  # Solo puede ver reportes


class Contact(Base):
    """
    Modelo de Contacto - Representa una persona vinculada a un cliente.

    Los contactos reciben recordatorios por Telegram y envían fotos de evidencia.
    """
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)

    # Información personal
    name = Column(String(255), nullable=False)
    phone = Column(String(20))
    email = Column(String(255))
    role = Column(Enum(ContactRole), default=ContactRole.OPERADOR)

    # Vinculación con Telegram
    telegram_id = Column(String(50), unique=True, nullable=True, index=True)
    telegram_username = Column(String(100), nullable=True)
    telegram_first_name = Column(String(100), nullable=True)

    # Código de invitación para vincular Telegram
    invite_code = Column(String(20), unique=True, index=True)
    invite_code_expires_at = Column(DateTime, nullable=True)

    # Estado de vinculación
    linked_at = Column(DateTime, nullable=True)  # Cuándo vinculó su Telegram
    last_interaction_at = Column(DateTime, nullable=True)

    # Preferencias de notificación
    notifications_enabled = Column(Boolean, default=True)
    quiet_hours_start = Column(String(5), nullable=True)  # HH:MM
    quiet_hours_end = Column(String(5), nullable=True)  # HH:MM

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    active = Column(Boolean, default=True, index=True)

    # Relaciones
    client = relationship("Client", back_populates="contacts")
    reminders = relationship(
        "ScheduledReminder",
        back_populates="contact",
        foreign_keys="[ScheduledReminder.contact_id]"
    )
    escalated_reminders = relationship(
        "ScheduledReminder",
        foreign_keys="[ScheduledReminder.escalated_to]",
        overlaps="contact,reminders"
    )
    compliance_records = relationship(
        "ComplianceRecord",
        back_populates="contact",
        foreign_keys="[ComplianceRecord.contact_id]"
    )
    validated_records = relationship(
        "ComplianceRecord",
        foreign_keys="[ComplianceRecord.validated_by]",
        overlaps="contact,compliance_records"
    )
    notifications = relationship("NotificationLog", back_populates="contact")

    def __repr__(self):
        return f"<Contact(id={self.id}, name='{self.name}', telegram_id={self.telegram_id})>"

    @staticmethod
    def generate_invite_code() -> str:
        """Genera un código de invitación único de 8 caracteres."""
        return secrets.token_urlsafe(6)[:8].upper()

    def is_linked(self) -> bool:
        """Verifica si el contacto tiene Telegram vinculado."""
        return self.telegram_id is not None and self.linked_at is not None
