# API Routers - Biorem Compliance

from app.api.clients import router as clients_router
from app.api.locations import router as locations_router
from app.api.products import router as products_router
from app.api.contacts import router as contacts_router
from app.api.compliance import router as compliance_router
from app.api.reports import router as reports_router
from app.api.webapp import router as webapp_router
from app.api.evaluations import router as evaluations_router
from app.api.orders import router as orders_router

__all__ = [
    "clients_router",
    "locations_router",
    "products_router",
    "contacts_router",
    "compliance_router",
    "reports_router",
    "webapp_router",
    "evaluations_router",
    "orders_router",
]
