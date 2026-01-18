"""Add evaluation tables for self-assessment system.

Revision ID: 002_evaluation_tables
Revises: 001_photo_guard
Create Date: 2025-01-17

Agrega tablas para el sistema de autoevaluación:
- evaluation_templates: Plantillas configurables de preguntas
- self_evaluations: Evaluaciones completadas con firma digital
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '002_evaluation_tables'
down_revision = '001_photo_guard'
branch_labels = None
depends_on = None


def table_exists(table_name: str) -> bool:
    """Verifica si una tabla ya existe."""
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    """Crear tablas de evaluación."""

    # === EVALUATION_TEMPLATES ===
    if not table_exists('evaluation_templates'):
        op.create_table(
            'evaluation_templates',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('name', sa.String(200), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('areas', JSONB(), nullable=False),
            sa.Column('passing_score', sa.Float(), default=70.0),
            sa.Column('active', sa.Boolean(), default=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now())
        )

    # === SELF_EVALUATIONS ===
    if not table_exists('self_evaluations'):
        op.create_table(
            'self_evaluations',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('template_id', sa.Integer(), sa.ForeignKey('evaluation_templates.id'), nullable=True),
            sa.Column('location_id', sa.Integer(), sa.ForeignKey('locations.id'), nullable=False),
            sa.Column('contact_id', sa.Integer(), sa.ForeignKey('contacts.id'), nullable=False),

            # Respuestas y scores
            sa.Column('answers', JSONB(), nullable=False),
            sa.Column('area_scores', JSONB(), nullable=True),
            sa.Column('total_score', sa.Float(), nullable=False),
            sa.Column('passed', sa.Boolean(), nullable=False),

            # Fotos adicionales
            sa.Column('photos', JSONB(), nullable=True),

            # Firma digital
            sa.Column('signature_data', sa.Text(), nullable=True),
            sa.Column('signed_by_name', sa.String(100), nullable=False),
            sa.Column('signed_at', sa.DateTime(), nullable=False),
            sa.Column('signature_latitude', sa.Float(), nullable=True),
            sa.Column('signature_longitude', sa.Float(), nullable=True),

            # Metadata
            sa.Column('telegram_user_id', sa.String(50), nullable=True),
            sa.Column('started_at', sa.DateTime(), nullable=True),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now())
        )

        # Índices para consultas frecuentes
        op.create_index('ix_self_evaluations_location_id', 'self_evaluations', ['location_id'])
        op.create_index('ix_self_evaluations_contact_id', 'self_evaluations', ['contact_id'])
        op.create_index('ix_self_evaluations_created_at', 'self_evaluations', ['created_at'])


def downgrade() -> None:
    """Eliminar tablas de evaluación."""

    # Drop indexes first
    op.drop_index('ix_self_evaluations_created_at', table_name='self_evaluations')
    op.drop_index('ix_self_evaluations_contact_id', table_name='self_evaluations')
    op.drop_index('ix_self_evaluations_location_id', table_name='self_evaluations')

    # Drop tables
    op.drop_table('self_evaluations')
    op.drop_table('evaluation_templates')
