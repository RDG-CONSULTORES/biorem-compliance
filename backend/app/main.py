from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

from sqlalchemy import text
from app.config import settings
from app.database import async_engine, Base

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def run_migrations():
    """Ejecuta migraciones de Alembic al iniciar la aplicación."""
    try:
        from alembic.config import Config
        from alembic import command

        # Obtener la ruta del directorio backend
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        alembic_cfg = Config(os.path.join(backend_dir, "alembic.ini"))
        alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))

        logger.info("Running database migrations...")
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migrations completed successfully")
        return True
    except Exception as e:
        logger.error(f"Migration error: {e}")
        # No fallar si hay error - podría ser que las columnas ya existen
        return False


async def ensure_photo_guard_columns():
    """
    Asegura que las columnas de Photo Guard existan en la base de datos.

    Esta función usa ALTER TABLE ... ADD COLUMN IF NOT EXISTS para agregar
    las columnas necesarias sin depender de Alembic.
    """
    columns_sql = [
        # Contacts - Photo Guard location tracking
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_known_latitude FLOAT",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_known_longitude FLOAT",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMP",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_location_accuracy FLOAT",

        # Compliance Records - Photo Guard validation
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS expected_latitude FLOAT",
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS expected_longitude FLOAT",
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS authenticity_score INTEGER",
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS location_verified BOOLEAN",
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS time_verified BOOLEAN",
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS distance_from_expected FLOAT",
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS time_diff_minutes INTEGER",
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS ai_appears_screenshot BOOLEAN",
    ]

    try:
        async with async_engine.begin() as conn:
            for sql in columns_sql:
                try:
                    await conn.execute(text(sql))
                except Exception as col_error:
                    # Log pero continuar - la columna puede ya existir
                    logger.debug(f"Column SQL result: {sql[:50]}... - {col_error}")

            logger.info("Photo Guard columns verified/created successfully")
            return True
    except Exception as e:
        logger.error(f"Error ensuring Photo Guard columns: {e}")
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Maneja el ciclo de vida de la aplicación."""
    telegram_app = None

    try:
        # Startup
        logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
        logger.info(f"Environment: {settings.ENVIRONMENT}")

        # Ejecutar migraciones de base de datos
        # Esto crea tablas nuevas Y agrega columnas a tablas existentes
        try:
            # Importar modelos para que Alembic los conozca
            from app.models import (
                Client, Location, Contact, Product,
                ScheduledReminder, ComplianceRecord, NotificationLog
            )
            run_migrations()
        except Exception as e:
            logger.error(f"Database migration error: {e}")
            # Fallback: intentar create_all básico
            try:
                async with async_engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
                    logger.info("Fallback: Database tables created with create_all")
            except Exception as e2:
                logger.error(f"Fallback database initialization also failed: {e2}")

        # IMPORTANTE: Asegurar que las columnas de Photo Guard existan
        # Esto es necesario porque create_all no agrega columnas a tablas existentes
        await ensure_photo_guard_columns()

        # Iniciar bot de Telegram
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
                # Continue anyway - API should still work

        logger.info("Application startup complete - ready to serve requests")

    except Exception as e:
        logger.error(f"Critical startup error: {e}")

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
    docs_url="/docs",  # Swagger UI habilitado
    redoc_url="/redoc",  # ReDoc habilitado
    lifespan=lifespan
)

# Configurar CORS
# Orígenes permitidos (hardcoded para evitar problemas con variables de entorno)
cors_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://biorem-compliance-front-end-production.up.railway.app",
]
# También agregar orígenes de la variable de entorno si existen
cors_origins.extend([o for o in settings.cors_origins_list if o not in cors_origins])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint - MUST respond quickly for Railway
@app.get("/health")
def health_check():
    """Endpoint de salud para Railway y monitoreo."""
    return {"status": "ok"}


@app.get("/health/detailed")
async def health_check_detailed():
    """Endpoint de salud detallado."""
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
    compliance_router,
    reports_router
)

app.include_router(clients_router, prefix="/api/clients", tags=["Clientes"])
app.include_router(locations_router, prefix="/api/locations", tags=["Ubicaciones"])
app.include_router(products_router, prefix="/api/products", tags=["Productos"])
app.include_router(contacts_router, prefix="/api/contacts", tags=["Contactos"])
app.include_router(compliance_router, prefix="/api/compliance", tags=["Compliance"])
app.include_router(reports_router, prefix="/api/reports", tags=["Reportes"])
