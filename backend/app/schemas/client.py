"""Schemas Pydantic para Clientes."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

from app.models.client import BusinessType


class ClientBase(BaseModel):
    """Base schema para Cliente."""
    name: str = Field(..., min_length=1, max_length=255)
    business_type: BusinessType = BusinessType.OTRO
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: str = "México"
    postal_code: Optional[str] = Field(None, max_length=20)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    default_reminder_time: str = Field("09:00", pattern=r"^\d{2}:\d{2}$")
    default_frequency_days: int = Field(7, ge=1, le=365)
    escalation_minutes: int = Field(120, ge=30, le=1440)
    notes: Optional[str] = Field(None, max_length=1000)


class ClientCreate(ClientBase):
    """Schema para crear un Cliente."""
    pass


class ClientUpdate(BaseModel):
    """Schema para actualizar un Cliente (todos los campos opcionales)."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    business_type: Optional[BusinessType] = None
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = None
    postal_code: Optional[str] = Field(None, max_length=20)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    default_reminder_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    default_frequency_days: Optional[int] = Field(None, ge=1, le=365)
    escalation_minutes: Optional[int] = Field(None, ge=30, le=1440)
    notes: Optional[str] = Field(None, max_length=1000)
    active: Optional[bool] = None


class ClientResponse(ClientBase):
    """Schema de respuesta para Cliente."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    active: bool
    created_at: datetime
    updated_at: datetime


class ClientList(BaseModel):
    """Schema para lista de clientes con paginación."""
    items: list[ClientResponse]
    total: int
    page: int
    page_size: int
    pages: int
