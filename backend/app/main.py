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
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_known_latitude DOUBLE PRECISION",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_known_longitude DOUBLE PRECISION",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMP",
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_location_accuracy DOUBLE PRECISION",

        # Compliance Records - Photo Guard validation
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS expected_latitude DOUBLE PRECISION",
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS expected_longitude DOUBLE PRECISION",
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS authenticity_score INTEGER",
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS location_verified BOOLEAN",
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS time_verified BOOLEAN",
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS distance_from_expected DOUBLE PRECISION",
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS time_diff_minutes INTEGER",
        "ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS ai_appears_screenshot BOOLEAN",
    ]

    logger.info("=== INICIANDO VERIFICACIÓN DE COLUMNAS PHOTO GUARD ===")

    try:
        async with async_engine.begin() as conn:
            # Primero verificar qué columnas existen
            result = await conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'contacts'
            """))
            existing_contacts_cols = [row[0] for row in result.fetchall()]
            logger.info(f"Columnas existentes en contacts: {existing_contacts_cols}")

            result = await conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'compliance_records'
            """))
            existing_compliance_cols = [row[0] for row in result.fetchall()]
            logger.info(f"Columnas existentes en compliance_records: {existing_compliance_cols}")

            # Ahora agregar las columnas faltantes
            for sql in columns_sql:
                try:
                    logger.info(f"Ejecutando: {sql}")
                    await conn.execute(text(sql))
                    logger.info(f"  ✓ OK")
                except Exception as col_error:
                    logger.warning(f"  ⚠ {col_error}")

            logger.info("=== PHOTO GUARD COLUMNS VERIFIED/CREATED SUCCESSFULLY ===")
            return True
    except Exception as e:
        logger.error(f"!!! ERROR ensuring Photo Guard columns: {type(e).__name__}: {e}", exc_info=True)
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
    """Endpoint de salud detallado con diagnóstico de DB y Bot."""
    status = {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "unknown",
        "bot": "unknown",
        "photo_guard_columns": []
    }

    # Verificar base de datos y columnas
    try:
        async with async_engine.connect() as conn:
            # Test básico de conexión
            await conn.execute(text("SELECT 1"))
            status["database"] = "connected"

            # Verificar columnas de Photo Guard en contacts
            result = await conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'contacts'
                AND column_name IN ('last_known_latitude', 'last_known_longitude', 'last_location_at')
            """))
            cols = [row[0] for row in result.fetchall()]
            status["photo_guard_columns"] = cols

            if len(cols) >= 3:
                status["photo_guard"] = "OK"
            else:
                status["photo_guard"] = f"MISSING - only {len(cols)}/3 columns"

    except Exception as e:
        status["database"] = f"error: {str(e)}"
        status["status"] = "degraded"

    # Verificar si el bot está configurado
    if settings.TELEGRAM_BOT_TOKEN:
        status["bot"] = "configured"
    else:
        status["bot"] = "not configured"

    return status


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
