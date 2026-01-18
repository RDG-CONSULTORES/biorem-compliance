from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class NotificationType(str, enum.Enum):
    """Tipos de notificación."""
    REMINDER = "reminder"  # Recordatorio de aplicación
    ESCALATION = "escalation"  # Escalamiento por falta de respuesta
    CONFIRMATION = "confirmation"  # Confirmación de recepción
    VALIDATION_SUCCESS = "validation_success"  # Validación exitosa
    VALIDATION_FAILED = "validation_failed"  # Validación fallida
    WELCOME = "welcome"  # Bienvenida al vincular
    LINK_CODE = "link_code"  # Código de vinculación
    ADMIN_ALERT = "admin_alert"  # Alerta para administrador
    SYSTEM = "system"  # Mensaje del sistema
    ORDER_NEW = "order_new"  # Nuevo pedido creado
    ORDER_APPROVED = "order_approved"  # Pedido aprobado
    ORDER_REJECTED = "order_rejected"  # Pedido rechazado
    ORDER_STATUS = "order_status"  # Cambio de estado de pedido


class NotificationLog(Base):
    """
    Modelo de Log de Notificaciones.

    Registra todas las notificaciones enviadas por el sistema,
    principalmente a través de Telegram.
    """
    __tablename__ = "notification_log"

    id = Column(Integer, primary_key=True, index=True)

    # Destinatario
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    telegram_chat_id = Column(String(50), nullable=True, index=True)

    # Recordatorio relacionado (si aplica)
    reminder_id = Column(Integer, ForeignKey("scheduled_reminders.id", ondelete="SET NULL"), nullable=True)

    # Tipo y contenido
    notification_type = Column(Enum(NotificationType), nullable=False, index=True)
    subject = Column(String(255))  # Título/asunto corto
    message = Column(Text, nullable=False)  # Mensaje completo enviado

    # Estado de entrega
    sent_at = Column(DateTime, default=datetime.utcnow)
    delivered = Column(Boolean, default=False)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)

    # Telegram específico
    telegram_message_id = Column(String(50), nullable=True)

    # Error tracking
    failed = Column(Boolean, default=False)
    error_message = Column(String(500), nullable=True)
    retry_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    contact = relationship("Contact", back_populates="notifications")

    def __repr__(self):
        return f"<NotificationLog(id={self.id}, type={self.notification_type}, contact_id={self.contact_id})>"

    def mark_as_delivered(self, message_id: str = None):
        """Marca la notificación como entregada."""
        self.delivered = True
        self.delivered_at = datetime.utcnow()
        if message_id:
            self.telegram_message_id = message_id

    def mark_as_failed(self, error: str):
        """Marca la notificación como fallida."""
        self.failed = True
        self.error_message = error
        self.retry_count += 1
