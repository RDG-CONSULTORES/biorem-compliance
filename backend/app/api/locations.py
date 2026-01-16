"""API endpoints para Ubicaciones."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
import math

from app.database import get_db
from app.models.location import Location
from app.models.client import Client
from app.schemas.location import (
    LocationCreate, LocationUpdate, LocationResponse, LocationList
)

router = APIRouter()


@router.get("", response_model=LocationList)
async def list_locations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    client_id: Optional[int] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Lista todas las ubicaciones con paginación y filtros."""
    query = select(Location)

    # Filtros
    if active_only:
        query = query.where(Location.active == True)
    if client_id:
        query = query.where(Location.client_id == client_id)
    if search:
        query = query.where(
            Location.name.ilike(f"%{search}%") |
            Location.code.ilike(f"%{search}%") |
            Location.address.ilike(f"%{search}%")
        )

    # Contar total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Paginación
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(Location.name)

    result = await db.execute(query)
    locations = result.scalars().all()

    return LocationList(
        items=[LocationResponse.model_validate(loc) for loc in locations],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1
    )


@router.get("/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Obtiene una ubicación por ID."""
    result = await db.execute(
        select(Location).where(Location.id == location_id)
    )
    location = result.scalar_one_or_none()

    if not location:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")

    return LocationResponse.model_validate(location)


@router.post("", response_model=LocationResponse, status_code=201)
async def create_location(
    location_data: LocationCreate,
    db: AsyncSession = Depends(get_db)
):
    """Crea una nueva ubicación."""
    # Verificar que el cliente existe
    result = await db.execute(
        select(Client).where(Client.id == location_data.client_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Verificar código único si se proporciona
    if location_data.code:
        result = await db.execute(
            select(Location).where(Location.code == location_data.code)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="El código de ubicación ya está en uso"
            )

    location = Location(**location_data.model_dump())
    db.add(location)
    await db.flush()
    await db.refresh(location)

    return LocationResponse.model_validate(location)


@router.patch("/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: int,
    location_data: LocationUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Actualiza una ubicación existente."""
    result = await db.execute(
        select(Location).where(Location.id == location_id)
    )
    location = result.scalar_one_or_none()

    if not location:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")

    # Verificar código único si se cambia
    update_data = location_data.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"]:
        result = await db.execute(
            select(Location).where(
                Location.code == update_data["code"],
                Location.id != location_id
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="El código de ubicación ya está en uso"
            )

    for field, value in update_data.items():
        setattr(location, field, value)

    await db.flush()
    await db.refresh(location)

    return LocationResponse.model_validate(location)


@router.delete("/{location_id}", status_code=204)
async def delete_location(
    location_id: int,
    hard_delete: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """Elimina una ubicación (soft delete por defecto)."""
    result = await db.execute(
        select(Location).where(Location.id == location_id)
    )
    location = result.scalar_one_or_none()

    if not location:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")

    if hard_delete:
        await db.delete(location)
    else:
        location.active = False

    await db.flush()
    return None


@router.get("/{location_id}/compliance")
async def get_location_compliance_history(
    location_id: int,
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene el historial de compliance de una ubicación."""
    from app.models.compliance import ComplianceRecord
    from app.schemas.compliance import ComplianceResponse

    # Verificar ubicación
    result = await db.execute(
        select(Location).where(Location.id == location_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")

    query = (
        select(ComplianceRecord)
        .where(ComplianceRecord.location_id == location_id)
        .order_by(ComplianceRecord.created_at.desc())
        .limit(limit)
    )

    result = await db.execute(query)
    records = result.scalars().all()

    return [ComplianceResponse.model_validate(r) for r in records]
