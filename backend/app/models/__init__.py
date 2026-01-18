# Modelos de Base de Datos - Biorem Compliance
# Exporta todos los modelos para fácil importación

from app.models.client import Client, BusinessType
from app.models.location import Location
from app.models.contact import Contact, ContactRole
from app.models.product import Product
from app.models.reminder import ScheduledReminder, ReminderStatus
from app.models.compliance import ComplianceRecord
from app.models.notification import NotificationLog, NotificationType
from app.models.evaluation import EvaluationTemplate, SelfEvaluation
from app.models.product_order import ProductOrder, OrderStatus

__all__ = [
    # Modelos principales
    "Client",
    "Location",
    "Contact",
    "Product",
    "ScheduledReminder",
    "ComplianceRecord",
    "NotificationLog",
    "EvaluationTemplate",
    "SelfEvaluation",
    "ProductOrder",
    # Enums
    "BusinessType",
    "ContactRole",
    "ReminderStatus",
    "NotificationType",
    "OrderStatus",
]
