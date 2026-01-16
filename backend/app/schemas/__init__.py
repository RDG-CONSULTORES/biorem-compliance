# Schemas Pydantic - Biorem Compliance

from app.schemas.client import (
    ClientBase, ClientCreate, ClientUpdate,
    ClientResponse, ClientList
)
from app.schemas.location import (
    LocationBase, LocationCreate, LocationUpdate,
    LocationResponse, LocationList
)
from app.schemas.product import (
    ProductBase, ProductCreate, ProductUpdate,
    ProductResponse, ProductList
)
from app.schemas.contact import (
    ContactBase, ContactCreate, ContactUpdate,
    ContactResponse, ContactWithInviteCode, ContactList,
    TelegramLinkRequest
)
from app.schemas.compliance import (
    ReminderBase, ReminderCreate, ReminderResponse, ReminderList,
    ComplianceBase, ComplianceCreate, ComplianceResponse,
    ComplianceWithDetails, ComplianceList,
    AIValidationResult, ManualValidationRequest,
    DashboardStats, LocationComplianceStatus
)

__all__ = [
    # Client
    "ClientBase", "ClientCreate", "ClientUpdate",
    "ClientResponse", "ClientList",
    # Location
    "LocationBase", "LocationCreate", "LocationUpdate",
    "LocationResponse", "LocationList",
    # Product
    "ProductBase", "ProductCreate", "ProductUpdate",
    "ProductResponse", "ProductList",
    # Contact
    "ContactBase", "ContactCreate", "ContactUpdate",
    "ContactResponse", "ContactWithInviteCode", "ContactList",
    "TelegramLinkRequest",
    # Compliance & Reminders
    "ReminderBase", "ReminderCreate", "ReminderResponse", "ReminderList",
    "ComplianceBase", "ComplianceCreate", "ComplianceResponse",
    "ComplianceWithDetails", "ComplianceList",
    "AIValidationResult", "ManualValidationRequest",
    "DashboardStats", "LocationComplianceStatus",
]
