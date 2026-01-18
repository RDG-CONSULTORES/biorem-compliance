"""
Modelos de Autoevaluación para Biorem Compliance.

Permite crear plantillas de evaluación configurables y registrar
evaluaciones completadas con fotos, scores y firma digital.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class EvaluationTemplate(Base):
    """
    Plantilla de evaluación configurable.

    Define las áreas y preguntas que se incluyen en una evaluación,
    junto con sus pesos para el cálculo del score.
    """
    __tablename__ = "evaluation_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)

    # Estructura de áreas y preguntas (JSON)
    # Formato: {
    #   "areas": [
    #     {
    #       "id": "cocina",
    #       "name": "Área de Cocina",
    #       "weight": 0.30,
    #       "questions": [
    #         {
    #           "id": "cocina_1",
    #           "text": "¿Los drenajes están libres?",
    #           "type": "yes_no",  # yes_no, yes_no_na, scale, photo
    #           "required": true,
    #           "weight": 0.25,
    #           "requiresPhoto": true
    #         }
    #       ]
    #     }
    #   ]
    # }
    areas = Column(JSONB, nullable=False)

    # Score mínimo para aprobar (0-100)
    passing_score = Column(Float, default=70.0)

    # Estado
    active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    evaluations = relationship("SelfEvaluation", back_populates="template")

    def __repr__(self):
        return f"<EvaluationTemplate(id={self.id}, name='{self.name}')>"


class SelfEvaluation(Base):
    """
    Autoevaluación completada.

    Registra las respuestas, fotos, scores y firma digital de una
    evaluación realizada por un contacto.
    """
    __tablename__ = "self_evaluations"

    id = Column(Integer, primary_key=True, index=True)

    # Relaciones principales
    template_id = Column(Integer, ForeignKey("evaluation_templates.id"), nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False, index=True)

    # Respuestas a las preguntas (JSON)
    # Formato: {
    #   "question_id": {
    #     "value": "yes" | "no" | "na" | number,
    #     "photo_url": "https://...",
    #     "notes": "Comentario opcional"
    #   }
    # }
    answers = Column(JSONB, nullable=False)

    # Scores calculados
    area_scores = Column(JSONB)  # {"area_id": score, ...}
    total_score = Column(Float, nullable=False)
    passed = Column(Boolean, nullable=False)

    # Fotos de evidencia (URLs o base64 references)
    photos = Column(JSONB)  # [{"question_id": "x", "url": "...", "timestamp": "..."}]

    # Firma digital
    signature_data = Column(Text)  # Base64 PNG de la firma
    signed_by_name = Column(String(100), nullable=False)  # Nombre escrito del firmante
    signed_at = Column(DateTime, nullable=False)

    # Geolocalización al momento de firmar
    signature_latitude = Column(Float)
    signature_longitude = Column(Float)

    # Metadata
    telegram_user_id = Column(String(50))
    user_agent = Column(String(255))
    ip_address = Column(String(45))

    # Timestamps
    started_at = Column(DateTime)  # Cuando inició la evaluación
    completed_at = Column(DateTime)  # Cuando la completó
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    template = relationship("EvaluationTemplate", back_populates="evaluations")
    location = relationship("Location", backref="evaluations")
    contact = relationship("Contact", backref="evaluations")

    def __repr__(self):
        return f"<SelfEvaluation(id={self.id}, score={self.total_score}, passed={self.passed})>"

    def calculate_score(self, template: EvaluationTemplate) -> dict:
        """
        Calcula el score basado en las respuestas y la plantilla.

        Returns:
            dict con area_scores, total_score y passed
        """
        area_scores = {}
        total_score = 0.0

        for area in template.areas.get("areas", []):
            area_id = area["id"]
            area_weight = area.get("weight", 1.0)
            area_score = 0.0
            applicable_weight = 0.0

            for question in area.get("questions", []):
                q_id = question["id"]
                q_weight = question.get("weight", 1.0)
                answer = self.answers.get(q_id, {})
                value = answer.get("value")

                # Saltar N/A
                if value == "na":
                    continue

                applicable_weight += q_weight

                # Calcular puntos según tipo de respuesta
                if value == "yes" or value is True:
                    area_score += q_weight * 100
                elif isinstance(value, (int, float)):
                    # Para preguntas de escala (0-10 -> 0-100)
                    area_score += q_weight * (value * 10)
                # "no" o False = 0 puntos

            # Normalizar score del área
            if applicable_weight > 0:
                area_scores[area_id] = round(area_score / applicable_weight, 1)
            else:
                area_scores[area_id] = 100.0  # Todo N/A = pasa

            # Acumular al total
            total_score += area_scores[area_id] * area_weight

        self.area_scores = area_scores
        self.total_score = round(total_score, 1)
        self.passed = self.total_score >= template.passing_score

        return {
            "area_scores": area_scores,
            "total_score": self.total_score,
            "passed": self.passed
        }
