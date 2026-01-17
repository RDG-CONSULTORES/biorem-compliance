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

    async with AsyncSessionLocal() as db:
        contact = await get_contact_by_telegram_id(telegram_id, db)

        if contact:
            # Usuario ya vinculado - verificar si tiene pendientes
            result = await db.execute(
                select(ScheduledReminder)
                .where(
                    ScheduledReminder.contact_id == contact.id,
                    ScheduledReminder.status == ReminderStatus.SENT
                )
            )
            pending_count = len(result.scalars().all())
            has_pending = pending_count > 0

            # Mensaje de bienvenida con estado
            welcome_msg = f"Hola {contact.name}! 👋\n\n"

            if has_pending:
                welcome_msg += f"🔴 Tienes {pending_count} recordatorio{'s' if pending_count > 1 else ''} pendiente{'s' if pending_count > 1 else ''}.\n\n"
            else:
                welcome_msg += "✅ No tienes recordatorios pendientes.\n\n"

            welcome_msg += (
                "Usa los botones para:\n"
                "📸 Enviar foto de evidencia\n"
                "📊 Ver tu estado\n"
                "📍 Compartir ubicación\n"
                "❓ Ver ayuda"
            )

            await update.message.reply_text(
                welcome_msg,
                reply_markup=get_main_keyboard(has_pending)
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

    async with AsyncSessionLocal() as db:
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
    """Handler para /estado - Muestra el estado detallado del usuario."""
    user = update.effective_user
    telegram_id = str(user.id)

    async with AsyncSessionLocal() as db:
        contact = await get_contact_by_telegram_id(telegram_id, db)

        if not contact:
            await update.message.reply_text(
                "No tienes una cuenta vinculada.\n"
                "Usa /start para vincular tu cuenta."
            )
            return

        # Obtener recordatorios pendientes con info de ubicación
        result = await db.execute(
            select(ScheduledReminder, Location)
            .join(Location, ScheduledReminder.location_id == Location.id)
            .where(
                ScheduledReminder.contact_id == contact.id,
                ScheduledReminder.status == ReminderStatus.SENT
            )
            .order_by(ScheduledReminder.scheduled_for)
        )
        pending_data = result.all()

        # Obtener últimos registros de compliance con ubicación
        result = await db.execute(
            select(ComplianceRecord, Location)
            .outerjoin(Location, ComplianceRecord.location_id == Location.id)
            .where(ComplianceRecord.contact_id == contact.id)
            .order_by(ComplianceRecord.created_at.desc())
            .limit(5)
        )
        recent_data = result.all()

        # Construir mensaje
        message = f"📊 Estado de {contact.name}\n"
        message += "━━━━━━━━━━━━━━━━━━━━\n\n"

        # Recordatorios pendientes
        if pending_data:
            message += f"🔴 Pendientes: {len(pending_data)}\n"
            for reminder, location in pending_data[:3]:
                time_ago = datetime.utcnow() - reminder.scheduled_for
                hours_ago = int(time_ago.total_seconds() / 3600)
                message += f"  • {location.name}\n"
                message += f"    ⏱ Hace {hours_ago}h\n"
            if len(pending_data) > 3:
                message += f"  ... y {len(pending_data) - 3} más\n"
        else:
            message += "✅ Sin recordatorios pendientes\n"

        message += "\n"

        # Últimos registros
        message += "📋 Últimos registros:\n"
        if recent_data:
            for compliance, location in recent_data:
                loc_name = location.name if location else "Sin ubicación"

                # Estado con emoji
                if compliance.is_valid:
                    status = "✅"
                elif compliance.is_valid is None:
                    status = "⏳"
                else:
                    status = "❌"

                # Score de autenticidad
                score_text = ""
                if compliance.authenticity_score is not None:
                    score_text = f" ({compliance.authenticity_score}pts)"

                date_str = compliance.created_at.strftime('%d/%m %H:%M')
                message += f"  {status} {date_str} - {loc_name}{score_text}\n"
        else:
            message += "  Sin registros aún\n"

        # Ubicación actual
        message += "\n"
        if contact.has_recent_location(minutes=30):
            message += "📍 Ubicación: Reciente (últimos 30 min)\n"
        elif contact.last_location_at:
            last_loc = contact.last_location_at.strftime('%d/%m %H:%M')
            message += f"📍 Última ubicación: {last_loc}\n"
        else:
            message += "📍 Sin ubicación registrada\n"

        has_pending = len(pending_data) > 0
        await update.message.reply_text(message, reply_markup=get_main_keyboard(has_pending))


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

    try:
        async with AsyncSessionLocal() as db:
            contact = await get_contact_by_telegram_id(telegram_id, db)

            if not contact:
                await update.message.reply_text(
                    "No tienes una cuenta vinculada.\n"
                    "Usa /start para vincular tu cuenta."
                )
                return

            # Guardar ubicación del contacto
            contact.last_known_latitude = location.latitude
            contact.last_known_longitude = location.longitude
            contact.last_location_at = datetime.utcnow()
            if hasattr(location, 'horizontal_accuracy') and location.horizontal_accuracy:
                contact.last_location_accuracy = location.horizontal_accuracy
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

    except Exception as e:
        logger.error(f"Error handling location: {type(e).__name__}: {e}", exc_info=True)
        await update.message.reply_text(
            "Hubo un error al procesar tu ubicación.\n"
            "Por favor intenta de nuevo.",
            reply_markup=get_main_keyboard()
        )


async def handle_text_buttons(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler para botones de texto del teclado."""
    text = update.message.text
    user_id = update.effective_user.id

    logger.info(f"Botón presionado: '{text}' por user_id={user_id}")

    try:
        if text in ["📸 Enviar Foto", "📸 Enviar Foto 🔴"]:
            logger.info(f"Procesando: Enviar Foto para user_id={user_id}")
            await request_location_for_photo(update, context)
        elif text == "📊 Mi Estado":
            logger.info(f"Procesando: Mi Estado para user_id={user_id}")
            await status_command(update, context)
        elif text == "❓ Ayuda":
            logger.info(f"Procesando: Ayuda para user_id={user_id}")
            await help_command(update, context)
        elif text == "❌ Cancelar":
            logger.info(f"Procesando: Cancelar para user_id={user_id}")
            context.user_data['awaiting_location_for_photo'] = False
            await update.message.reply_text(
                "Operación cancelada.",
                reply_markup=get_main_keyboard()
            )
        else:
            logger.warning(f"Botón no reconocido: '{text}' de user_id={user_id}")
    except Exception as e:
        logger.error(f"Error en handle_text_buttons: {type(e).__name__}: {e}", exc_info=True)
        await update.message.reply_text(
            "Hubo un error. Por favor intenta de nuevo.",
            reply_markup=get_main_keyboard()
        )


async def cancel_conversation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancela la conversación actual."""
    await update.message.reply_text(
        "Operación cancelada.",
        reply_markup=get_main_keyboard()
    )
    return ConversationHandler.END


async def handle_unknown_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler catch-all para mensajes de texto no reconocidos."""
    text = update.message.text
    logger.info(f"Mensaje no manejado recibido: '{text}' de user_id={update.effective_user.id}")

    # No responder a mensajes aleatorios para evitar spam
    # Solo loggear para debugging


async def request_location_for_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Solicita ubicación antes de aceptar foto."""
    user = update.effective_user
    telegram_id = str(user.id)

    async with AsyncSessionLocal() as db:
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

    async with AsyncSessionLocal() as db:
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
        location_points = 0
        if compliance.distance_from_expected is not None:
            if compliance.distance_from_expected <= 100:
                location_status = f"📍 Ubicación perfecta ({compliance.distance_from_expected:.0f}m) +40pts"
                location_points = 40
            elif compliance.distance_from_expected <= 300:
                location_status = f"📍 Ubicación cercana ({compliance.distance_from_expected:.0f}m) +30pts"
                location_points = 30
            elif compliance.distance_from_expected <= 500:
                location_status = f"📍 Ubicación aceptable ({compliance.distance_from_expected:.0f}m) +20pts"
                location_points = 20
            else:
                location_status = f"⚠️ Ubicación distante ({compliance.distance_from_expected:.0f}m)"
        elif compliance.photo_latitude:
            location_status = "📍 Ubicación registrada +15pts"
            location_points = 15
        else:
            location_status = "⚠️ Sin ubicación (compártela para mejor score)"

        time_status = ""
        if compliance.time_diff_minutes is not None:
            abs_diff = abs(compliance.time_diff_minutes)
            if abs_diff <= 30:
                time_status = "⏱ Tiempo excelente +30pts"
            elif abs_diff <= 120:
                time_status = "⏱ Tiempo bueno +20pts"
            elif abs_diff <= 240:
                time_status = "⏱ Tiempo aceptable +10pts"
            else:
                time_status = f"⏱ Enviado tarde ({abs_diff}min)"
        else:
            time_status = "⏱ Sin recordatorio asociado +15pts"

        await update.message.reply_text(
            f"📸 Foto recibida!\n\n"
            f"{location_status}\n"
            f"{time_status}\n\n"
            "🤖 Validando con IA...\n"
            "Te notificaré el resultado en unos segundos.",
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

        async with AsyncSessionLocal() as db:
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

            # Notificar al usuario con score de autenticidad
            if contact_telegram_id:
                # Obtener score de autenticidad
                auth_score = compliance.authenticity_score or 0

                # Emoji según el score
                if auth_score >= 80:
                    score_emoji = "🟢"
                    score_label = "Excelente"
                elif auth_score >= 60:
                    score_emoji = "🟡"
                    score_label = "Bueno"
                elif auth_score >= 40:
                    score_emoji = "🟠"
                    score_label = "Regular"
                else:
                    score_emoji = "🔴"
                    score_label = "Bajo"

                # Detalles de verificación
                verif_details = []
                if compliance.location_verified:
                    verif_details.append("📍 Ubicación ✓")
                elif compliance.location_verified is False:
                    verif_details.append("📍 Ubicación ✗")

                if compliance.time_verified:
                    verif_details.append("⏱ Tiempo ✓")
                elif compliance.time_verified is False:
                    verif_details.append("⏱ Tiempo ✗")

                if validation_result.is_valid:
                    verif_details.append("🤖 IA ✓")
                else:
                    verif_details.append("🤖 IA ✗")

                verif_text = " | ".join(verif_details) if verif_details else ""

                if validation_result.is_valid and auth_score >= 80:
                    message = (
                        "✅ Validación exitosa!\n\n"
                        f"{score_emoji} Score: {auth_score}/100 ({score_label})\n"
                        f"{verif_text}\n\n"
                        f"{validation_result.summary}"
                    )
                elif validation_result.is_valid:
                    message = (
                        "✅ Foto aceptada\n\n"
                        f"{score_emoji} Score: {auth_score}/100 ({score_label})\n"
                        f"{verif_text}\n\n"
                        f"{validation_result.summary}\n\n"
                        "💡 Tip: Comparte tu ubicación para mejorar tu score."
                    )
                else:
                    issues = "\n".join(f"• {i}" for i in validation_result.issues[:3]) if validation_result.issues else ""
                    message = (
                        "⚠️ Validación con observaciones\n\n"
                        f"{score_emoji} Score: {auth_score}/100 ({score_label})\n"
                        f"{verif_text}\n\n"
                        f"{validation_result.summary}\n\n"
                    )
                    if issues:
                        message += f"Observaciones:\n{issues}\n\n"
                    message += "Un supervisor revisará tu evidencia."

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
    """
    Configura los handlers del bot.

    IMPORTANTE: El orden de los handlers importa!
    - group=-1: Handlers prioritarios (botones, ubicación, fotos)
    - group=0: ConversationHandler para vinculación
    - group=1: Catch-all para debugging
    """

    # ============ GRUPO -1: Handlers prioritarios ============
    # Estos se ejecutan ANTES del ConversationHandler

    # Handler de ubicación (Photo Guard) - PRIORIDAD ALTA
    application.add_handler(
        MessageHandler(filters.LOCATION, handle_location),
        group=-1
    )

    # Handler de fotos - PRIORIDAD ALTA
    application.add_handler(
        MessageHandler(filters.PHOTO, handle_photo),
        group=-1
    )

    # Handler de botones de texto del teclado - PRIORIDAD ALTA
    button_filter = filters.Regex(r'^(📸 Enviar Foto|📸 Enviar Foto 🔴|📊 Mi Estado|❓ Ayuda|❌ Cancelar)$')
    application.add_handler(
        MessageHandler(button_filter, handle_text_buttons),
        group=-1
    )

    # ============ GRUPO 0: ConversationHandler ============

    # Conversation handler para vinculación de nuevos usuarios
    link_conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start_command)],
        states={
            WAITING_INVITE_CODE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_invite_code)
            ],
        },
        fallbacks=[
            CommandHandler("start", start_command),
            CommandHandler("cancelar", cancel_conversation),
        ],
        per_user=True,
        per_chat=True,
        name="link_conversation",
    )
    application.add_handler(link_conv_handler, group=0)

    # Comandos simples (fuera de conversación)
    application.add_handler(CommandHandler("estado", status_command), group=0)
    application.add_handler(CommandHandler("ayuda", help_command), group=0)
    application.add_handler(CommandHandler("help", help_command), group=0)

    # ============ GRUPO 1: Catch-all para debugging ============
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_unknown_text),
        group=1
    )

    logger.info("Bot handlers configured with Photo Guard (priority groups enabled)")


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
