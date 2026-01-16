from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    """Configuración de la aplicación usando Pydantic Settings."""

    # Aplicación
    APP_NAME: str = "Biorem Compliance"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Base de datos
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/biorem",
        description="URL de conexión a PostgreSQL"
    )

    # Telegram Bot
    TELEGRAM_BOT_TOKEN: str = Field(
        default="",
        description="Token del bot de Telegram (obtener de @BotFather)"
    )
    TELEGRAM_WEBHOOK_URL: Optional[str] = Field(
        default=None,
        description="URL para webhook de Telegram (para producción)"
    )

    # Anthropic (Claude Vision)
    ANTHROPIC_API_KEY: str = Field(
        default="",
        description="API Key de Anthropic para Claude Vision"
    )
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"

    # Storage (para fotos de evidencia)
    STORAGE_TYPE: str = "local"  # "local", "s3", "r2"
    STORAGE_PATH: str = "./storage/photos"

    # R2/S3 (opcional)
    R2_ACCOUNT_ID: Optional[str] = None
    R2_ACCESS_KEY_ID: Optional[str] = None
    R2_SECRET_ACCESS_KEY: Optional[str] = None
    R2_BUCKET_NAME: Optional[str] = None

    # Seguridad
    SECRET_KEY: str = Field(
        default="change-me-in-production-use-openssl-rand-hex-32",
        description="Clave secreta para JWT y encriptación"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 semana

    # Configuración de recordatorios
    DEFAULT_REMINDER_TIME: str = "09:00"
    DEFAULT_FREQUENCY_DAYS: int = 7
    ESCALATION_MINUTES: int = 120  # 2 horas sin respuesta
    MAX_ESCALATION_ATTEMPTS: int = 3

    # Admin
    ADMIN_TELEGRAM_IDS: list[int] = Field(
        default=[],
        description="IDs de Telegram de administradores"
    )

    # CORS (para el frontend)
    CORS_ORIGINS: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        description="Orígenes permitidos para CORS"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Obtiene la configuración cacheada."""
    return Settings()


settings = get_settings()
