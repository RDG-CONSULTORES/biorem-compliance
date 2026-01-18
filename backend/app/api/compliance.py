"""API endpoints para Compliance y Recordatorios."""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime, timedelta
from functools import lru_cache
import math
import base64
import httpx
import logging

from app.database import get_db
from app.config import settings
from app.models.compliance import ComplianceRecord
from app.models.reminder import ScheduledReminder, ReminderStatus
from app.models.location import Location
from app.models.contact import Contact

logger = logging.getLogger(__name__)
from app.schemas.compliance import (
    ComplianceResponse, ComplianceWithDetails, ComplianceList,
    ReminderResponse, ReminderList, ReminderCreate,
    ManualValidationRequest, DashboardStats, LocationComplianceStatus,
    ComplianceValidationStats
)

router = APIRouter()


# ==================== BACKGROUND TASKS ====================

async def send_reminder_background(reminder_id: int):
    """
    Envía un recordatorio en background.
    Esta función se ejecuta después de que la respuesta ya fue enviada al usuario.
    """
    try:
        from app.bot.scheduler import send_reminder_immediately
        sent = await send_reminder_immediately(reminder_id)
        if sent:
            logger.info(f"Background: Reminder {reminder_id} sent successfully")
        else:
            logger.warning(f"Background: Failed to send reminder {reminder_id}")
    except Exception as e:
        logger.error(f"Background: Error sending reminder {reminder_id}: {e}")


# ==================== COMPLIANCE ====================

@router.get("/records", response_model=ComplianceList)
async def list_compliance_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    client_id: Optional[int] = Query(None, description="Filtrar por cliente"),
    location_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    is_valid: Optional[bool] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """Lista registros de compliance con filtros."""
    query = select(ComplianceRecord)

    # Filtro por cliente (requiere join con Location)
    if client_id:
        query = query.join(Location).where(Location.client_id == client_id)

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


@router.get("/records/{record_id}/photo")
async def get_compliance_photo(
    record_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Proxy endpoint para obtener la foto de un registro de compliance.

    Descarga la foto desde Telegram usando el file_id almacenado
    y la retorna como streaming response.
    """
    # Obtener el registro
    result = await db.execute(
        select(ComplianceRecord).where(ComplianceRecord.id == record_id)
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    if not record.photo_file_id:
        raise HTTPException(status_code=404, detail="Este registro no tiene foto")

    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=500, detail="Bot de Telegram no configurado")

    try:
        # Paso 1: Obtener el file_path desde Telegram API
        async with httpx.AsyncClient() as client:
            file_info_url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getFile"
            response = await client.get(file_info_url, params={"file_id": record.photo_file_id})

            if response.status_code != 200:
                logger.error(f"Error getting file info from Telegram: {response.text}")
                raise HTTPException(status_code=502, detail="Error al obtener información del archivo de Telegram")

            file_data = response.json()
            if not file_data.get("ok"):
                logger.error(f"Telegram API error: {file_data}")
                raise HTTPException(status_code=502, detail="Error en respuesta de Telegram")

            file_path = file_data["result"]["file_path"]

            # Paso 2: Descargar el archivo desde Telegram
            download_url = f"https://api.telegram.org/file/bot{settings.TELEGRAM_BOT_TOKEN}/{file_path}"
            photo_response = await client.get(download_url)

            if photo_response.status_code != 200:
                logger.error(f"Error downloading photo from Telegram: {photo_response.status_code}")
                raise HTTPException(status_code=502, detail="Error al descargar foto de Telegram")

            # Determinar content type basado en la extensión
            content_type = "image/jpeg"
            if file_path.endswith(".png"):
                content_type = "image/png"
            elif file_path.endswith(".gif"):
                content_type = "image/gif"
            elif file_path.endswith(".webp"):
                content_type = "image/webp"

            # Retornar la imagen como streaming response
            return StreamingResponse(
                iter([photo_response.content]),
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=3600",  # Cache por 1 hora
                    "Content-Disposition": f"inline; filename=compliance-{record_id}.jpg"
                }
            )

    except httpx.RequestError as e:
        logger.error(f"Network error fetching photo: {e}")
        raise HTTPException(status_code=502, detail="Error de red al obtener foto")
    except Exception as e:
        logger.error(f"Unexpected error fetching photo: {e}")
        raise HTTPException(status_code=500, detail="Error interno al obtener foto")


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
    background_tasks: BackgroundTasks,
    send_now: bool = Query(True, description="Enviar inmediatamente"),
    db: AsyncSession = Depends(get_db)
):
    """
    Crea un recordatorio manual y opcionalmente lo envía inmediatamente.

    El envío se realiza en background para respuesta instantánea al usuario.
    """
    try:
        logger.info(f"Creating reminder: {reminder_data}, send_now={send_now}")

        # Verificar ubicación
        result = await db.execute(
            select(Location).where(Location.id == reminder_data.location_id)
        )
        location = result.scalar_one_or_none()
        if not location:
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

        # Convertir datetime a naive (sin timezone) para la base de datos
        scheduled_for = reminder_data.scheduled_for
        if scheduled_for.tzinfo is not None:
            scheduled_for = scheduled_for.replace(tzinfo=None)

        # Crear recordatorio
        reminder = ScheduledReminder(
            location_id=reminder_data.location_id,
            contact_id=reminder_data.contact_id,
            scheduled_for=scheduled_for,
            timezone=reminder_data.timezone
        )
        db.add(reminder)
        await db.flush()
        await db.refresh(reminder)

        logger.info(f"Reminder created with id: {reminder.id}")

        # Enviar en background si se solicita (no bloquea la respuesta)
        if send_now:
            background_tasks.add_task(send_reminder_background, reminder.id)
            logger.info(f"Reminder {reminder.id} queued for immediate background send")

        return ReminderResponse.model_validate(reminder)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating reminder: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


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


@router.get("/validation-stats", response_model=ComplianceValidationStats)
async def get_validation_stats(
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene estadísticas de validación de registros de compliance.

    Calcula:
    - Total de registros
    - Validados (por IA con alta confianza o validación manual positiva)
    - Pendientes de revisión (sin validación final)
    - Rechazados (validación manual negativa)
    """
    # Total de registros
    total = (await db.execute(
        select(func.count()).select_from(ComplianceRecord)
    )).scalar() or 0

    # Validados: is_valid=True (puede ser por IA o manual)
    validated = (await db.execute(
        select(func.count()).select_from(ComplianceRecord)
        .where(ComplianceRecord.is_valid == True)
    )).scalar() or 0

    # Rechazados: is_valid=False (validación manual negativa)
    rejected = (await db.execute(
        select(func.count()).select_from(ComplianceRecord)
        .where(ComplianceRecord.is_valid == False)
    )).scalar() or 0

    # Pendientes: is_valid IS NULL (sin validación final)
    pending_review = (await db.execute(
        select(func.count()).select_from(ComplianceRecord)
        .where(ComplianceRecord.is_valid.is_(None))
    )).scalar() or 0

    # Desglose: validados por IA (alta confianza, sin validación manual)
    validated_by_ai = (await db.execute(
        select(func.count()).select_from(ComplianceRecord)
        .where(and_(
            ComplianceRecord.ai_validated == True,
            ComplianceRecord.ai_confidence >= 0.8,
            ComplianceRecord.manual_validated.is_(None)
        ))
    )).scalar() or 0

    # Desglose: validados manualmente
    validated_manually = (await db.execute(
        select(func.count()).select_from(ComplianceRecord)
        .where(ComplianceRecord.manual_validated == True)
    )).scalar() or 0

    # Este mes
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    validated_this_month = (await db.execute(
        select(func.count()).select_from(ComplianceRecord)
        .where(and_(
            ComplianceRecord.is_valid == True,
            ComplianceRecord.created_at >= month_start
        ))
    )).scalar() or 0

    rejected_this_month = (await db.execute(
        select(func.count()).select_from(ComplianceRecord)
        .where(and_(
            ComplianceRecord.is_valid == False,
            ComplianceRecord.created_at >= month_start
        ))
    )).scalar() or 0

    # Tasa de aprobación
    decided = validated + rejected
    approval_rate = (validated / decided * 100) if decided > 0 else 0.0

    return ComplianceValidationStats(
        total=total,
        validated=validated,
        pending_review=pending_review,
        rejected=rejected,
        validated_by_ai=validated_by_ai,
        validated_manually=validated_manually,
        validated_this_month=validated_this_month,
        rejected_this_month=rejected_this_month,
        approval_rate=round(approval_rate, 1)
    )
