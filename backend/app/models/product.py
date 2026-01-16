from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class Product(Base):
    """
    Modelo de Producto - Representa un producto de Biorem.

    Los productos se asignan a ubicaciones y se usan para validar
    las fotos de evidencia con Claude Vision.
    """
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)

    # Información del producto
    name = Column(String(255), nullable=False, index=True)
    sku = Column(String(50), unique=True, index=True)  # Código de producto
    description = Column(Text)

    # Instrucciones de aplicación (se envían al usuario)
    application_instructions = Column(Text)
    dosage = Column(String(255))  # Ej: "500ml por drenaje"
    frequency_recommended = Column(Integer, default=7)  # Días recomendados

    # Imágenes del producto (para referencia y validación)
    image_url = Column(String(500))
    thumbnail_url = Column(String(500))

    # Palabras clave para validación con IA
    # Claude Vision buscará estas características en las fotos
    validation_keywords = Column(String(500))  # Ej: "envase azul, etiqueta Biorem, líquido verde"

    # Categoría
    category = Column(String(100))  # Ej: "Drenajes", "Trampas de grasa", etc.

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    active = Column(Boolean, default=True, index=True)

    # Relaciones
    locations = relationship("Location", back_populates="product")

    def __repr__(self):
        return f"<Product(id={self.id}, name='{self.name}', sku='{self.sku}')>"
