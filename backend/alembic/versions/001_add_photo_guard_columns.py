"""Add Photo Guard columns to compliance_records and contacts.

Revision ID: 001_photo_guard
Revises:
Create Date: 2025-01-17

Agrega columnas para el sistema Photo Guard de autenticación de fotos:
- Geolocalización esperada vs real
- Score de autenticidad
- Verificación de tiempo y ubicación
- Detección de screenshots
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '001_photo_guard'
down_revision = None
branch_labels = None
depends_on = None


def column_exists(table_name: str, column_name: str) -> bool:
    """Verifica si una columna ya existe en la tabla."""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def safe_add_column(table_name: str, column: sa.Column):
    """Agrega una columna solo si no existe."""
    if not column_exists(table_name, column.name):
        op.add_column(table_name, column)


def upgrade() -> None:
    """Agregar columnas de Photo Guard."""

    # === COMPLIANCE_RECORDS ===
    # Coordenadas esperadas (de la ubicación registrada)
    safe_add_column('compliance_records',
        sa.Column('expected_latitude', sa.Float(), nullable=True))
    safe_add_column('compliance_records',
        sa.Column('expected_longitude', sa.Float(), nullable=True))

    # Score de autenticidad (Photo Guard)
    safe_add_column('compliance_records',
        sa.Column('authenticity_score', sa.Integer(), nullable=True))
    safe_add_column('compliance_records',
        sa.Column('location_verified', sa.Boolean(), nullable=True))
    safe_add_column('compliance_records',
        sa.Column('time_verified', sa.Boolean(), nullable=True))
    safe_add_column('compliance_records',
        sa.Column('distance_from_expected', sa.Float(), nullable=True))
    safe_add_column('compliance_records',
        sa.Column('time_diff_minutes', sa.Integer(), nullable=True))

    # Detección de screenshots
    safe_add_column('compliance_records',
        sa.Column('ai_appears_screenshot', sa.Boolean(), nullable=True))

    # === CONTACTS ===
    # Última ubicación conocida (para Photo Guard)
    safe_add_column('contacts',
        sa.Column('last_known_latitude', sa.Float(), nullable=True))
    safe_add_column('contacts',
        sa.Column('last_known_longitude', sa.Float(), nullable=True))
    safe_add_column('contacts',
        sa.Column('last_location_at', sa.DateTime(), nullable=True))
    safe_add_column('contacts',
        sa.Column('last_location_accuracy', sa.Float(), nullable=True))


def safe_drop_column(table_name: str, column_name: str):
    """Elimina una columna solo si existe."""
    if column_exists(table_name, column_name):
        op.drop_column(table_name, column_name)


def downgrade() -> None:
    """Revertir columnas de Photo Guard."""

    # === CONTACTS ===
    safe_drop_column('contacts', 'last_location_accuracy')
    safe_drop_column('contacts', 'last_location_at')
    safe_drop_column('contacts', 'last_known_longitude')
    safe_drop_column('contacts', 'last_known_latitude')

    # === COMPLIANCE_RECORDS ===
    safe_drop_column('compliance_records', 'ai_appears_screenshot')
    safe_drop_column('compliance_records', 'time_diff_minutes')
    safe_drop_column('compliance_records', 'distance_from_expected')
    safe_drop_column('compliance_records', 'time_verified')
    safe_drop_column('compliance_records', 'location_verified')
    safe_drop_column('compliance_records', 'authenticity_score')
    safe_drop_column('compliance_records', 'expected_longitude')
    safe_drop_column('compliance_records', 'expected_latitude')
