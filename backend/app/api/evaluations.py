"""
API endpoints para Autoevaluaciones.

Permite crear, consultar y gestionar evaluaciones de los operadores.
"""
import logging
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.evaluation import EvaluationTemplate, SelfEvaluation
from app.models.contact import Contact
from app.models.location import Location

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== SCHEMAS ====================

class QuestionAnswer(BaseModel):
    value: str | int | float | bool  # "yes", "no", "na", or numeric
    photo_url: Optional[str] = None
    notes: Optional[str] = None


class EvaluationCreate(BaseModel):
    template_id: Optional[int] = None
    location_id: int
    telegram_user_id: str
    answers: dict[str, QuestionAnswer]
    photos: Optional[List[dict]] = None

    # Firma digital
    signature_data: str = Field(..., description="Base64 PNG de la firma")
    signed_by_name: str = Field(..., min_length=2, max_length=100)

    # Ubicación al firmar
    signature_latitude: Optional[float] = None
    signature_longitude: Optional[float] = None

    # Metadata
    started_at: Optional[datetime] = None


class EvaluationResponse(BaseModel):
    id: int
    location_id: int
    location_name: Optional[str] = None
    contact_id: int
    contact_name: Optional[str] = None
    total_score: float
    passed: bool
    area_scores: Optional[dict] = None
    signed_by_name: str
    signed_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class AreaConfig(BaseModel):
    id: str
    name: str
    weight: float = 1.0
    questions: List[dict]


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    areas: List[AreaConfig]
    passing_score: float = 70.0


class TemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    areas: dict
    passing_score: float
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== TEMPLATE ENDPOINTS ====================

@router.get("/templates", response_model=List[TemplateResponse])
async def list_templates(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Lista plantillas de evaluación disponibles."""
    query = select(EvaluationTemplate)
    if active_only:
        query = query.where(EvaluationTemplate.active == True)
    query = query.order_by(EvaluationTemplate.name)

    result = await db.execute(query)
    templates = result.scalars().all()

    return templates


@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: int, db: AsyncSession = Depends(get_db)):
    """Obtiene una plantilla específica con todas sus preguntas."""
    result = await db.execute(
        select(EvaluationTemplate).where(EvaluationTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    return template


@router.post("/templates", response_model=TemplateResponse)
async def create_template(
    data: TemplateCreate,
    db: AsyncSession = Depends(get_db)
):
    """Crea una nueva plantilla de evaluación."""
    template = EvaluationTemplate(
        name=data.name,
        description=data.description,
        areas={"areas": [area.model_dump() for area in data.areas]},
        passing_score=data.passing_score
    )

    db.add(template)
    await db.commit()
    await db.refresh(template)

    return template


# ==================== EVALUATION ENDPOINTS ====================

@router.post("/", response_model=EvaluationResponse)
async def create_evaluation(
    data: EvaluationCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Recibe evaluación completada desde Web App.

    - Valida contacto y ubicación
    - Calcula scores
    - Guarda firma
    - Notifica a supervisores si no pasa
    """
    try:
        logger.info(f"[create_evaluation] Received evaluation from telegram_id: {data.telegram_user_id}")
        logger.info(f"[create_evaluation] Location ID: {data.location_id}")
        logger.info(f"[create_evaluation] Answers count: {len(data.answers)}")

        # Buscar contacto por telegram_id
        result = await db.execute(
            select(Contact).where(Contact.telegram_id == data.telegram_user_id)
        )
        contact = result.scalar_one_or_none()

        if not contact:
            raise HTTPException(
                status_code=404,
                detail="Usuario no vinculado. Usa /start en el bot primero."
            )

        logger.info(f"[create_evaluation] Contact found: {contact.id} - {contact.name}")

        # Verificar ubicación
        result = await db.execute(
            select(Location).where(Location.id == data.location_id)
        )
        location = result.scalar_one_or_none()

        if not location:
            raise HTTPException(status_code=404, detail="Ubicación no encontrada")

        logger.info(f"[create_evaluation] Location found: {location.id} - {location.name}")

        # Obtener plantilla si se especificó
        template = None
        if data.template_id:
            result = await db.execute(
                select(EvaluationTemplate).where(EvaluationTemplate.id == data.template_id)
            )
            template = result.scalar_one_or_none()

        # Convertir respuestas al formato esperado
        answers_dict = {
            q_id: answer.model_dump() for q_id, answer in data.answers.items()
        }
        logger.info(f"[create_evaluation] Answers prepared: {list(answers_dict.keys())}")

        # Crear evaluación
        now = datetime.utcnow()
        evaluation = SelfEvaluation(
            template_id=data.template_id,
            location_id=data.location_id,
            contact_id=contact.id,
            answers=answers_dict,
            photos=data.photos,
            signature_data=data.signature_data,
            signed_by_name=data.signed_by_name,
            signed_at=now,
            signature_latitude=data.signature_latitude,
            signature_longitude=data.signature_longitude,
            telegram_user_id=data.telegram_user_id,
            started_at=data.started_at,
            completed_at=now,
            # Valores temporales - se calcularán abajo
            total_score=0,
            passed=False
        )

        # Calcular score
        if template:
            evaluation.calculate_score(template)
        else:
            # Sin plantilla, calcular score simple basado en respuestas
            yes_count = sum(
                1 for a in answers_dict.values()
                if a.get("value") in ["yes", True]
            )
            total_count = sum(
                1 for a in answers_dict.values()
                if a.get("value") not in ["na", None]
            )

            if total_count > 0:
                evaluation.total_score = round((yes_count / total_count) * 100, 1)
            else:
                evaluation.total_score = 100.0

            evaluation.passed = evaluation.total_score >= 70.0

        logger.info(f"[create_evaluation] Score calculated: {evaluation.total_score}, passed: {evaluation.passed}")

        db.add(evaluation)
        await db.commit()
        await db.refresh(evaluation)

        logger.info(f"[create_evaluation] Evaluation saved with ID: {evaluation.id}")

        # TODO: Notificar a supervisores si no pasó
        if not evaluation.passed:
            logger.warning(
                f"Evaluación {evaluation.id} NO PASÓ: "
                f"score={evaluation.total_score}, location={location.name}"
            )
            # background_tasks.add_task(notify_supervisor_failed_evaluation, evaluation.id)

        return EvaluationResponse(
            id=evaluation.id,
            location_id=evaluation.location_id,
            location_name=location.name,
            contact_id=evaluation.contact_id,
            contact_name=contact.name,
            total_score=evaluation.total_score,
            passed=evaluation.passed,
            area_scores=evaluation.area_scores,
            signed_by_name=evaluation.signed_by_name,
            signed_at=evaluation.signed_at,
            created_at=evaluation.created_at
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[create_evaluation] Error: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error interno al guardar evaluación: {type(e).__name__}: {str(e)}"
        )


@router.get("/", response_model=List[EvaluationResponse])
async def list_evaluations(
    location_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    passed: Optional[bool] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Lista evaluaciones con filtros."""
    query = (
        select(SelfEvaluation)
        .options(
            selectinload(SelfEvaluation.location),
            selectinload(SelfEvaluation.contact)
        )
    )

    if location_id:
        query = query.where(SelfEvaluation.location_id == location_id)
    if contact_id:
        query = query.where(SelfEvaluation.contact_id == contact_id)
    if passed is not None:
        query = query.where(SelfEvaluation.passed == passed)
    if from_date:
        query = query.where(SelfEvaluation.created_at >= from_date)
    if to_date:
        query = query.where(SelfEvaluation.created_at <= to_date)

    query = query.order_by(desc(SelfEvaluation.created_at)).limit(limit).offset(offset)

    result = await db.execute(query)
    evaluations = result.scalars().all()

    return [
        EvaluationResponse(
            id=e.id,
            location_id=e.location_id,
            location_name=e.location.name if e.location else None,
            contact_id=e.contact_id,
            contact_name=e.contact.name if e.contact else None,
            total_score=e.total_score,
            passed=e.passed,
            area_scores=e.area_scores,
            signed_by_name=e.signed_by_name,
            signed_at=e.signed_at,
            created_at=e.created_at
        )
        for e in evaluations
    ]


@router.get("/{evaluation_id}")
async def get_evaluation(evaluation_id: int, db: AsyncSession = Depends(get_db)):
    """Obtiene detalle completo de una evaluación."""
    result = await db.execute(
        select(SelfEvaluation)
        .options(
            selectinload(SelfEvaluation.location),
            selectinload(SelfEvaluation.contact),
            selectinload(SelfEvaluation.template)
        )
        .where(SelfEvaluation.id == evaluation_id)
    )
    evaluation = result.scalar_one_or_none()

    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")

    return {
        "id": evaluation.id,
        "template": {
            "id": evaluation.template.id,
            "name": evaluation.template.name
        } if evaluation.template else None,
        "location": {
            "id": evaluation.location.id,
            "name": evaluation.location.name,
            "address": evaluation.location.address
        } if evaluation.location else None,
        "contact": {
            "id": evaluation.contact.id,
            "name": evaluation.contact.name
        } if evaluation.contact else None,
        "answers": evaluation.answers,
        "area_scores": evaluation.area_scores,
        "total_score": evaluation.total_score,
        "passed": evaluation.passed,
        "photos": evaluation.photos,
        "signature_data": evaluation.signature_data,
        "signed_by_name": evaluation.signed_by_name,
        "signed_at": evaluation.signed_at,
        "signature_location": {
            "latitude": evaluation.signature_latitude,
            "longitude": evaluation.signature_longitude
        } if evaluation.signature_latitude else None,
        "started_at": evaluation.started_at,
        "completed_at": evaluation.completed_at,
        "created_at": evaluation.created_at
    }


# ==================== DEFAULT TEMPLATE ====================

@router.post("/templates/seed-default")
async def seed_default_template(db: AsyncSession = Depends(get_db)):
    """Crea la plantilla por defecto de Biorem si no existe."""

    # Verificar si ya existe
    result = await db.execute(
        select(EvaluationTemplate).where(EvaluationTemplate.name == "Evaluación Estándar Biorem")
    )
    existing = result.scalar_one_or_none()

    if existing:
        return {"message": "Plantilla ya existe", "id": existing.id}

    # Crear plantilla por defecto
    default_template = EvaluationTemplate(
        name="Evaluación Estándar Biorem",
        description="Evaluación estándar para verificar el cumplimiento de aplicación de productos Biorem",
        passing_score=70.0,
        areas={
            "areas": [
                {
                    "id": "drenajes",
                    "name": "Estado de Drenajes",
                    "weight": 0.35,
                    "questions": [
                        {
                            "id": "drenajes_1",
                            "text": "¿Los drenajes están libres de obstrucciones?",
                            "type": "yes_no",
                            "required": True,
                            "weight": 0.33,
                            "requiresPhoto": True
                        },
                        {
                            "id": "drenajes_2",
                            "text": "¿Se aplicó el producto en todos los drenajes?",
                            "type": "yes_no",
                            "required": True,
                            "weight": 0.33,
                            "requiresPhoto": True
                        },
                        {
                            "id": "drenajes_3",
                            "text": "¿El área está libre de malos olores?",
                            "type": "yes_no",
                            "required": True,
                            "weight": 0.34,
                            "requiresPhoto": False
                        }
                    ]
                },
                {
                    "id": "producto",
                    "name": "Manejo del Producto",
                    "weight": 0.30,
                    "questions": [
                        {
                            "id": "producto_1",
                            "text": "¿El producto está almacenado correctamente?",
                            "type": "yes_no",
                            "required": True,
                            "weight": 0.50,
                            "requiresPhoto": True
                        },
                        {
                            "id": "producto_2",
                            "text": "¿Hay suficiente inventario de producto?",
                            "type": "yes_no",
                            "required": True,
                            "weight": 0.50,
                            "requiresPhoto": False
                        }
                    ]
                },
                {
                    "id": "seguridad",
                    "name": "Seguridad y Procedimientos",
                    "weight": 0.35,
                    "questions": [
                        {
                            "id": "seguridad_1",
                            "text": "¿El personal usa equipo de protección?",
                            "type": "yes_no_na",
                            "required": True,
                            "weight": 0.33,
                            "requiresPhoto": True
                        },
                        {
                            "id": "seguridad_2",
                            "text": "¿Se sigue el procedimiento de aplicación?",
                            "type": "yes_no",
                            "required": True,
                            "weight": 0.33,
                            "requiresPhoto": False
                        },
                        {
                            "id": "seguridad_3",
                            "text": "¿Se registra la aplicación en bitácora?",
                            "type": "yes_no_na",
                            "required": True,
                            "weight": 0.34,
                            "requiresPhoto": False
                        }
                    ]
                }
            ]
        }
    )

    db.add(default_template)
    await db.commit()
    await db.refresh(default_template)

    return {"message": "Plantilla creada", "id": default_template.id}
