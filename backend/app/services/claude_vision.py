"""
Servicio de validación de fotos con Claude Vision.

Usa la API de Anthropic para analizar fotos de evidencia
y validar que cumplan con los requisitos de compliance.
"""
import anthropic
import base64
import json
import time
import logging
from typing import Optional
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)


class PhotoValidation(BaseModel):
    """Resultado de validación de foto."""
    is_valid: bool
    confidence: float  # 0.0 a 1.0
    product_detected: bool
    drainage_area_visible: bool
    appears_recent: bool  # No parece foto vieja/reciclada
    issues: list[str]
    summary: str


async def validate_compliance_photo(
    image_data: str | bytes,
    expected_product: str,
    location_name: str,
    product_keywords: Optional[str] = None
) -> tuple[PhotoValidation, int]:
    """
    Usa Claude Vision para validar que la foto de evidencia sea válida.

    Args:
        image_data: Base64 string o bytes de la imagen
        expected_product: Nombre del producto esperado
        location_name: Nombre de la ubicación
        product_keywords: Palabras clave para identificar el producto

    Returns:
        Tuple de (PhotoValidation, processing_time_ms)
    """
    start_time = time.time()

    # Verificar que la API key esté configurada
    if not settings.ANTHROPIC_API_KEY:
        logger.error("ANTHROPIC_API_KEY no está configurada")
        return PhotoValidation(
            is_valid=False,
            confidence=0.0,
            product_detected=False,
            drainage_area_visible=False,
            appears_recent=False,
            issues=["API key de Anthropic no configurada"],
            summary="No se pudo validar: falta configuración de API"
        ), 0

    # Convertir a base64 si es necesario
    if isinstance(image_data, bytes):
        image_base64 = base64.b64encode(image_data).decode('utf-8')
    else:
        image_base64 = image_data

    # Usar cliente async
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    # Construir prompt de validación
    keywords_text = ""
    if product_keywords:
        keywords_text = f"\n- Características del producto: {product_keywords}"

    prompt = f"""Analiza esta foto de evidencia de aplicación de producto para drenajes.

CONTEXTO:
- Producto esperado: {expected_product}
- Ubicación: {location_name}{keywords_text}
- Esta foto debe mostrar la aplicación del producto en un drenaje/trampa de grasa

EVALUA CON CUIDADO:
1. ¿Se ve el producto o su envase en la foto? (botella, etiqueta, líquido siendo aplicado)
2. ¿Se ve un área de drenaje, trampa de grasa, coladera, o zona de aplicación?
3. ¿La foto parece tomada recientemente y en el momento? (no es una foto vieja/reciclada)
4. ¿La calidad de la imagen es suficiente para verificar la aplicación?
5. ¿Hay algo sospechoso que indique que no es una foto genuina de aplicación?

IMPORTANTE:
- Sé razonablemente estricto pero no excesivo
- Una foto válida debe mostrar evidencia clara de aplicación
- Si solo se ve el producto sin el área de aplicación, es parcialmente válido
- Si solo se ve el área sin producto, no es válido

RESPONDE UNICAMENTE CON JSON (sin markdown):
{{
    "is_valid": true/false,
    "confidence": 0.0-1.0,
    "product_detected": true/false,
    "drainage_area_visible": true/false,
    "appears_recent": true/false,
    "issues": ["lista de problemas si los hay"],
    "summary": "Resumen breve de la evaluación en español"
}}"""

    try:
        logger.info(f"Enviando imagen a Claude Vision (modelo: {settings.CLAUDE_MODEL})")

        message = await client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_base64,
                            },
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ],
                }
            ],
        )

        # Parsear respuesta JSON
        response_text = message.content[0].text
        logger.info(f"Respuesta de Claude recibida: {response_text[:200]}...")

        # Limpiar si viene con markdown
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]

        response_text = response_text.strip()

        result = json.loads(response_text)
        processing_time = int((time.time() - start_time) * 1000)

        logger.info(f"Validación completada en {processing_time}ms: valid={result['is_valid']}, confidence={result['confidence']}")

        return PhotoValidation(**result), processing_time

    except json.JSONDecodeError as e:
        logger.error(f"Error parseando respuesta de Claude: {e}")
        logger.error(f"Texto de respuesta: {response_text[:500] if 'response_text' in dir() else 'N/A'}")

        return PhotoValidation(
            is_valid=False,
            confidence=0.0,
            product_detected=False,
            drainage_area_visible=False,
            appears_recent=False,
            issues=["Error al procesar la respuesta de validación"],
            summary="No se pudo validar la foto debido a un error técnico"
        ), int((time.time() - start_time) * 1000)

    except anthropic.APIConnectionError as e:
        logger.error(f"Error de conexión con Anthropic API: {e}")
        return PhotoValidation(
            is_valid=False,
            confidence=0.0,
            product_detected=False,
            drainage_area_visible=False,
            appears_recent=False,
            issues=["Error de conexión con el servicio de IA"],
            summary="No se pudo conectar al servicio de validación"
        ), int((time.time() - start_time) * 1000)

    except anthropic.RateLimitError as e:
        logger.error(f"Rate limit excedido en Anthropic API: {e}")
        return PhotoValidation(
            is_valid=False,
            confidence=0.0,
            product_detected=False,
            drainage_area_visible=False,
            appears_recent=False,
            issues=["Límite de solicitudes excedido, intenta más tarde"],
            summary="Servicio temporalmente no disponible"
        ), int((time.time() - start_time) * 1000)

    except anthropic.APIStatusError as e:
        logger.error(f"Error de API de Anthropic: {e.status_code} - {e.message}")
        return PhotoValidation(
            is_valid=False,
            confidence=0.0,
            product_detected=False,
            drainage_area_visible=False,
            appears_recent=False,
            issues=[f"Error del servicio de IA: {e.status_code}"],
            summary=f"Error al validar: {e.message[:100]}"
        ), int((time.time() - start_time) * 1000)

    except Exception as e:
        logger.error(f"Error inesperado en validación: {type(e).__name__}: {e}")
        return PhotoValidation(
            is_valid=False,
            confidence=0.0,
            product_detected=False,
            drainage_area_visible=False,
            appears_recent=False,
            issues=[f"Error inesperado: {type(e).__name__}"],
            summary="Error técnico durante la validación"
        ), int((time.time() - start_time) * 1000)


async def analyze_photo_metadata(
    image_data: bytes,
    photo_location: Optional[tuple[float, float]] = None,
    expected_location: Optional[tuple[float, float]] = None,
    max_distance_meters: int = 500
) -> dict:
    """
    Analiza metadata adicional de la foto.

    Args:
        image_data: Bytes de la imagen
        photo_location: Coordenadas de donde se tomó la foto (lat, lon)
        expected_location: Coordenadas esperadas de la ubicación
        max_distance_meters: Distancia máxima permitida

    Returns:
        Dict con análisis de metadata
    """
    from PIL import Image
    from PIL.ExifTags import TAGS
    import io
    import math

    result = {
        "has_exif": False,
        "camera_info": None,
        "timestamp": None,
        "location_match": None,
        "distance_meters": None
    }

    try:
        img = Image.open(io.BytesIO(image_data))

        # Extraer EXIF
        exif_data = img._getexif()
        if exif_data:
            result["has_exif"] = True

            for tag_id, value in exif_data.items():
                tag = TAGS.get(tag_id, tag_id)
                if tag == "Make":
                    result["camera_info"] = value
                elif tag == "DateTime":
                    result["timestamp"] = value

        # Verificar ubicación si está disponible
        if photo_location and expected_location:
            # Calcular distancia Haversine
            lat1, lon1 = photo_location
            lat2, lon2 = expected_location

            R = 6371000  # Radio de la tierra en metros
            phi1 = math.radians(lat1)
            phi2 = math.radians(lat2)
            delta_phi = math.radians(lat2 - lat1)
            delta_lambda = math.radians(lon2 - lon1)

            a = math.sin(delta_phi/2)**2 + \
                math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

            distance = R * c
            result["distance_meters"] = round(distance, 2)
            result["location_match"] = distance <= max_distance_meters

    except Exception as e:
        logger.warning(f"Error analyzing photo metadata: {e}")

    return result
