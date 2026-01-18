"""Add product_orders table for order management.

Revision ID: 003_product_orders
Revises: 002_evaluation_tables
Create Date: 2026-01-17

Agrega tabla para gestión de órdenes/pedidos de productos:
- product_orders: Pedidos con firma digital y tracking de estado
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '003_product_orders'
down_revision = '002_evaluation_tables'
branch_labels = None
depends_on = None


def table_exists(table_name: str) -> bool:
    """Verifica si una tabla ya existe."""
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def enum_exists(enum_name: str) -> bool:
    """Verifica si un enum ya existe."""
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT 1 FROM pg_type WHERE typname = :name"
    ), {"name": enum_name})
    return result.fetchone() is not None


def upgrade() -> None:
    """Crear tabla product_orders."""

    # Crear enum para status si no existe
    if not enum_exists('order_status'):
        op.execute("""
            CREATE TYPE order_status AS ENUM (
                'pending',
                'approved',
                'rejected',
                'processing',
                'shipped',
                'delivered',
                'cancelled'
            )
        """)

    # === PRODUCT_ORDERS ===
    if not table_exists('product_orders'):
        op.create_table(
            'product_orders',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),

            # Relaciones
            sa.Column('location_id', sa.Integer(), sa.ForeignKey('locations.id'), nullable=False),
            sa.Column('contact_id', sa.Integer(), sa.ForeignKey('contacts.id'), nullable=False),

            # Items del pedido (JSONB array)
            sa.Column('items', JSONB(), nullable=False),

            # Notas generales
            sa.Column('notes', sa.Text(), nullable=True),

            # Estado
            sa.Column('status', sa.Enum(
                'pending', 'approved', 'rejected', 'processing',
                'shipped', 'delivered', 'cancelled',
                name='order_status',
                create_type=False
            ), default='pending', nullable=False),

            # Firma digital
            sa.Column('signature_data', sa.Text(), nullable=True),
            sa.Column('signed_by_name', sa.String(100), nullable=False),
            sa.Column('signed_at', sa.DateTime(), nullable=False),
            sa.Column('signature_latitude', sa.Float(), nullable=True),
            sa.Column('signature_longitude', sa.Float(), nullable=True),

            # Revisión por admin
            sa.Column('reviewed_by_id', sa.Integer(), sa.ForeignKey('contacts.id'), nullable=True),
            sa.Column('reviewed_at', sa.DateTime(), nullable=True),
            sa.Column('rejection_reason', sa.Text(), nullable=True),
            sa.Column('admin_notes', sa.Text(), nullable=True),

            # Metadata
            sa.Column('telegram_user_id', sa.String(50), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now())
        )

        # Índices para consultas frecuentes
        op.create_index('ix_product_orders_location_id', 'product_orders', ['location_id'])
        op.create_index('ix_product_orders_contact_id', 'product_orders', ['contact_id'])
        op.create_index('ix_product_orders_status', 'product_orders', ['status'])
        op.create_index('ix_product_orders_created_at', 'product_orders', ['created_at'])


def downgrade() -> None:
    """Eliminar tabla product_orders."""

    # Drop indexes first
    op.drop_index('ix_product_orders_created_at', table_name='product_orders')
    op.drop_index('ix_product_orders_status', table_name='product_orders')
    op.drop_index('ix_product_orders_contact_id', table_name='product_orders')
    op.drop_index('ix_product_orders_location_id', table_name='product_orders')

    # Drop table
    op.drop_table('product_orders')

    # Drop enum
    op.execute('DROP TYPE IF EXISTS order_status')
