"""
API endpoints para Telegram Mini Web App.

Proporciona validación de initData y contexto de usuario.
"""
import hmac
import hashlib
import json
import logging
from urllib.parse import parse_qs, unquote
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.contact import Contact
from app.models.location import Location
from app.models.product import Product
from app.models.client import Client

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== SCHEMAS ====================

class TelegramUser(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    language_code: Optional[str] = None


class ValidateInitDataRequest(BaseModel):
    init_data: str


class ValidateInitDataResponse(BaseModel):
    valid: bool
    user: Optional[TelegramUser] = None
    auth_date: Optional[int] = None
    error: Optional[str] = None


class LocationContext(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    product_id: Optional[int] = None
    product_name: Optional[str] = None


class UserContext(BaseModel):
    contact_id: int
    name: str
    role: str
    client_id: int
    client_name: str
    locations: list[LocationContext]
    products: list[dict]


# ==================== HELPERS ====================

def validate_telegram_init_data(init_data: str, bot_token: str) -> tuple[bool, Optional[dict], Optional[str]]:
    """
    Valida el initData de Telegram Web App.

    Telegram envía initData como query string con un hash HMAC.
    Debemos verificar que el hash coincida para asegurar autenticidad.

    Args:
        init_data: Query string de initData de Telegram
        bot_token: Token del bot de Telegram

    Returns:
        Tuple de (es_válido, datos_parseados, error)
    """
    try:
        # Parsear query string
        parsed = parse_qs(init_data)

        # Obtener el hash enviado
        received_hash = parsed.get("hash", [None])[0]
        if not received_hash:
            return False, None, "Missing hash"

        # Construir data-check-string (ordenado alfabéticamente, sin hash)
        data_pairs = []
        for key in sorted(parsed.keys()):
            if key != "hash":
                value = parsed[key][0]
                data_pairs.append(f"{key}={unquote(value)}")

        data_check_string = "\n".join(data_pairs)

        # Calcular hash esperado
        # secret_key = HMAC-SHA256(bot_token, "WebAppData")
        secret_key = hmac.new(
            b"WebAppData",
            bot_token.encode(),
            hashlib.sha256
        ).digest()

        # hash = HMAC-SHA256(secret_key, data_check_string)
        expected_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(received_hash, expected_hash):
            return False, None, "Invalid hash"

        # Verificar auth_date no muy viejo (máximo 24 horas)
        auth_date = int(parsed.get("auth_date", [0])[0])
        now = int(datetime.utcnow().timestamp())
        if now - auth_date > 86400:  # 24 horas
            return False, None, "Auth data expired"

        # Parsear datos del usuario
        user_json = parsed.get("user", [None])[0]
        user_data = None
        if user_json:
            user_data = json.loads(unquote(user_json))

        return True, {
            "user": user_data,
            "auth_date": auth_date,
            "query_id": parsed.get("query_id", [None])[0],
            "chat_type": parsed.get("chat_type", [None])[0],
            "chat_instance": parsed.get("chat_instance", [None])[0],
        }, None

    except Exception as e:
        logger.error(f"Error validating initData: {e}")
        return False, None, str(e)


# ==================== ENDPOINTS ====================

@router.post("/validate-telegram", response_model=ValidateInitDataResponse)
async def validate_telegram(request: ValidateInitDataRequest):
    """
    Valida que los datos de Telegram Web App son auténticos.

    Esto previene falsificación de identidad en las Web Apps.
    """
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=500, detail="Bot token not configured")

    is_valid, data, error = validate_telegram_init_data(
        request.init_data,
        settings.TELEGRAM_BOT_TOKEN
    )

    if not is_valid:
        return ValidateInitDataResponse(
            valid=False,
            error=error
        )

    user = None
    if data and data.get("user"):
        user = TelegramUser(**data["user"])

    return ValidateInitDataResponse(
        valid=True,
        user=user,
        auth_date=data.get("auth_date") if data else None
    )


@router.get("/user-context/{telegram_id}", response_model=UserContext)
async def get_user_context(
    telegram_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene el contexto del usuario para la Web App.

    Incluye:
    - Información del contacto
    - Cliente asociado
    - Ubicaciones disponibles
    - Productos disponibles
    """
    try:
        # Buscar contacto por telegram_id
        logger.info(f"[user-context] Looking up telegram_id: {telegram_id}")
        result = await db.execute(
            select(Contact)
            .options(selectinload(Contact.client))
            .where(Contact.telegram_id == telegram_id)
        )
        contact = result.scalar_one_or_none()

        if not contact:
            logger.warning(f"[user-context] Contact not found for telegram_id: {telegram_id}")
            raise HTTPException(
                status_code=404,
                detail="Usuario no vinculado. Usa /start en el bot primero."
            )

        logger.info(f"[user-context] Found contact: {contact.id} - {contact.name}")

        if not contact.client_id:
            logger.warning(f"[user-context] Contact {contact.id} has no client_id")
            raise HTTPException(
                status_code=404,
                detail="Contacto sin cliente asociado"
            )

        if not contact.client:
            logger.warning(f"[user-context] Contact {contact.id} client relationship not loaded")
            raise HTTPException(
                status_code=404,
                detail="Contacto sin cliente asociado"
            )

        logger.info(f"[user-context] Client: {contact.client_id} - {contact.client.name}")

        # Obtener ubicaciones del cliente
        result = await db.execute(
            select(Location)
            .options(selectinload(Location.product))
            .where(
                Location.client_id == contact.client_id,
                Location.active == True
            )
        )
        locations = result.scalars().all()
        logger.info(f"[user-context] Found {len(locations)} locations")

        # Obtener productos disponibles
        result = await db.execute(
            select(Product).where(Product.active == True)
        )
        products = result.scalars().all()
        logger.info(f"[user-context] Found {len(products)} products")

        # Determinar el rol de forma segura
        role_value = "operator"
        if contact.role:
            try:
                role_value = contact.role.value if hasattr(contact.role, 'value') else str(contact.role)
            except Exception as e:
                logger.warning(f"[user-context] Error getting role value: {e}")

        response = UserContext(
            contact_id=contact.id,
            name=contact.name,
            role=role_value,
            client_id=contact.client_id,
            client_name=contact.client.name,
            locations=[
                LocationContext(
                    id=loc.id,
                    name=loc.name,
                    address=loc.address,
                    latitude=loc.latitude,
                    longitude=loc.longitude,
                    product_id=loc.product_id,
                    product_name=loc.product.name if loc.product else None
                )
                for loc in locations
            ],
            products=[
                {
                    "id": p.id,
                    "name": p.name,
                    "description": p.description,
                    "sku": p.sku,
                    "dosage": p.dosage,
                    "category": p.category,
                }
                for p in products
            ]
        )

        logger.info(f"[user-context] Successfully built response for {contact.name}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[user-context] Unexpected error for telegram_id {telegram_id}: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error interno: {type(e).__name__}: {str(e)}"
        )


@router.get("/health")
async def webapp_health():
    """Health check para el módulo webapp."""
    return {
        "status": "ok",
        "module": "webapp",
        "telegram_configured": bool(settings.TELEGRAM_BOT_TOKEN)
    }
