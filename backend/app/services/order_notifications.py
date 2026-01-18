"""
Servicio de notificaciones para pedidos.

Envía notificaciones por Telegram cuando se crean, aprueban o rechazan pedidos.
"""
import logging
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.contact import Contact, ContactRole
from app.models.notification import NotificationLog, NotificationType
from app.models.product_order import ProductOrder

logger = logging.getLogger(__name__)


async def get_telegram_bot():
    """Obtiene la instancia del bot de Telegram."""
    try:
        from telegram import Bot
        if settings.TELEGRAM_BOT_TOKEN:
            return Bot(token=settings.TELEGRAM_BOT_TOKEN)
    except Exception as e:
        logger.error(f"Error getting Telegram bot: {e}")
    return None


async def notify_new_order(db: AsyncSession, order: ProductOrder, location_name: str, client_name: str):
    """
    Notifica a los administradores cuando se crea un nuevo pedido.

    Args:
        db: Sesión de base de datos
        order: El pedido creado
        location_name: Nombre de la ubicación
        client_name: Nombre del cliente
    """
    bot = await get_telegram_bot()
    if not bot:
        logger.warning("Bot not available for order notification")
        return

    # Buscar contactos admin del mismo cliente que puedan recibir notificaciones
    result = await db.execute(
        select(Contact).where(
            Contact.client_id == order.contact.client_id,
            Contact.role.in_([ContactRole.ADMIN, ContactRole.SUPERVISOR]),
            Contact.telegram_id.isnot(None),
            Contact.notifications_enabled == True,
            Contact.active == True
        )
    )
    admin_contacts = result.scalars().all()

    if not admin_contacts:
        logger.info(f"No admin contacts to notify for order {order.id}")
        return

    # Construir mensaje
    items_text = "\n".join(
        f"  • {item['product_name']} x{item['quantity']}"
        for item in order.items
    )

    message = (
        f"🛒 *Nuevo Pedido #{order.id}*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n\n"
        f"📍 *Ubicación:* {location_name}\n"
        f"🏢 *Cliente:* {client_name}\n"
        f"✍️ *Firmado por:* {order.signed_by_name}\n\n"
        f"*Productos:*\n{items_text}\n"
    )

    if order.notes:
        message += f"\n📝 *Notas:* {order.notes}\n"

    message += (
        f"\n⏱ {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC\n\n"
        f"_Accede al panel de admin para aprobar o rechazar._"
    )

    # Enviar a cada admin
    for contact in admin_contacts:
        try:
            await bot.send_message(
                chat_id=contact.telegram_id,
                text=message,
                parse_mode="Markdown"
            )

            # Registrar notificación
            notification = NotificationLog(
                contact_id=contact.id,
                telegram_chat_id=contact.telegram_id,
                notification_type=NotificationType.ORDER_NEW,
                subject=f"Nuevo pedido #{order.id}",
                message=message,
                delivered=True,
                delivered_at=datetime.utcnow()
            )
            db.add(notification)
            logger.info(f"Order notification sent to admin {contact.name} ({contact.telegram_id})")

        except Exception as e:
            logger.error(f"Failed to notify admin {contact.id}: {e}")
            notification = NotificationLog(
                contact_id=contact.id,
                telegram_chat_id=contact.telegram_id,
                notification_type=NotificationType.ORDER_NEW,
                subject=f"Nuevo pedido #{order.id}",
                message=message,
                failed=True,
                error_message=str(e)
            )
            db.add(notification)

    await db.commit()


async def notify_order_approved(db: AsyncSession, order: ProductOrder, contact: Contact):
    """
    Notifica al solicitante que su pedido fue aprobado.

    Args:
        db: Sesión de base de datos
        order: El pedido aprobado
        contact: El contacto que hizo el pedido
    """
    if not contact.telegram_id:
        logger.info(f"Contact {contact.id} has no telegram_id, skipping notification")
        return

    bot = await get_telegram_bot()
    if not bot:
        return

    items_text = "\n".join(
        f"  • {item['product_name']} x{item['quantity']}"
        for item in order.items
    )

    message = (
        f"✅ *Pedido #{order.id} Aprobado*\n\n"
        f"Tu pedido ha sido aprobado y será procesado pronto.\n\n"
        f"*Productos:*\n{items_text}\n"
    )

    if order.admin_notes:
        message += f"\n📝 *Notas:* {order.admin_notes}\n"

    try:
        await bot.send_message(
            chat_id=contact.telegram_id,
            text=message,
            parse_mode="Markdown"
        )

        notification = NotificationLog(
            contact_id=contact.id,
            telegram_chat_id=contact.telegram_id,
            notification_type=NotificationType.ORDER_APPROVED,
            subject=f"Pedido #{order.id} aprobado",
            message=message,
            delivered=True,
            delivered_at=datetime.utcnow()
        )
        db.add(notification)
        await db.commit()
        logger.info(f"Approval notification sent to {contact.name}")

    except Exception as e:
        logger.error(f"Failed to send approval notification: {e}")


async def notify_order_rejected(
    db: AsyncSession,
    order: ProductOrder,
    contact: Contact,
    reason: str
):
    """
    Notifica al solicitante que su pedido fue rechazado.

    Args:
        db: Sesión de base de datos
        order: El pedido rechazado
        contact: El contacto que hizo el pedido
        reason: Razón del rechazo
    """
    if not contact.telegram_id:
        return

    bot = await get_telegram_bot()
    if not bot:
        return

    message = (
        f"❌ *Pedido #{order.id} Rechazado*\n\n"
        f"Lo sentimos, tu pedido no pudo ser aprobado.\n\n"
        f"*Razón:* {reason}\n\n"
        f"_Si tienes preguntas, contacta a tu supervisor._"
    )

    try:
        await bot.send_message(
            chat_id=contact.telegram_id,
            text=message,
            parse_mode="Markdown"
        )

        notification = NotificationLog(
            contact_id=contact.id,
            telegram_chat_id=contact.telegram_id,
            notification_type=NotificationType.ORDER_REJECTED,
            subject=f"Pedido #{order.id} rechazado",
            message=message,
            delivered=True,
            delivered_at=datetime.utcnow()
        )
        db.add(notification)
        await db.commit()
        logger.info(f"Rejection notification sent to {contact.name}")

    except Exception as e:
        logger.error(f"Failed to send rejection notification: {e}")


async def notify_order_status_change(
    db: AsyncSession,
    order: ProductOrder,
    contact: Contact,
    new_status: str
):
    """
    Notifica al solicitante sobre un cambio de estado en su pedido.

    Args:
        db: Sesión de base de datos
        order: El pedido
        contact: El contacto que hizo el pedido
        new_status: Nuevo estado del pedido
    """
    if not contact.telegram_id:
        return

    bot = await get_telegram_bot()
    if not bot:
        return

    status_messages = {
        "processing": ("📦", "Tu pedido está siendo *preparado*."),
        "shipped": ("🚚", "Tu pedido ha sido *enviado*. Pronto lo recibirás."),
        "delivered": ("✅", "Tu pedido ha sido *entregado*. ¡Gracias!"),
        "cancelled": ("🚫", "Tu pedido ha sido *cancelado*."),
    }

    emoji, status_text = status_messages.get(new_status, ("📋", f"Estado actualizado a: {new_status}"))

    message = f"{emoji} *Pedido #{order.id}*\n\n{status_text}"

    try:
        await bot.send_message(
            chat_id=contact.telegram_id,
            text=message,
            parse_mode="Markdown"
        )

        notification = NotificationLog(
            contact_id=contact.id,
            telegram_chat_id=contact.telegram_id,
            notification_type=NotificationType.ORDER_STATUS,
            subject=f"Pedido #{order.id} - {new_status}",
            message=message,
            delivered=True,
            delivered_at=datetime.utcnow()
        )
        db.add(notification)
        await db.commit()
        logger.info(f"Status notification sent to {contact.name}: {new_status}")

    except Exception as e:
        logger.error(f"Failed to send status notification: {e}")
