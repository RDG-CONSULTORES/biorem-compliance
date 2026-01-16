from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class BusinessType(str, enum.Enum):
    """Tipos de negocio que maneja Biorem."""
    PLAZA = "plaza"
    SUPERMERCADO = "supermercado"
    CASINO = "casino"
    RESTAURANTE = "restaurante"
    HOTEL = "hotel"
    HOSPITAL = "hospital"
    OTRO = "otro"


class Client(Base):
    """
    Modelo de Cliente - Representa un negocio/empresa cliente de Biorem.

    Cada cliente puede tener múltiples ubicaciones (sucursales) y contactos.
    """
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    business_type = Column(Enum(BusinessType), default=BusinessType.OTRO)

    # Dirección principal
    address = Column(String(500))
    city = Column(String(100))
    state = Column(String(100))
    country = Column(String(100), default="México")
    postal_code = Column(String(20))

    # Coordenadas del negocio principal
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Información de contacto general
    phone = Column(String(20))
    email = Column(String(255))

    # Configuración de alertas por defecto para este cliente
    default_reminder_time = Column(String(5), default="09:00")  # HH:MM
    default_frequency_days = Column(Integer, default=7)
    escalation_minutes = Column(Integer, default=120)  # 2 horas

    # Notas internas
    notes = Column(String(1000))

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    active = Column(Boolean, default=True, index=True)

    # Relaciones
    locations = relationship("Location", back_populates="client", cascade="all, delete-orphan")
    contacts = relationship("Contact", back_populates="client", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Client(id={self.id}, name='{self.name}', type={self.business_type})>"
