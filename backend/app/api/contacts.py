"""API endpoints para Contactos."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime, timedelta
import math

from app.database import get_db
from app.models.contact import Contact, ContactRole
from app.models.client import Client
from app.schemas.contact import (
    ContactCreate, ContactUpdate, ContactResponse,
    ContactWithInviteCode, ContactList
)

router = APIRouter()


@router.get("", response_model=ContactList)
async def list_contacts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    client_id: Optional[int] = None,
    role: Optional[ContactRole] = None,
    linked_only: bool = False,
    search: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Lista todos los contactos con paginación y filtros."""
    query = select(Contact)

    # Filtros
    if active_only:
        query = query.where(Contact.active == True)
    if client_id:
        query = query.where(Contact.client_id == client_id)
    if role:
        query = query.where(Contact.role == role)
    if linked_only:
        query = query.where(Contact.telegram_id.isnot(None))
    if search:
        query = query.where(
            Contact.name.ilike(f"%{search}%") |
            Contact.phone.ilike(f"%{search}%") |
            Contact.email.ilike(f"%{search}%") |
            Contact.telegram_username.ilike(f"%{search}%")
        )

    # Contar total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Paginación
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(Contact.name)

    result = await db.execute(query)
    contacts = result.scalars().all()

    return ContactList(
        items=[ContactResponse.model_validate(c) for c in contacts],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1
    )


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Obtiene un contacto por ID."""
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id)
    )
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")

    return ContactResponse.model_validate(contact)


@router.post("", response_model=ContactWithInviteCode, status_code=201)
async def create_contact(
    contact_data: ContactCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Crea un nuevo contacto.

    Genera automáticamente un código de invitación para vincular Telegram.
    """
    # Verificar que el cliente existe
    result = await db.execute(
        select(Client).where(Client.id == contact_data.client_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    contact = Contact(**contact_data.model_dump())

    # Generar código de invitación
    contact.invite_code = Contact.generate_invite_code()
    contact.invite_code_expires_at = datetime.utcnow() + timedelta(days=7)

    db.add(contact)
    await db.flush()
    await db.refresh(contact)

    return ContactWithInviteCode.model_validate(contact)


@router.patch("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: int,
    contact_data: ContactUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Actualiza un contacto existente."""
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id)
    )
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")

    update_data = contact_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contact, field, value)

    await db.flush()
    await db.refresh(contact)

    return ContactResponse.model_validate(contact)


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: int,
    hard_delete: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """Elimina un contacto (soft delete por defecto)."""
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id)
    )
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")

    if hard_delete:
        await db.delete(contact)
    else:
        contact.active = False

    await db.flush()
    return None


@router.post("/{contact_id}/regenerate-invite", response_model=ContactWithInviteCode)
async def regenerate_invite_code(
    contact_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Regenera el código de invitación de un contacto.

    Útil si el código expiró o fue comprometido.
    """
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id)
    )
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")

    if contact.telegram_id:
        raise HTTPException(
            status_code=400,
            detail="El contacto ya tiene Telegram vinculado"
        )

    contact.invite_code = Contact.generate_invite_code()
    contact.invite_code_expires_at = datetime.utcnow() + timedelta(days=7)

    await db.flush()
    await db.refresh(contact)

    return ContactWithInviteCode.model_validate(contact)


@router.post("/{contact_id}/unlink-telegram", response_model=ContactResponse)
async def unlink_telegram(
    contact_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Desvincula Telegram de un contacto."""
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id)
    )
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")

    if not contact.telegram_id:
        raise HTTPException(
            status_code=400,
            detail="El contacto no tiene Telegram vinculado"
        )

    contact.telegram_id = None
    contact.telegram_username = None
    contact.telegram_first_name = None
    contact.linked_at = None

    # Generar nuevo código de invitación
    contact.invite_code = Contact.generate_invite_code()
    contact.invite_code_expires_at = datetime.utcnow() + timedelta(days=7)

    await db.flush()
    await db.refresh(contact)

    return ContactResponse.model_validate(contact)
