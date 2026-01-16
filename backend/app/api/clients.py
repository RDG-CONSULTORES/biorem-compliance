"""API endpoints para Clientes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional
import math

from app.database import get_db
from app.models.client import Client, BusinessType
from app.schemas.client import (
    ClientCreate, ClientUpdate, ClientResponse, ClientList
)

router = APIRouter()


@router.get("", response_model=ClientList)
async def list_clients(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    business_type: Optional[BusinessType] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Lista todos los clientes con paginación y filtros."""
    # Base query
    query = select(Client)

    # Filtros
    if active_only:
        query = query.where(Client.active == True)
    if business_type:
        query = query.where(Client.business_type == business_type)
    if search:
        query = query.where(
            Client.name.ilike(f"%{search}%") |
            Client.address.ilike(f"%{search}%") |
            Client.city.ilike(f"%{search}%")
        )

    # Contar total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Paginación
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(Client.name)

    result = await db.execute(query)
    clients = result.scalars().all()

    return ClientList(
        items=[ClientResponse.model_validate(c) for c in clients],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1
    )


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Obtiene un cliente por ID."""
    result = await db.execute(
        select(Client).where(Client.id == client_id)
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    return ClientResponse.model_validate(client)


@router.post("", response_model=ClientResponse, status_code=201)
async def create_client(
    client_data: ClientCreate,
    db: AsyncSession = Depends(get_db)
):
    """Crea un nuevo cliente."""
    client = Client(**client_data.model_dump())
    db.add(client)
    await db.flush()
    await db.refresh(client)

    return ClientResponse.model_validate(client)


@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: int,
    client_data: ClientUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Actualiza un cliente existente."""
    result = await db.execute(
        select(Client).where(Client.id == client_id)
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Actualizar solo los campos proporcionados
    update_data = client_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)

    await db.flush()
    await db.refresh(client)

    return ClientResponse.model_validate(client)


@router.delete("/{client_id}", status_code=204)
async def delete_client(
    client_id: int,
    hard_delete: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """
    Elimina un cliente.

    Por defecto hace soft delete (active=False).
    Con hard_delete=True elimina permanentemente.
    """
    result = await db.execute(
        select(Client).where(Client.id == client_id)
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if hard_delete:
        await db.delete(client)
    else:
        client.active = False

    await db.flush()
    return None


@router.get("/{client_id}/locations")
async def get_client_locations(
    client_id: int,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Obtiene todas las ubicaciones de un cliente."""
    from app.models.location import Location
    from app.schemas.location import LocationResponse

    # Verificar que el cliente existe
    result = await db.execute(
        select(Client).where(Client.id == client_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    query = select(Location).where(Location.client_id == client_id)
    if active_only:
        query = query.where(Location.active == True)

    result = await db.execute(query.order_by(Location.name))
    locations = result.scalars().all()

    return [LocationResponse.model_validate(loc) for loc in locations]


@router.get("/{client_id}/contacts")
async def get_client_contacts(
    client_id: int,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Obtiene todos los contactos de un cliente."""
    from app.models.contact import Contact
    from app.schemas.contact import ContactResponse

    # Verificar que el cliente existe
    result = await db.execute(
        select(Client).where(Client.id == client_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    query = select(Contact).where(Contact.client_id == client_id)
    if active_only:
        query = query.where(Contact.active == True)

    result = await db.execute(query.order_by(Contact.name))
    contacts = result.scalars().all()

    return [ContactResponse.model_validate(c) for c in contacts]
