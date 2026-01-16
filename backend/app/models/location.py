from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Time
from sqlalchemy.orm import relationship
from datetime import datetime, time

from app.database import Base


class Location(Base):
    """
    Modelo de Ubicación - Representa un punto específico donde se aplica producto.

    Puede ser una sucursal del cliente o un área específica (cocina, baño, etc.)
    donde se debe aplicar el producto de Biorem.
    """
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)

    # Identificación
    name = Column(String(255), nullable=False)  # Ej: "Cocina Principal", "Sucursal Centro"
    code = Column(String(50), unique=True, index=True)  # Código interno opcional
    description = Column(String(500))

    # Dirección (si es diferente al cliente)
    address = Column(String(500))
    city = Column(String(100))
    state = Column(String(100))

    # Coordenadas específicas de esta ubicación
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Producto asignado a esta ubicación
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)

    # Configuración de recordatorios para esta ubicación
    frequency_days = Column(Integer, default=7)  # Cada cuántos días
    reminder_time = Column(Time, default=time(9, 0))  # Hora del recordatorio
    reminder_days = Column(String(50), default="1,2,3,4,5")  # Días de la semana (1=Lun, 7=Dom)

    # Última aplicación exitosa
    last_compliance_at = Column(DateTime, nullable=True)
    last_compliance_by = Column(Integer, ForeignKey("contacts.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    active = Column(Boolean, default=True, index=True)

    # Relaciones
    client = relationship("Client", back_populates="locations")
    product = relationship("Product", back_populates="locations")
    reminders = relationship("ScheduledReminder", back_populates="location", cascade="all, delete-orphan")
    compliance_records = relationship("ComplianceRecord", back_populates="location", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Location(id={self.id}, name='{self.name}', client_id={self.client_id})>"
