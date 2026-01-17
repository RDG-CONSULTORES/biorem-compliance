from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    """Configuración de la aplicación usando Pydantic Settings."""

    # Aplicación
    APP_NAME: str = "Biorem Compliance"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Base de datos (Railway provee DATABASE_URL automáticamente)
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/biorem",
        description="URL de conexión a PostgreSQL"
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def convert_database_url(cls, v: str) -> str:
        """Convierte la URL de Railway a formato asyncpg."""
        if v and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

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
    CLAUDE_MODEL: str = "claude-sonnet-4-5-20250514"

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

    # Admin (puede ser JSON array o string separado por comas)
    ADMIN_TELEGRAM_IDS: str = Field(
        default="",
        description="IDs de Telegram de administradores (separados por coma)"
    )

    @property
    def admin_telegram_ids_list(self) -> list[int]:
        """Retorna ADMIN_TELEGRAM_IDS como lista de enteros."""
        if not self.ADMIN_TELEGRAM_IDS:
            return []
        try:
            # Intentar parsear como JSON primero
            import json
            return json.loads(self.ADMIN_TELEGRAM_IDS)
        except (json.JSONDecodeError, TypeError):
            # Si falla, parsear como string separado por comas
            return [int(id.strip()) for id in self.ADMIN_TELEGRAM_IDS.split(",") if id.strip()]

    # CORS (para el frontend)
    # Puede ser string separado por comas o lista
    CORS_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:5173",
        description="Orígenes permitidos para CORS (separados por coma)"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Retorna CORS_ORIGINS como lista."""
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Obtiene la configuración cacheada."""
    return Settings()


settings = get_settings()
