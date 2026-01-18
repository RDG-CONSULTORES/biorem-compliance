"""Schemas Pydantic para Órdenes de Productos."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any
from datetime import datetime

from app.models.product_order import OrderStatus


# ==================== ORDER ITEMS ====================

class OrderItemCreate(BaseModel):
    """Item individual en un pedido."""
    product_id: int
    product_name: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(..., ge=1, le=100)
    notes: Optional[str] = Field(None, max_length=200)


class OrderItemResponse(BaseModel):
    """Item en respuesta de pedido."""
    product_id: int
    product_name: str
    quantity: int
    notes: Optional[str] = None


# ==================== ORDER CREATE ====================

class OrderCreate(BaseModel):
    """Schema para crear un pedido desde WebApp."""
    location_id: int
    items: List[OrderItemCreate] = Field(..., min_length=1)
    notes: Optional[str] = Field(None, max_length=500)

    # Firma digital
    signature_data: str = Field(..., description="Base64 PNG de la firma")
    signed_by_name: str = Field(..., min_length=2, max_length=100)
    signature_latitude: Optional[float] = None
    signature_longitude: Optional[float] = None

    # Telegram
    telegram_user_id: str


# ==================== ORDER RESPONSE ====================

class OrderResponse(BaseModel):
    """Schema de respuesta para un pedido."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    location_id: int
    contact_id: int
    items: List[Any]  # JSONB flexible
    notes: Optional[str]
    status: OrderStatus

    # Firma
    signed_by_name: str
    signed_at: datetime
    signature_latitude: Optional[float]
    signature_longitude: Optional[float]

    # Revisión
    reviewed_by_id: Optional[int]
    reviewed_at: Optional[datetime]
    rejection_reason: Optional[str]
    admin_notes: Optional[str]

    # Metadata
    telegram_user_id: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]


class OrderWithDetails(OrderResponse):
    """Pedido con detalles expandidos de relaciones."""
    # Datos de ubicación
    location_name: Optional[str] = None
    location_address: Optional[str] = None

    # Datos de contacto
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None

    # Datos de cliente
    client_id: Optional[int] = None
    client_name: Optional[str] = None

    # Datos del revisor
    reviewed_by_name: Optional[str] = None


# ==================== ORDER LIST ====================

class OrderList(BaseModel):
    """Schema para lista paginada de pedidos."""
    items: List[OrderWithDetails]
    total: int
    page: int
    page_size: int
    pages: int


# ==================== ORDER ACTIONS ====================

class OrderApprove(BaseModel):
    """Schema para aprobar un pedido."""
    admin_notes: Optional[str] = Field(None, max_length=500)


class OrderReject(BaseModel):
    """Schema para rechazar un pedido."""
    rejection_reason: str = Field(..., min_length=5, max_length=500)
    admin_notes: Optional[str] = Field(None, max_length=500)


class OrderStatusUpdate(BaseModel):
    """Schema para actualizar estado de pedido."""
    status: OrderStatus
    admin_notes: Optional[str] = Field(None, max_length=500)


# ==================== ORDER STATS ====================

class OrderStats(BaseModel):
    """Estadísticas de pedidos."""
    total: int = 0
    pending: int = 0
    approved: int = 0
    rejected: int = 0
    processing: int = 0
    shipped: int = 0
    delivered: int = 0
    cancelled: int = 0

    # Este mes
    created_this_month: int = 0
    delivered_this_month: int = 0
