"""Schemas Pydantic para Ubicaciones."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, time


class LocationBase(BaseModel):
    """Base schema para Ubicación."""
    name: str = Field(..., min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    product_id: Optional[int] = None
    frequency_days: int = Field(7, ge=1, le=365)
    reminder_time: time = Field(default=time(9, 0))
    reminder_days: str = Field("1,2,3,4,5", pattern=r"^[1-7](,[1-7])*$")


class LocationCreate(LocationBase):
    """Schema para crear una Ubicación."""
    client_id: int


class LocationUpdate(BaseModel):
    """Schema para actualizar una Ubicación."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    product_id: Optional[int] = None
    frequency_days: Optional[int] = Field(None, ge=1, le=365)
    reminder_time: Optional[time] = None
    reminder_days: Optional[str] = Field(None, pattern=r"^[1-7](,[1-7])*$")
    active: Optional[bool] = None


class LocationResponse(LocationBase):
    """Schema de respuesta para Ubicación."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    last_compliance_at: Optional[datetime] = None
    active: bool
    created_at: datetime
    updated_at: datetime


class LocationList(BaseModel):
    """Schema para lista de ubicaciones con paginación."""
    items: list[LocationResponse]
    total: int
    page: int
    page_size: int
    pages: int
