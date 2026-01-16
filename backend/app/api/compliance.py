"""API endpoints para Compliance y Recordatorios."""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime, timedelta
import math
import base64

from app.database import get_db
from app.models.compliance import ComplianceRecord
from app.models.reminder import ScheduledReminder, ReminderStatus
from app.models.location import Location
from app.models.contact import Contact
from app.schemas.compliance import (
    ComplianceResponse, ComplianceWithDetails, ComplianceList,
    ReminderResponse, ReminderList, ReminderCreate,
    ManualValidationRequest, DashboardStats, LocationComplianceStatus
)

router = APIRouter()


# ==================== COMPLIANCE ====================

@router.get("/records", response_model=ComplianceList)
async def list_compliance_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    location_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    is_valid: Optional[bool] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """Lista registros de compliance con filtros."""
    query = select(ComplianceRecord)

    # Filtros
    if location_id:
        query = query.where(ComplianceRecord.location_id == location_id)
    if contact_id:
        query = query.where(ComplianceRecord.contact_id == contact_id)
    if is_valid is not None:
        query = query.where(ComplianceRecord.is_valid == is_valid)
    if from_date:
        query = query.where(ComplianceRecord.created_at >= from_date)
    if to_date:
        query = query.where(ComplianceRecord.created_at <= to_date)

    # Contar total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Paginación y orden
    query = (
        query
        .order_by(ComplianceRecord.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    result = await db.execute(query)
    records = result.scalars().all()

    return ComplianceList(
        items=[ComplianceResponse.model_validate(r) for r in records],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1
    )


@router.get("/records/{record_id}", response_model=ComplianceWithDetails)
async def get_compliance_record(
    record_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Obtiene un registro de compliance con detalles completos."""
    result = await db.execute(
        select(ComplianceRecord).where(ComplianceRecord.id == record_id)
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    return ComplianceWithDetails.model_validate(record)


@router.post("/records/{record_id}/validate", response_model=ComplianceResponse)
async def manual_validate_record(
    record_id: int,
    validation: ManualValidationRequest,
    validated_by_id: int = Query(..., description="ID del contacto que valida"),
    db: AsyncSession = Depends(get_db)
):
    """Validación manual de un registro de compliance."""
    result = await db.execute(
        select(ComplianceRecord).where(ComplianceRecord.id == record_id)
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    # Verificar que el validador existe y tiene permisos
    result = await db.execute(
        select(Contact).where(Contact.id == validated_by_id)
    )
    validator = result.scalar_one_or_none()
    if not validator:
        raise HTTPException(status_code=404, detail="Validador no encontrado")

    record.set_manual_validation(
        is_valid=validation.is_valid,
        validated_by_id=validated_by_id,
        notes=validation.notes
    )

    await db.flush()
    await db.refresh(record)

    return ComplianceResponse.model_validate(record)


# ==================== RECORDATORIOS ====================

@router.get("/reminders", response_model=ReminderList)
async def list_reminders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    location_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    status: Optional[ReminderStatus] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """Lista recordatorios programados."""
    query = select(ScheduledReminder)

    # Filtros
    if location_id:
        query = query.where(ScheduledReminder.location_id == location_id)
    if contact_id:
        query = query.where(ScheduledReminder.contact_id == contact_id)
    if status:
        query = query.where(ScheduledReminder.status == status)
    if from_date:
        query = query.where(ScheduledReminder.scheduled_for >= from_date)
    if to_date:
        query = query.where(ScheduledReminder.scheduled_for <= to_date)

    # Contar total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Paginación
    query = (
        query
        .order_by(ScheduledReminder.scheduled_for.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    result = await db.execute(query)
    reminders = result.scalars().all()

    return ReminderList(
        items=[ReminderResponse.model_validate(r) for r in reminders],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1
    )


@router.post("/reminders", response_model=ReminderResponse, status_code=201)
async def create_reminder(
    reminder_data: ReminderCreate,
    db: AsyncSession = Depends(get_db)
):
    """Crea un recordatorio manual."""
    # Verificar ubicación
    result = await db.execute(
        select(Location).where(Location.id == reminder_data.location_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")

    # Verificar contacto
    result = await db.execute(
        select(Contact).where(Contact.id == reminder_data.contact_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")

    if not contact.telegram_id:
        raise HTTPException(
            status_code=400,
            detail="El contacto no tiene Telegram vinculado"
        )

    reminder = ScheduledReminder(**reminder_data.model_dump())
    db.add(reminder)
    await db.flush()
    await db.refresh(reminder)

    return ReminderResponse.model_validate(reminder)


@router.delete("/reminders/{reminder_id}", status_code=204)
async def cancel_reminder(
    reminder_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Cancela un recordatorio pendiente."""
    result = await db.execute(
        select(ScheduledReminder).where(ScheduledReminder.id == reminder_id)
    )
    reminder = result.scalar_one_or_none()

    if not reminder:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")

    if reminder.status != ReminderStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden cancelar recordatorios pendientes"
        )

    reminder.status = ReminderStatus.CANCELLED
    await db.flush()
    return None


# ==================== DASHBOARD ====================

@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db)
):
    """Obtiene estadísticas para el dashboard."""
    from app.models.client import Client

    # Total clientes activos
    total_clients = (await db.execute(
        select(func.count()).select_from(Client).where(Client.active == True)
    )).scalar()

    # Total ubicaciones activas
    total_locations = (await db.execute(
        select(func.count()).select_from(Location).where(Location.active == True)
    )).scalar()

    # Total contactos activos
    total_contacts = (await db.execute(
        select(func.count()).select_from(Contact).where(Contact.active == True)
    )).scalar()

    # Contactos vinculados
    linked_contacts = (await db.execute(
        select(func.count()).select_from(Contact)
        .where(and_(Contact.active == True, Contact.telegram_id.isnot(None)))
    )).scalar()

    # Recordatorios pendientes
    pending_reminders = (await db.execute(
        select(func.count()).select_from(ScheduledReminder)
        .where(ScheduledReminder.status == ReminderStatus.PENDING)
    )).scalar()

    # Completados hoy
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    completed_today = (await db.execute(
        select(func.count()).select_from(ComplianceRecord)
        .where(ComplianceRecord.created_at >= today_start)
    )).scalar()

    # Escalados
    escalated_count = (await db.execute(
        select(func.count()).select_from(ScheduledReminder)
        .where(ScheduledReminder.status == ReminderStatus.ESCALATED)
    )).scalar()

    # Tasa de cumplimiento últimos 7 días
    seven_days_ago = datetime.utcnow() - timedelta(days=7)

    total_reminders_7d = (await db.execute(
        select(func.count()).select_from(ScheduledReminder)
        .where(ScheduledReminder.scheduled_for >= seven_days_ago)
    )).scalar()

    completed_7d = (await db.execute(
        select(func.count()).select_from(ScheduledReminder)
        .where(and_(
            ScheduledReminder.scheduled_for >= seven_days_ago,
            ScheduledReminder.status == ReminderStatus.COMPLETED
        ))
    )).scalar()

    compliance_rate = (completed_7d / total_reminders_7d * 100) if total_reminders_7d > 0 else 0

    return DashboardStats(
        total_clients=total_clients,
        total_locations=total_locations,
        total_contacts=total_contacts,
        linked_contacts=linked_contacts,
        pending_reminders=pending_reminders,
        completed_today=completed_today,
        compliance_rate_7d=round(compliance_rate, 1),
        escalated_count=escalated_count
    )


@router.get("/dashboard/locations-status", response_model=list[LocationComplianceStatus])
async def get_locations_compliance_status(
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, description="ok, pending, overdue, critical"),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene el estado de compliance de las ubicaciones."""
    from app.models.client import Client

    query = (
        select(Location, Client.name.label("client_name"))
        .join(Client)
        .where(Location.active == True)
        .order_by(Location.last_compliance_at.asc().nullsfirst())
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.fetchall()

    statuses = []
    now = datetime.utcnow()

    for location, client_name in rows:
        # Calcular días desde último compliance
        days_since = None
        if location.last_compliance_at:
            days_since = (now - location.last_compliance_at).days

        # Determinar status
        if days_since is None:
            status = "critical"  # Nunca ha reportado
        elif days_since <= location.frequency_days:
            status = "ok"
        elif days_since <= location.frequency_days * 1.5:
            status = "pending"
        elif days_since <= location.frequency_days * 2:
            status = "overdue"
        else:
            status = "critical"

        # Filtrar por status si se especifica
        if status_filter and status != status_filter:
            continue

        statuses.append(LocationComplianceStatus(
            location_id=location.id,
            location_name=location.name,
            client_name=client_name,
            last_compliance_at=location.last_compliance_at,
            days_since_compliance=days_since,
            next_reminder_at=None,  # TODO: calcular próximo recordatorio
            status=status
        ))

    return statuses
