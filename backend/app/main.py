from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database import async_engine, Base

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Maneja el ciclo de vida de la aplicación."""
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")

    # Crear tablas si no existen (solo en desarrollo)
    if settings.DEBUG:
        async with async_engine.begin() as conn:
            # Importar todos los modelos para que SQLAlchemy los conozca
            from app.models import (
                Client, Location, Contact, Product,
                ScheduledReminder, ComplianceRecord, NotificationLog
            )
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created/verified")

    # Iniciar bot de Telegram
    telegram_app = None
    if settings.TELEGRAM_BOT_TOKEN:
        try:
            from app.bot.handlers import start_bot, stop_bot
            from app.bot.scheduler import start_scheduler, stop_scheduler

            telegram_app = await start_bot()
            if telegram_app:
                await start_scheduler(telegram_app.bot)
                logger.info("Telegram bot and scheduler started")
        except Exception as e:
            logger.error(f"Failed to start Telegram bot: {e}")

    yield

    # Shutdown
    logger.info("Shutting down...")

    # Detener bot y scheduler
    if telegram_app:
        try:
            from app.bot.handlers import stop_bot
            from app.bot.scheduler import stop_scheduler
            stop_scheduler()
            await stop_bot(telegram_app)
        except Exception as e:
            logger.error(f"Error stopping bot: {e}")

    await async_engine.dispose()


# Crear aplicación FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    description="Sistema de recordatorios y compliance para Biorem",
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Endpoint de salud para Railway y monitoreo."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT
    }


# Root endpoint
@app.get("/")
async def root():
    """Endpoint raíz."""
    return {
        "message": f"Bienvenido a {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": "/docs" if settings.DEBUG else "Disabled in production"
    }


# Incluir routers de API
from app.api import (
    clients_router,
    locations_router,
    products_router,
    contacts_router,
    compliance_router
)

app.include_router(clients_router, prefix="/api/clients", tags=["Clientes"])
app.include_router(locations_router, prefix="/api/locations", tags=["Ubicaciones"])
app.include_router(products_router, prefix="/api/products", tags=["Productos"])
app.include_router(contacts_router, prefix="/api/contacts", tags=["Contactos"])
app.include_router(compliance_router, prefix="/api/compliance", tags=["Compliance"])
