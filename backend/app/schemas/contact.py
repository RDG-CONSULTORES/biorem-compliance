"""Schemas Pydantic para Contactos."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

from app.models.contact import ContactRole


class ContactBase(BaseModel):
    """Base schema para Contacto."""
    name: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    role: ContactRole = ContactRole.OPERADOR
    notifications_enabled: bool = True
    quiet_hours_start: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    quiet_hours_end: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")


class ContactCreate(ContactBase):
    """Schema para crear un Contacto."""
    client_id: int


class ContactUpdate(BaseModel):
    """Schema para actualizar un Contacto."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    role: Optional[ContactRole] = None
    notifications_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    quiet_hours_end: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    active: Optional[bool] = None


class ContactResponse(ContactBase):
    """Schema de respuesta para Contacto."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    telegram_id: Optional[str] = None
    telegram_username: Optional[str] = None
    telegram_first_name: Optional[str] = None
    invite_code: Optional[str] = None
    linked_at: Optional[datetime] = None
    last_interaction_at: Optional[datetime] = None
    active: bool
    created_at: datetime
    updated_at: datetime

    @property
    def is_linked(self) -> bool:
        return self.telegram_id is not None and self.linked_at is not None


class ContactWithInviteCode(ContactResponse):
    """Schema de respuesta con código de invitación visible."""
    invite_code: str


class ContactList(BaseModel):
    """Schema para lista de contactos con paginación."""
    items: list[ContactResponse]
    total: int
    page: int
    page_size: int
    pages: int


class TelegramLinkRequest(BaseModel):
    """Schema para vincular Telegram con código."""
    invite_code: str = Field(..., min_length=6, max_length=20)
