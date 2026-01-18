"""Modelo para órdenes de productos."""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class OrderStatus(str, enum.Enum):
    """Estados posibles de una orden."""
    PENDING = "pending"           # Pendiente de aprobación
    APPROVED = "approved"         # Aprobada por admin
    REJECTED = "rejected"         # Rechazada por admin
    PROCESSING = "processing"     # En proceso de preparación
    SHIPPED = "shipped"           # Enviada
    DELIVERED = "delivered"       # Entregada
    CANCELLED = "cancelled"       # Cancelada


class ProductOrder(Base):
    """
    Pre-orden de productos.

    Flujo:
    1. Usuario crea pedido desde WebApp con firma
    2. Admin recibe notificación y revisa
    3. Admin aprueba o rechaza
    4. Si aprobada: processing → shipped → delivered
    """
    __tablename__ = "product_orders"

    id = Column(Integer, primary_key=True, index=True)

    # Relaciones
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)

    # Items del pedido
    # Formato: [{"product_id": 1, "product_name": "...", "quantity": 2, "notes": "..."}]
    items = Column(JSONB, nullable=False)

    # Notas generales del pedido
    notes = Column(Text, nullable=True)

    # Estado
    status = Column(
        SQLEnum(OrderStatus, name="order_status", create_type=False),
        default=OrderStatus.PENDING,
        nullable=False
    )

    # Firma digital
    signature_data = Column(Text, nullable=True)  # Base64 PNG
    signed_by_name = Column(String(100), nullable=False)
    signed_at = Column(DateTime, nullable=False)
    signature_latitude = Column(Float, nullable=True)
    signature_longitude = Column(Float, nullable=True)

    # Revisión por admin
    reviewed_by_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    admin_notes = Column(Text, nullable=True)

    # Metadata
    telegram_user_id = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones ORM
    location = relationship("Location", backref="orders", foreign_keys=[location_id])
    contact = relationship("Contact", backref="orders", foreign_keys=[contact_id])
    reviewed_by = relationship("Contact", foreign_keys=[reviewed_by_id])

    def __repr__(self):
        return f"<ProductOrder {self.id} - {self.status.value}>"

    @property
    def total_items(self) -> int:
        """Cantidad total de items en el pedido."""
        if not self.items:
            return 0
        return sum(item.get("quantity", 0) for item in self.items)

    @property
    def product_count(self) -> int:
        """Cantidad de productos diferentes."""
        if not self.items:
            return 0
        return len(self.items)
