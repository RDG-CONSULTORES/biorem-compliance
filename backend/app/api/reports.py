"""API endpoints para Reportes de Compliance."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case
from typing import Optional
from datetime import datetime, timedelta
from enum import Enum
import logging

from app.database import get_db
from app.models.compliance import ComplianceRecord
from app.models.reminder import ScheduledReminder, ReminderStatus
from app.models.location import Location
from app.models.contact import Contact
from app.models.client import Client
from app.schemas.reports import (
    ReportSummary,
    ClientComplianceReport,
    LocationComplianceReport,
    ComplianceTrend,
    PeriodType,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class PeriodPreset(str, Enum):
    """Períodos predefinidos para reportes."""
    TODAY = "today"
    THIS_WEEK = "this_week"
    THIS_MONTH = "this_month"
    LAST_7_DAYS = "last_7_days"
    LAST_30_DAYS = "last_30_days"
    LAST_90_DAYS = "last_90_days"
    CUSTOM = "custom"


def get_period_dates(preset: PeriodPreset, from_date: Optional[datetime] = None, to_date: Optional[datetime] = None):
    """Calcula las fechas de inicio y fin basado en el preset."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if preset == PeriodPreset.TODAY:
        return today_start, now
    elif preset == PeriodPreset.THIS_WEEK:
        # Lunes de esta semana
        week_start = today_start - timedelta(days=today_start.weekday())
        return week_start, now
    elif preset == PeriodPreset.THIS_MONTH:
        month_start = today_start.replace(day=1)
        return month_start, now
    elif preset == PeriodPreset.LAST_7_DAYS:
        return today_start - timedelta(days=7), now
    elif preset == PeriodPreset.LAST_30_DAYS:
        return today_start - timedelta(days=30), now
    elif preset == PeriodPreset.LAST_90_DAYS:
        return today_start - timedelta(days=90), now
    elif preset == PeriodPreset.CUSTOM:
        return from_date, to_date

    return None, None


@router.get("/summary", response_model=ReportSummary)
async def get_compliance_summary(
    period: PeriodPreset = Query(PeriodPreset.THIS_MONTH, description="Período predefinido"),
    from_date: Optional[datetime] = Query(None, description="Fecha inicio (solo para período custom)"),
    to_date: Optional[datetime] = Query(None, description="Fecha fin (solo para período custom)"),
    client_id: Optional[int] = Query(None, description="Filtrar por cliente"),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene resumen general de compliance para el período especificado.
    """
    start_date, end_date = get_period_dates(period, from_date, to_date)

    # Base query para compliance records
    compliance_query = select(ComplianceRecord)
    if start_date:
        compliance_query = compliance_query.where(ComplianceRecord.created_at >= start_date)
    if end_date:
        compliance_query = compliance_query.where(ComplianceRecord.created_at <= end_date)

    # Filtrar por cliente si se especifica
    if client_id:
        compliance_query = compliance_query.join(Location).where(Location.client_id == client_id)

    # Obtener todos los registros del período
    result = await db.execute(compliance_query)
    records = result.scalars().all()

    # Calcular métricas
    total_records = len(records)
    validated = sum(1 for r in records if r.is_valid == True)
    rejected = sum(1 for r in records if r.is_valid == False)
    pending = sum(1 for r in records if r.is_valid is None)

    # Calcular tasa de cumplimiento
    compliance_rate = (validated / total_records * 100) if total_records > 0 else 0

    # Calcular tiempo promedio de respuesta (de reminder enviado a foto recibida)
    response_times = []
    for record in records:
        if record.reminder_id and record.photo_received_at:
            reminder_result = await db.execute(
                select(ScheduledReminder).where(ScheduledReminder.id == record.reminder_id)
            )
            reminder = reminder_result.scalar_one_or_none()
            if reminder and reminder.sent_at:
                delta = (record.photo_received_at - reminder.sent_at).total_seconds() / 3600  # horas
                if delta > 0:
                    response_times.append(delta)

    avg_response_time = sum(response_times) / len(response_times) if response_times else 0

    # Confianza promedio de IA
    ai_confidences = [r.ai_confidence for r in records if r.ai_confidence is not None]
    avg_ai_confidence = sum(ai_confidences) / len(ai_confidences) if ai_confidences else 0

    # Contar ubicaciones activas y con problemas
    locations_query = select(Location).where(Location.active == True)
    if client_id:
        locations_query = locations_query.where(Location.client_id == client_id)

    locations_result = await db.execute(locations_query)
    locations = locations_result.scalars().all()

    total_locations = len(locations)
    locations_with_issues = 0

    now = datetime.utcnow()
    for loc in locations:
        if loc.last_compliance_at is None:
            locations_with_issues += 1
        elif (now - loc.last_compliance_at).days > loc.frequency_days * 1.5:
            locations_with_issues += 1

    return ReportSummary(
        period_start=start_date,
        period_end=end_date,
        total_records=total_records,
        validated=validated,
        rejected=rejected,
        pending_review=pending,
        compliance_rate=round(compliance_rate, 1),
        avg_response_time_hours=round(avg_response_time, 1),
        avg_ai_confidence=round(avg_ai_confidence * 100, 1),
        total_locations=total_locations,
        locations_with_issues=locations_with_issues
    )


@router.get("/by-client", response_model=list[ClientComplianceReport])
async def get_compliance_by_client(
    period: PeriodPreset = Query(PeriodPreset.THIS_MONTH),
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene reporte de compliance desglosado por cliente.
    """
    start_date, end_date = get_period_dates(period, from_date, to_date)

    # Obtener todos los clientes activos
    clients_result = await db.execute(
        select(Client).where(Client.active == True).order_by(Client.name)
    )
    clients = clients_result.scalars().all()

    reports = []

    for client in clients:
        # Obtener ubicaciones del cliente
        locations_result = await db.execute(
            select(Location).where(
                and_(Location.client_id == client.id, Location.active == True)
            )
        )
        locations = locations_result.scalars().all()
        location_ids = [loc.id for loc in locations]

        if not location_ids:
            continue

        # Obtener registros de compliance
        query = select(ComplianceRecord).where(
            ComplianceRecord.location_id.in_(location_ids)
        )
        if start_date:
            query = query.where(ComplianceRecord.created_at >= start_date)
        if end_date:
            query = query.where(ComplianceRecord.created_at <= end_date)

        records_result = await db.execute(query)
        records = records_result.scalars().all()

        total = len(records)
        validated = sum(1 for r in records if r.is_valid == True)
        rejected = sum(1 for r in records if r.is_valid == False)
        pending = sum(1 for r in records if r.is_valid is None)

        compliance_rate = (validated / total * 100) if total > 0 else 0

        # Última actividad
        last_activity = None
        if records:
            last_record = max(records, key=lambda r: r.created_at)
            last_activity = last_record.created_at

        reports.append(ClientComplianceReport(
            client_id=client.id,
            client_name=client.name,
            business_type=client.business_type,
            total_locations=len(locations),
            total_records=total,
            validated=validated,
            rejected=rejected,
            pending_review=pending,
            compliance_rate=round(compliance_rate, 1),
            last_activity=last_activity
        ))

    # Ordenar por tasa de cumplimiento (menor primero para ver problemas)
    reports.sort(key=lambda r: r.compliance_rate)

    return reports


@router.get("/by-location", response_model=list[LocationComplianceReport])
async def get_compliance_by_location(
    period: PeriodPreset = Query(PeriodPreset.THIS_MONTH),
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    client_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene reporte de compliance desglosado por ubicación.
    """
    start_date, end_date = get_period_dates(period, from_date, to_date)

    # Obtener ubicaciones
    locations_query = (
        select(Location, Client.name.label("client_name"))
        .join(Client)
        .where(Location.active == True)
        .order_by(Client.name, Location.name)
    )

    if client_id:
        locations_query = locations_query.where(Location.client_id == client_id)

    locations_result = await db.execute(locations_query)
    locations_data = locations_result.fetchall()

    reports = []
    now = datetime.utcnow()

    for location, client_name in locations_data:
        # Obtener registros de compliance
        query = select(ComplianceRecord).where(
            ComplianceRecord.location_id == location.id
        )
        if start_date:
            query = query.where(ComplianceRecord.created_at >= start_date)
        if end_date:
            query = query.where(ComplianceRecord.created_at <= end_date)

        records_result = await db.execute(query)
        records = records_result.scalars().all()

        total = len(records)
        validated = sum(1 for r in records if r.is_valid == True)
        rejected = sum(1 for r in records if r.is_valid == False)
        pending = sum(1 for r in records if r.is_valid is None)

        compliance_rate = (validated / total * 100) if total > 0 else 0

        # Calcular días desde último compliance
        days_since = None
        if location.last_compliance_at:
            days_since = (now - location.last_compliance_at).days

        # Determinar status
        if days_since is None:
            status = "critical"
        elif days_since <= location.frequency_days:
            status = "ok"
        elif days_since <= location.frequency_days * 1.5:
            status = "pending"
        elif days_since <= location.frequency_days * 2:
            status = "overdue"
        else:
            status = "critical"

        reports.append(LocationComplianceReport(
            location_id=location.id,
            location_name=location.name,
            client_id=location.client_id,
            client_name=client_name,
            total_records=total,
            validated=validated,
            rejected=rejected,
            pending_review=pending,
            compliance_rate=round(compliance_rate, 1),
            last_compliance_at=location.last_compliance_at,
            days_since_compliance=days_since,
            frequency_days=location.frequency_days,
            status=status
        ))

    # Ordenar: críticos primero, luego por tasa de cumplimiento
    status_order = {"critical": 0, "overdue": 1, "pending": 2, "ok": 3}
    reports.sort(key=lambda r: (status_order.get(r.status, 4), r.compliance_rate))

    return reports


@router.get("/trends", response_model=list[ComplianceTrend])
async def get_compliance_trends(
    period: PeriodPreset = Query(PeriodPreset.LAST_30_DAYS),
    group_by: PeriodType = Query(PeriodType.DAY, description="Agrupar por día, semana o mes"),
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    client_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene tendencias de compliance agrupadas por período.
    """
    start_date, end_date = get_period_dates(period, from_date, to_date)

    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=30)
    if not end_date:
        end_date = datetime.utcnow()

    # Base query
    query = select(ComplianceRecord)
    if start_date:
        query = query.where(ComplianceRecord.created_at >= start_date)
    if end_date:
        query = query.where(ComplianceRecord.created_at <= end_date)

    if client_id:
        query = query.join(Location).where(Location.client_id == client_id)

    query = query.order_by(ComplianceRecord.created_at)

    result = await db.execute(query)
    records = result.scalars().all()

    # Agrupar por período
    trends = {}

    for record in records:
        if group_by == PeriodType.DAY:
            key = record.created_at.strftime("%Y-%m-%d")
            label = record.created_at.strftime("%d %b")
        elif group_by == PeriodType.WEEK:
            # Inicio de semana (lunes)
            week_start = record.created_at - timedelta(days=record.created_at.weekday())
            key = week_start.strftime("%Y-%m-%d")
            label = f"Sem {week_start.strftime('%d %b')}"
        elif group_by == PeriodType.MONTH:
            key = record.created_at.strftime("%Y-%m")
            label = record.created_at.strftime("%b %Y")
        else:
            key = record.created_at.strftime("%Y-%m-%d")
            label = record.created_at.strftime("%d %b")

        if key not in trends:
            trends[key] = {
                "period_key": key,
                "period_label": label,
                "total": 0,
                "validated": 0,
                "rejected": 0,
                "pending": 0
            }

        trends[key]["total"] += 1
        if record.is_valid == True:
            trends[key]["validated"] += 1
        elif record.is_valid == False:
            trends[key]["rejected"] += 1
        else:
            trends[key]["pending"] += 1

    # Convertir a lista y calcular tasas
    result_list = []
    for key in sorted(trends.keys()):
        data = trends[key]
        rate = (data["validated"] / data["total"] * 100) if data["total"] > 0 else 0
        result_list.append(ComplianceTrend(
            period_key=data["period_key"],
            period_label=data["period_label"],
            total_records=data["total"],
            validated=data["validated"],
            rejected=data["rejected"],
            pending_review=data["pending"],
            compliance_rate=round(rate, 1)
        ))

    return result_list
