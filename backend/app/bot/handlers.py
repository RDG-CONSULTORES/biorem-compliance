"""
Handlers del Bot de Telegram para Biorem Compliance.

Maneja comandos, vinculación de usuarios y recepción de fotos.
Incluye Photo Guard para verificación de autenticidad.
"""
import logging
from datetime import datetime
from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove, KeyboardButton
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ConversationHandler,
    ContextTypes,
    filters
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.contact import Contact
from app.models.location import Location
from app.models.compliance import ComplianceRecord
from app.models.reminder import ScheduledReminder, ReminderStatus
from app.utils.geo import haversine_distance

logger = logging.getLogger(__name__)

# Estados de conversación
WAITING_INVITE_CODE = 1
WAITING_PHOTO = 2
WAITING_LOCATION_SELECT = 3
WAITING_LOCATION_FOR_PHOTO = 4  # Esperando ubicación antes de foto


# ==================== HELPERS ====================

async def get_db_session() -> AsyncSession:
    """Obtiene una sesión de base de datos."""
    return AsyncSessionLocal()


async def get_contact_by_telegram_id(telegram_id: str, db: AsyncSession) -> Contact | None:
    """Busca un contacto por su ID de Telegram."""
    result = await db.execute(
        select(Contact).where(Contact.telegram_id == telegram_id)
    )
    return result.scalar_one_or_none()


async def get_contact_by_invite_code(code: str, db: AsyncSession) -> Contact | None:
    """Busca un contacto por su código de invitación."""
    result = await db.execute(
        select(Contact).where(
            Contact.invite_code == code.upper(),
            Contact.telegram_id.is_(None),  # No vinculado aún
            Contact.active == True
        )
    )
    return result.scalar_one_or_none()


def get_main_keyboard(has_pending: bool = False) -> ReplyKeyboardMarkup:
    """
    Genera el teclado principal del bot.

    Args:
        has_pending: Si hay recordatorios pendientes (muestra indicador)
    """
    photo_text = "📸 Enviar Foto" + (" 🔴" if has_pending else "")

    keyboard = [
        [KeyboardButton(photo_text), KeyboardButton("📊 Mi Estado")],
        [KeyboardButton("📍 Compartir Ubicación", request_location=True)],
        [KeyboardButton("❓ Ayuda")]
    ]

    return ReplyKeyboardMarkup(
        keyboard,
        resize_keyboard=True,
        one_time_keyboard=False,
        input_field_placeholder="Selecciona una opción o envía una foto"
    )


def get_location_request_keyboard() -> ReplyKeyboardMarkup:
    """Teclado para solicitar ubicación antes de foto."""
    keyboard = [
        [KeyboardButton("📍 Compartir mi Ubicación", request_location=True)],
        [KeyboardButton("❌ Cancelar")]
    ]
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True)


# ==================== COMANDOS ====================

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler para /start - Bienvenida y vinculación."""
    user = update.effective_user
    telegram_id = str(user.id)

    async with await get_db_session() as db:
        contact = await get_contact_by_telegram_id(telegram_id, db)

        if contact:
            # Usuario ya vinculado
            await update.message.reply_text(
                f"Hola {contact.name}! Ya estás vinculado a Biorem Compliance.\n\n"
                "Comandos disponibles:\n"
                "/estado - Ver tu estado de cumplimiento\n"
                "/ayuda - Ver ayuda\n\n"
                "Cuando recibas un recordatorio, simplemente envía una foto "
                "de la aplicación del producto."
            )
        else:
            # Usuario nuevo, pedir código
            await update.message.reply_text(
                "Bienvenido a Biorem Compliance!\n\n"
                "Para vincular tu cuenta, necesitas el código de invitación "
                "que te proporcionó tu administrador.\n\n"
                "Por favor, envía tu código de invitación:"
            )
            return WAITING_INVITE_CODE

    return ConversationHandler.END


async def handle_invite_code(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler para recibir código de invitación."""
    code = update.message.text.strip().upper()
    user = update.effective_user

    async with await get_db_session() as db:
        contact = await get_contact_by_invite_code(code, db)

        if not contact:
            await update.message.reply_text(
                "Código no válido o ya utilizado.\n\n"
                "Verifica el código e intenta de nuevo, o contacta a tu administrador."
            )
            return WAITING_INVITE_CODE

        # Verificar si el código expiró
        if contact.invite_code_expires_at and contact.invite_code_expires_at < datetime.utcnow():
            await update.message.reply_text(
                "El código ha expirado.\n\n"
                "Contacta a tu administrador para obtener un nuevo código."
            )
            return ConversationHandler.END

        # Vincular usuario
        contact.telegram_id = str(user.id)
        contact.telegram_username = user.username
        contact.telegram_first_name = user.first_name
        contact.linked_at = datetime.utcnow()
        contact.last_interaction_at = datetime.utcnow()

        await db.commit()

        await update.message.reply_text(
            f"Cuenta vinculada exitosamente!\n\n"
            f"Nombre: {contact.name}\n"
            f"Empresa: (vinculado)\n\n"
            "A partir de ahora recibirás recordatorios para aplicar productos. "
            "Cuando recibas un recordatorio, envía una foto de la aplicación.\n\n"
            "Comandos disponibles:\n"
            "/estado - Ver tu estado de cumplimiento\n"
            "/ayuda - Ver ayuda"
        )

    return ConversationHandler.END


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler para /estado - Muestra el estado del usuario."""
    user = update.effective_user
    telegram_id = str(user.id)

    async with await get_db_session() as db:
        contact = await get_contact_by_telegram_id(telegram_id, db)

        if not contact:
            await update.message.reply_text(
                "No tienes una cuenta vinculada.\n"
                "Usa /start para vincular tu cuenta."
            )
            return

        # Obtener recordatorios pendientes
        result = await db.execute(
            select(ScheduledReminder)
            .where(
                ScheduledReminder.contact_id == contact.id,
                ScheduledReminder.status == ReminderStatus.SENT
            )
            .order_by(ScheduledReminder.scheduled_for)
        )
        pending_reminders = result.scalars().all()

        # Obtener últimos registros de compliance
        result = await db.execute(
            select(ComplianceRecord)
            .where(ComplianceRecord.contact_id == contact.id)
            .order_by(ComplianceRecord.created_at.desc())
            .limit(5)
        )
        recent_compliance = result.scalars().all()

        # Construir mensaje
        message = f"Estado de {contact.name}\n\n"

        if pending_reminders:
            message += f"Recordatorios pendientes: {len(pending_reminders)}\n"
            for r in pending_reminders[:3]:
                message += f"  - Ubicación #{r.location_id}\n"
        else:
            message += "Sin recordatorios pendientes\n"

        message += f"\nÚltimos registros: {len(recent_compliance)}\n"
        for c in recent_compliance:
            status = "Validado" if c.is_valid else ("Pendiente" if c.is_valid is None else "Rechazado")
            message += f"  - {c.created_at.strftime('%d/%m %H:%M')} - {status}\n"

        await update.message.reply_text(message)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler para /ayuda - Muestra la ayuda."""
    help_text = """
Biorem Compliance - Ayuda

Comandos disponibles:
/start - Iniciar o vincular cuenta
/estado - Ver tu estado de cumplimiento
/ayuda - Ver este mensaje

Cómo funciona:
1. Recibirás recordatorios para aplicar productos
2. Comparte tu ubicación primero
3. Envía una foto de la aplicación
4. La foto será validada automáticamente
5. Si hay problemas, tu supervisor será notificado

Consejos para las fotos:
- Comparte tu ubicación antes de enviar la foto
- Asegúrate de que se vea el producto o su envase
- Incluye el área de drenaje/aplicación en la foto
- Toma la foto en el momento de la aplicación
- Usa buena iluminación

Problemas? Contacta a tu administrador.
    """
    await update.message.reply_text(help_text, reply_markup=get_main_keyboard())


# ==================== MANEJO DE UBICACIÓN ====================

async def handle_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler para recibir ubicación del usuario (Photo Guard)."""
    user = update.effective_user
    telegram_id = str(user.id)
    location = update.message.location

    async with await get_db_session() as db:
        contact = await get_contact_by_telegram_id(telegram_id, db)

        if not contact:
            await update.message.reply_text(
                "No tienes una cuenta vinculada.\n"
                "Usa /start para vincular tu cuenta."
            )
            return

        # Guardar ubicación del contacto
        contact.update_location(
            latitude=location.latitude,
            longitude=location.longitude,
            accuracy=location.horizontal_accuracy if hasattr(location, 'horizontal_accuracy') else None
        )
        contact.last_interaction_at = datetime.utcnow()

        await db.commit()

        # Verificar si estaba esperando ubicación para foto
        if context.user_data.get('awaiting_location_for_photo'):
            context.user_data['awaiting_location_for_photo'] = False
            context.user_data['photo_location'] = {
                'latitude': location.latitude,
                'longitude': location.longitude,
                'timestamp': datetime.utcnow()
            }

            await update.message.reply_text(
                "✅ Ubicación recibida.\n\n"
                "Ahora envía la foto de evidencia de la aplicación del producto.",
                reply_markup=get_main_keyboard()
            )
        else:
            await update.message.reply_text(
                "📍 Ubicación registrada.\n\n"
                "Tu ubicación ha sido guardada. Cuando envíes una foto, "
                "se verificará que estés en la ubicación correcta.",
                reply_markup=get_main_keyboard()
            )


async def handle_text_buttons(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler para botones de texto del teclado."""
    text = update.message.text

    if text in ["📸 Enviar Foto", "📸 Enviar Foto 🔴"]:
        await request_location_for_photo(update, context)
    elif text == "📊 Mi Estado":
        await status_command(update, context)
    elif text == "❓ Ayuda":
        await help_command(update, context)
    elif text == "❌ Cancelar":
        context.user_data['awaiting_location_for_photo'] = False
        await update.message.reply_text(
            "Operación cancelada.",
            reply_markup=get_main_keyboard()
        )


async def request_location_for_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Solicita ubicación antes de aceptar foto."""
    user = update.effective_user
    telegram_id = str(user.id)

    async with await get_db_session() as db:
        contact = await get_contact_by_telegram_id(telegram_id, db)

        if not contact:
            await update.message.reply_text(
                "No tienes una cuenta vinculada.\n"
                "Usa /start para vincular tu cuenta."
            )
            return

        # Verificar si ya tiene ubicación reciente (últimos 5 minutos)
        if contact.has_recent_location(minutes=5):
            context.user_data['photo_location'] = {
                'latitude': contact.last_known_latitude,
                'longitude': contact.last_known_longitude,
                'timestamp': contact.last_location_at
            }

            await update.message.reply_text(
                f"✅ Ubicación reciente detectada.\n\n"
                "Ahora envía la foto de evidencia.",
                reply_markup=get_main_keyboard()
            )
        else:
            # Pedir ubicación
            context.user_data['awaiting_location_for_photo'] = True

            await update.message.reply_text(
                "📍 Para verificar tu evidencia, primero comparte tu ubicación.\n\n"
                "Esto nos ayuda a confirmar que estás en el lugar correcto.",
                reply_markup=get_location_request_keyboard()
            )


# ==================== MANEJO DE FOTOS ====================

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handler para recibir fotos de compliance.

    Incluye Photo Guard para verificación de autenticidad:
    - Geolocalización (40 puntos)
    - Ventana de tiempo (30 puntos)
    - Validación IA (30 puntos)
    """
    user = update.effective_user
    telegram_id = str(user.id)

    async with await get_db_session() as db:
        contact = await get_contact_by_telegram_id(telegram_id, db)

        if not contact:
            await update.message.reply_text(
                "No tienes una cuenta vinculada.\n"
                "Usa /start para vincular tu cuenta."
            )
            return

        # Verificar si hay recordatorio pendiente
        result = await db.execute(
            select(ScheduledReminder)
            .where(
                ScheduledReminder.contact_id == contact.id,
                ScheduledReminder.status == ReminderStatus.SENT
            )
            .order_by(ScheduledReminder.scheduled_for)
            .limit(1)
        )
        pending_reminder = result.scalar_one_or_none()

        # Obtener la foto de mayor resolución
        photo = update.message.photo[-1]
        file_id = photo.file_id

        # Crear registro de compliance
        compliance = ComplianceRecord(
            location_id=pending_reminder.location_id if pending_reminder else None,
            contact_id=contact.id,
            reminder_id=pending_reminder.id if pending_reminder else None,
            photo_file_id=file_id,
            photo_received_at=datetime.utcnow(),
            photo_width=photo.width,
            photo_height=photo.height
        )

        # ============ PHOTO GUARD: Geolocalización ============
        # Prioridad: 1) Ubicación en contexto, 2) Ubicación del contacto, 3) Ubicación en mensaje
        photo_location = context.user_data.get('photo_location')

        if photo_location:
            compliance.photo_latitude = photo_location['latitude']
            compliance.photo_longitude = photo_location['longitude']
            # Limpiar ubicación del contexto después de usarla
            context.user_data.pop('photo_location', None)
        elif contact.has_recent_location(minutes=10):
            compliance.photo_latitude = contact.last_known_latitude
            compliance.photo_longitude = contact.last_known_longitude
        elif update.message.location:
            compliance.photo_latitude = update.message.location.latitude
            compliance.photo_longitude = update.message.location.longitude

        # Obtener ubicación esperada y calcular distancia
        if pending_reminder and pending_reminder.location_id:
            result = await db.execute(
                select(Location).where(Location.id == pending_reminder.location_id)
            )
            location = result.scalar_one_or_none()

            if location and location.latitude and location.longitude:
                compliance.expected_latitude = location.latitude
                compliance.expected_longitude = location.longitude

                # Calcular distancia si tenemos ubicación del usuario
                if compliance.photo_latitude and compliance.photo_longitude:
                    compliance.distance_from_expected = haversine_distance(
                        compliance.photo_latitude,
                        compliance.photo_longitude,
                        location.latitude,
                        location.longitude
                    )

        # ============ PHOTO GUARD: Ventana de tiempo ============
        if pending_reminder and pending_reminder.scheduled_for:
            time_diff = datetime.utcnow() - pending_reminder.scheduled_for
            compliance.time_diff_minutes = int(time_diff.total_seconds() / 60)

        db.add(compliance)
        await db.flush()

        # Actualizar último recordatorio si existe
        if pending_reminder:
            pending_reminder.status = ReminderStatus.COMPLETED
            pending_reminder.responded_at = datetime.utcnow()
            pending_reminder.compliance_record_id = compliance.id

        await db.commit()

        # Construir mensaje de confirmación con info de ubicación
        location_status = ""
        if compliance.distance_from_expected is not None:
            if compliance.distance_from_expected <= 500:
                location_status = f"📍 Ubicación verificada ({compliance.distance_from_expected:.0f}m)\n"
            else:
                location_status = f"⚠️ Ubicación distante ({compliance.distance_from_expected:.0f}m)\n"
        elif compliance.photo_latitude:
            location_status = "📍 Ubicación registrada\n"
        else:
            location_status = "⚠️ Sin ubicación (menor certeza)\n"

        await update.message.reply_text(
            f"Foto recibida!\n\n"
            f"{location_status}"
            "Estamos validando tu evidencia con IA...\n"
            "Te notificaremos el resultado en breve.",
            reply_markup=get_main_keyboard()
        )

        # Enviar a validación con Claude Vision en background
        context.application.create_task(
            validate_photo_async(compliance.id, file_id, context)
        )


async def validate_photo_async(compliance_id: int, file_id: str, context: ContextTypes.DEFAULT_TYPE):
    """Valida una foto de forma asíncrona con Claude Vision."""
    import base64

    logger.info(f"Iniciando validación async para compliance_id={compliance_id}")

    contact_telegram_id = None

    try:
        # Descargar foto de Telegram
        logger.info(f"Descargando foto de Telegram: {file_id}")
        file = await context.bot.get_file(file_id)
        photo_bytes = await file.download_as_bytearray()
        photo_base64 = base64.b64encode(bytes(photo_bytes)).decode('utf-8')
        logger.info(f"Foto descargada: {len(photo_bytes)} bytes")

        async with await get_db_session() as db:
            # Obtener el registro de compliance
            result = await db.execute(
                select(ComplianceRecord).where(ComplianceRecord.id == compliance_id)
            )
            compliance = result.scalar_one_or_none()

            if not compliance:
                logger.error(f"Compliance record {compliance_id} not found")
                return

            # Guardar telegram_id del contacto para notificar errores
            result = await db.execute(
                select(Contact).where(Contact.id == compliance.contact_id)
            )
            contact = result.scalar_one_or_none()
            if contact:
                contact_telegram_id = contact.telegram_id

            # Obtener información de la ubicación y producto
            location_name = "Ubicación"
            product_name = "Producto Biorem"
            product_keywords = None

            if compliance.location_id:
                result = await db.execute(
                    select(Location).where(Location.id == compliance.location_id)
                )
                location = result.scalar_one_or_none()
                if location:
                    location_name = location.name
                    if location.product:
                        product_name = location.product.name
                        product_keywords = location.product.validation_keywords

            # Validar con Claude Vision
            from app.services.claude_vision import validate_compliance_photo

            logger.info(f"Enviando a Claude Vision: location={location_name}, product={product_name}")
            validation_result, processing_time = await validate_compliance_photo(
                image_data=photo_base64,
                expected_product=product_name,
                location_name=location_name,
                product_keywords=product_keywords
            )

            logger.info(f"Resultado de validación: is_valid={validation_result.is_valid}, confidence={validation_result.confidence}")

            # Guardar resultado
            compliance.set_ai_validation(
                validation_result.model_dump(),
                processing_time_ms=processing_time
            )

            await db.commit()
            logger.info(f"Resultado guardado en DB para compliance_id={compliance_id}")

            # Notificar al usuario
            if contact_telegram_id:
                if validation_result.is_valid:
                    message = (
                        "Validación exitosa!\n\n"
                        f"Confianza: {validation_result.confidence * 100:.0f}%\n"
                        f"{validation_result.summary}"
                    )
                else:
                    issues = "\n".join(f"- {i}" for i in validation_result.issues) if validation_result.issues else "Sin observaciones específicas"
                    message = (
                        "Validación con observaciones\n\n"
                        f"Confianza: {validation_result.confidence * 100:.0f}%\n"
                        f"{validation_result.summary}\n\n"
                        f"Observaciones:\n{issues}\n\n"
                        "Un supervisor revisará tu evidencia."
                    )

                await context.bot.send_message(
                    chat_id=contact_telegram_id,
                    text=message
                )
                logger.info(f"Notificación enviada a {contact_telegram_id}")

    except Exception as e:
        logger.error(f"Error validating photo {compliance_id}: {type(e).__name__}: {e}", exc_info=True)

        # Intentar notificar al usuario del error
        if contact_telegram_id:
            try:
                await context.bot.send_message(
                    chat_id=contact_telegram_id,
                    text=(
                        "Hubo un problema al validar tu foto.\n\n"
                        "Tu evidencia fue recibida pero la validación automática falló. "
                        "Un supervisor la revisará manualmente."
                    )
                )
            except Exception as notify_error:
                logger.error(f"Error notifying user of validation failure: {notify_error}")


# ==================== CONFIGURACIÓN DEL BOT ====================

def setup_handlers(application: Application):
    """Configura los handlers del bot."""

    # Conversation handler para vinculación
    link_conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start_command)],
        states={
            WAITING_INVITE_CODE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_invite_code)
            ],
        },
        fallbacks=[CommandHandler("start", start_command)],
    )

    application.add_handler(link_conv_handler)

    # Comandos simples
    application.add_handler(CommandHandler("estado", status_command))
    application.add_handler(CommandHandler("ayuda", help_command))
    application.add_handler(CommandHandler("help", help_command))

    # Handler de ubicación (Photo Guard)
    application.add_handler(MessageHandler(filters.LOCATION, handle_location))

    # Handler de fotos
    application.add_handler(MessageHandler(filters.PHOTO, handle_photo))

    # Handler de botones de texto del teclado
    button_filter = filters.Regex(r'^(📸 Enviar Foto|📸 Enviar Foto 🔴|📊 Mi Estado|❓ Ayuda|❌ Cancelar)$')
    application.add_handler(MessageHandler(button_filter, handle_text_buttons))

    logger.info("Bot handlers configured with Photo Guard")


async def start_bot():
    """Inicia el bot de Telegram."""
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not configured, bot will not start")
        return None

    application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()
    setup_handlers(application)

    # Iniciar polling
    logger.info("Starting Telegram bot in polling mode...")
    await application.initialize()
    await application.start()
    await application.updater.start_polling(drop_pending_updates=True)

    return application


async def stop_bot(application: Application):
    """Detiene el bot de Telegram."""
    if application:
        logger.info("Stopping Telegram bot...")
        await application.updater.stop()
        await application.stop()
        await application.shutdown()
