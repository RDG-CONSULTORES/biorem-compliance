"""
Scheduler de Recordatorios para Biorem Compliance.

Usa APScheduler para programar y enviar recordatorios automáticamente.
"""
import logging
from datetime import datetime, timedelta, time
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from telegram import Bot

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.location import Location
from app.models.contact import Contact
from app.models.reminder import ScheduledReminder, ReminderStatus
from app.models.notification import NotificationLog, NotificationType

logger = logging.getLogger(__name__)

# Scheduler global
scheduler: Optional[AsyncIOScheduler] = None
bot: Optional[Bot] = None


async def get_db_session() -> AsyncSession:
    """Obtiene una sesión de base de datos."""
    return AsyncSessionLocal()


# ==================== GENERACIÓN DE RECORDATORIOS ====================

async def generate_daily_reminders():
    """
    Genera los recordatorios del día.

    Se ejecuta todos los días a las 00:01 para crear los recordatorios
    que deben enviarse durante el día.
    """
    logger.info("Generating daily reminders...")

    async with await get_db_session() as db:
        today = datetime.utcnow().date()

        # Obtener ubicaciones activas que necesitan recordatorio hoy
        result = await db.execute(
            select(Location)
            .where(Location.active == True)
            .where(Location.product_id.isnot(None))
        )
        locations = result.scalars().all()

        reminders_created = 0

        for location in locations:
            # Verificar si toca recordatorio hoy según frecuencia
            if location.last_compliance_at:
                days_since = (today - location.last_compliance_at.date()).days
                if days_since < location.frequency_days:
                    continue  # Aún no toca

            # Verificar si el día de hoy está en los días de recordatorio
            today_weekday = str(today.isoweekday())  # 1=Lunes, 7=Domingo
            if location.reminder_days and today_weekday not in location.reminder_days:
                continue  # Hoy no toca recordatorio

            # Obtener contactos del cliente para esta ubicación
            result = await db.execute(
                select(Contact)
                .where(
                    Contact.client_id == location.client_id,
                    Contact.active == True,
                    Contact.telegram_id.isnot(None)
                )
            )
            contacts = result.scalars().all()

            if not contacts:
                logger.warning(f"No linked contacts for location {location.id}")
                continue

            # Crear recordatorio para el primer contacto disponible
            contact = contacts[0]

            # Calcular hora de envío
            reminder_time = location.reminder_time or time(9, 0)
            scheduled_for = datetime.combine(today, reminder_time)

            # Verificar que no exista ya un recordatorio para hoy
            result = await db.execute(
                select(ScheduledReminder)
                .where(
                    ScheduledReminder.location_id == location.id,
                    ScheduledReminder.scheduled_for >= datetime.combine(today, time(0, 0)),
                    ScheduledReminder.scheduled_for < datetime.combine(today + timedelta(days=1), time(0, 0)),
                    ScheduledReminder.status != ReminderStatus.CANCELLED
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                continue  # Ya existe recordatorio para hoy

            # Crear el recordatorio
            reminder = ScheduledReminder(
                location_id=location.id,
                contact_id=contact.id,
                scheduled_for=scheduled_for,
                status=ReminderStatus.PENDING
            )
            db.add(reminder)
            reminders_created += 1

        await db.commit()
        logger.info(f"Created {reminders_created} reminders for today")


# ==================== ENVÍO DE RECORDATORIOS ====================

async def send_pending_reminders():
    """
    Envía los recordatorios pendientes que ya pasaron su hora programada.

    Se ejecuta cada minuto para verificar y enviar recordatorios.
    """
    if not bot:
        logger.warning("Bot not initialized, skipping reminder send")
        return

    now = datetime.utcnow()

    async with await get_db_session() as db:
        # Obtener recordatorios pendientes que ya pasaron su hora
        result = await db.execute(
            select(ScheduledReminder)
            .where(
                ScheduledReminder.status == ReminderStatus.PENDING,
                ScheduledReminder.scheduled_for <= now
            )
            .limit(50)  # Procesar en lotes
        )
        reminders = result.scalars().all()

        for reminder in reminders:
            await send_reminder(reminder, db)

        await db.commit()


async def send_reminder(reminder: ScheduledReminder, db: AsyncSession):
    """Envía un recordatorio específico."""
    try:
        # Obtener contacto
        result = await db.execute(
            select(Contact).where(Contact.id == reminder.contact_id)
        )
        contact = result.scalar_one_or_none()

        if not contact or not contact.telegram_id:
            logger.warning(f"Contact not found or not linked for reminder {reminder.id}")
            reminder.status = ReminderStatus.FAILED
            reminder.failure_reason = "Contact not linked"
            return

        # Obtener ubicación y producto
        result = await db.execute(
            select(Location).where(Location.id == reminder.location_id)
        )
        location = result.scalar_one_or_none()

        if not location:
            logger.warning(f"Location not found for reminder {reminder.id}")
            reminder.status = ReminderStatus.FAILED
            reminder.failure_reason = "Location not found"
            return

        product_name = "el producto"
        instructions = ""

        if location.product:
            product_name = location.product.name
            if location.product.application_instructions:
                instructions = f"\n\nInstrucciones:\n{location.product.application_instructions}"
            if location.product.dosage:
                instructions += f"\nDosis: {location.product.dosage}"

        # Construir mensaje
        message = (
            f"Recordatorio de aplicación\n\n"
            f"Ubicación: {location.name}\n"
            f"Producto: {product_name}"
            f"{instructions}\n\n"
            f"Por favor, aplica el producto y envía una foto de evidencia."
        )

        # Enviar mensaje
        sent_message = await bot.send_message(
            chat_id=contact.telegram_id,
            text=message
        )

        # Actualizar recordatorio
        reminder.mark_as_sent(str(sent_message.message_id))

        # Registrar notificación
        notification = NotificationLog(
            contact_id=contact.id,
            telegram_chat_id=contact.telegram_id,
            reminder_id=reminder.id,
            notification_type=NotificationType.REMINDER,
            subject=f"Recordatorio: {location.name}",
            message=message,
            delivered=True,
            delivered_at=datetime.utcnow(),
            telegram_message_id=str(sent_message.message_id)
        )
        db.add(notification)

        logger.info(f"Sent reminder {reminder.id} to contact {contact.id}")

    except Exception as e:
        logger.error(f"Error sending reminder {reminder.id}: {e}")
        reminder.status = ReminderStatus.FAILED
        reminder.failure_reason = str(e)[:255]


# ==================== ESCALAMIENTO ====================

async def check_escalations():
    """
    Verifica recordatorios sin respuesta y escala si es necesario.

    Se ejecuta cada 30 minutos.
    """
    if not bot:
        return

    now = datetime.utcnow()
    escalation_threshold = now - timedelta(minutes=settings.ESCALATION_MINUTES)

    async with await get_db_session() as db:
        # Obtener recordatorios enviados sin respuesta que pasaron el umbral
        result = await db.execute(
            select(ScheduledReminder)
            .where(
                ScheduledReminder.status == ReminderStatus.SENT,
                ScheduledReminder.sent_at <= escalation_threshold,
                ScheduledReminder.escalation_count < settings.MAX_ESCALATION_ATTEMPTS
            )
        )
        reminders = result.scalars().all()

        for reminder in reminders:
            await escalate_reminder(reminder, db)

        await db.commit()


async def escalate_reminder(reminder: ScheduledReminder, db: AsyncSession):
    """Escala un recordatorio a un supervisor."""
    try:
        # Obtener ubicación
        result = await db.execute(
            select(Location).where(Location.id == reminder.location_id)
        )
        location = result.scalar_one_or_none()

        if not location:
            return

        # Buscar supervisor del cliente
        from app.models.contact import ContactRole
        result = await db.execute(
            select(Contact)
            .where(
                Contact.client_id == location.client_id,
                Contact.role.in_([ContactRole.ADMIN, ContactRole.SUPERVISOR]),
                Contact.active == True,
                Contact.telegram_id.isnot(None),
                Contact.id != reminder.contact_id  # No el mismo contacto
            )
        )
        supervisor = result.scalar_one_or_none()

        if not supervisor:
            # No hay supervisor, marcar como escalado sin notificar
            reminder.status = ReminderStatus.ESCALATED
            reminder.escalation_count += 1
            reminder.escalated_at = datetime.utcnow()
            return

        # Obtener contacto original
        result = await db.execute(
            select(Contact).where(Contact.id == reminder.contact_id)
        )
        original_contact = result.scalar_one_or_none()

        # Enviar alerta al supervisor
        message = (
            f"ALERTA: Sin respuesta\n\n"
            f"El contacto {original_contact.name if original_contact else 'Desconocido'} "
            f"no ha respondido al recordatorio de:\n\n"
            f"Ubicación: {location.name}\n"
            f"Enviado: {reminder.sent_at.strftime('%d/%m %H:%M') if reminder.sent_at else 'N/A'}\n"
            f"Escalamientos previos: {reminder.escalation_count}\n\n"
            f"Por favor, verifica la situación."
        )

        await bot.send_message(
            chat_id=supervisor.telegram_id,
            text=message
        )

        # Actualizar recordatorio
        reminder.mark_as_escalated(supervisor.id)

        # Registrar notificación
        notification = NotificationLog(
            contact_id=supervisor.id,
            telegram_chat_id=supervisor.telegram_id,
            reminder_id=reminder.id,
            notification_type=NotificationType.ESCALATION,
            subject=f"Escalamiento: {location.name}",
            message=message,
            delivered=True,
            delivered_at=datetime.utcnow()
        )
        db.add(notification)

        logger.info(f"Escalated reminder {reminder.id} to supervisor {supervisor.id}")

    except Exception as e:
        logger.error(f"Error escalating reminder {reminder.id}: {e}")


# ==================== CONFIGURACIÓN DEL SCHEDULER ====================

def setup_scheduler(telegram_bot: Bot) -> AsyncIOScheduler:
    """Configura y retorna el scheduler."""
    global scheduler, bot

    bot = telegram_bot
    scheduler = AsyncIOScheduler()

    # Generar recordatorios diarios a las 00:01
    scheduler.add_job(
        generate_daily_reminders,
        CronTrigger(hour=0, minute=1),
        id="generate_daily_reminders",
        replace_existing=True
    )

    # Enviar recordatorios pendientes cada minuto
    scheduler.add_job(
        send_pending_reminders,
        IntervalTrigger(minutes=1),
        id="send_pending_reminders",
        replace_existing=True
    )

    # Verificar escalamientos cada 30 minutos
    scheduler.add_job(
        check_escalations,
        IntervalTrigger(minutes=30),
        id="check_escalations",
        replace_existing=True
    )

    return scheduler


async def start_scheduler(telegram_bot: Bot):
    """Inicia el scheduler."""
    global scheduler

    scheduler = setup_scheduler(telegram_bot)
    scheduler.start()
    logger.info("Scheduler started")

    # Ejecutar generación de recordatorios al iniciar
    await generate_daily_reminders()


def stop_scheduler():
    """Detiene el scheduler."""
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
