"""Schemas Pydantic para Productos."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class ProductBase(BaseModel):
    """Base schema para Producto."""
    name: str = Field(..., min_length=1, max_length=255)
    sku: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    application_instructions: Optional[str] = None
    dosage: Optional[str] = Field(None, max_length=255)
    frequency_recommended: int = Field(7, ge=1, le=365)
    image_url: Optional[str] = Field(None, max_length=500)
    thumbnail_url: Optional[str] = Field(None, max_length=500)
    validation_keywords: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=100)


class ProductCreate(ProductBase):
    """Schema para crear un Producto."""
    pass


class ProductUpdate(BaseModel):
    """Schema para actualizar un Producto."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    sku: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    application_instructions: Optional[str] = None
    dosage: Optional[str] = Field(None, max_length=255)
    frequency_recommended: Optional[int] = Field(None, ge=1, le=365)
    image_url: Optional[str] = Field(None, max_length=500)
    thumbnail_url: Optional[str] = Field(None, max_length=500)
    validation_keywords: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=100)
    active: Optional[bool] = None


class ProductResponse(ProductBase):
    """Schema de respuesta para Producto."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    active: bool
    created_at: datetime
    updated_at: datetime


class ProductList(BaseModel):
    """Schema para lista de productos."""
    items: list[ProductResponse]
    total: int
