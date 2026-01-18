"""API endpoints para gestión de órdenes de productos."""
import logging
from datetime import datetime
from typing import Optional
from math import ceil
import base64

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import ProductOrder, OrderStatus, Contact, Location, Client, Product
from app.schemas.orders import (
    OrderCreate, OrderResponse, OrderWithDetails, OrderList,
    OrderApprove, OrderReject, OrderStatusUpdate, OrderStats
)
from app.services.order_notifications import (
    notify_new_order,
    notify_order_approved,
    notify_order_rejected,
    notify_order_status_change
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== CREAR PEDIDO ====================

@router.post("/", response_model=OrderResponse)
async def create_order(
    data: OrderCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Crea un nuevo pedido desde la WebApp.

    Requiere:
    - Usuario vinculado (telegram_user_id)
    - Al menos un producto
    - Firma digital
    """
    # Buscar contacto por telegram_id
    contact_result = await db.execute(
        select(Contact).where(Contact.telegram_id == data.telegram_user_id)
    )
    contact = contact_result.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=404,
            detail="Usuario no vinculado. Usa /start en el bot primero."
        )

    # Verificar que la ubicación existe y pertenece al cliente del contacto
    location_result = await db.execute(
        select(Location).where(
            and_(
                Location.id == data.location_id,
                Location.client_id == contact.client_id
            )
        )
    )
    location = location_result.scalar_one_or_none()

    if not location:
        raise HTTPException(
            status_code=404,
            detail="Ubicación no encontrada o no pertenece a tu cliente."
        )

    # Validar que los productos existen
    product_ids = [item.product_id for item in data.items]
    products_result = await db.execute(
        select(Product).where(Product.id.in_(product_ids))
    )
    products = {p.id: p for p in products_result.scalars().all()}

    for item in data.items:
        if item.product_id not in products:
            raise HTTPException(
                status_code=400,
                detail=f"Producto con ID {item.product_id} no encontrado."
            )

    # Crear el pedido
    order = ProductOrder(
        location_id=data.location_id,
        contact_id=contact.id,
        items=[item.model_dump() for item in data.items],
        notes=data.notes,
        status=OrderStatus.PENDING,
        signature_data=data.signature_data,
        signed_by_name=data.signed_by_name,
        signed_at=datetime.utcnow(),
        signature_latitude=data.signature_latitude,
        signature_longitude=data.signature_longitude,
        telegram_user_id=data.telegram_user_id,
    )

    db.add(order)
    await db.commit()
    await db.refresh(order)

    logger.info(f"Nuevo pedido creado: #{order.id} por {contact.name} en {location.name}")

    # Obtener nombre del cliente para la notificación
    client_result = await db.execute(
        select(Client).where(Client.id == contact.client_id)
    )
    client = client_result.scalar_one_or_none()
    client_name = client.name if client else "Cliente"

    # Notificar a admins via Telegram (en background para no bloquear respuesta)
    try:
        await notify_new_order(db, order, location.name, client_name)
    except Exception as e:
        logger.error(f"Error sending order notification: {e}")

    return order


# ==================== LISTAR PEDIDOS ====================

@router.get("/", response_model=OrderList)
async def list_orders(
    location_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    client_id: Optional[int] = None,
    status: Optional[OrderStatus] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Lista pedidos con filtros y paginación."""
    # Query base con joins
    query = (
        select(ProductOrder)
        .options(
            selectinload(ProductOrder.location),
            selectinload(ProductOrder.contact),
            selectinload(ProductOrder.reviewed_by)
        )
    )

    # Aplicar filtros
    conditions = []

    if location_id:
        conditions.append(ProductOrder.location_id == location_id)

    if contact_id:
        conditions.append(ProductOrder.contact_id == contact_id)

    if client_id:
        # Filtrar por cliente a través de location
        query = query.join(Location, ProductOrder.location_id == Location.id)
        conditions.append(Location.client_id == client_id)

    if status:
        conditions.append(ProductOrder.status == status)

    if date_from:
        conditions.append(ProductOrder.created_at >= datetime.fromisoformat(date_from))

    if date_to:
        conditions.append(ProductOrder.created_at <= datetime.fromisoformat(date_to))

    if conditions:
        query = query.where(and_(*conditions))

    # Contar total
    count_query = select(func.count()).select_from(ProductOrder)
    if conditions:
        count_query = count_query.where(and_(*conditions))
    total = (await db.execute(count_query)).scalar() or 0

    # Ordenar y paginar
    query = query.order_by(ProductOrder.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    orders = result.scalars().all()

    # Construir respuesta con detalles
    items = []
    for order in orders:
        # Obtener cliente
        client = None
        if order.location:
            client_result = await db.execute(
                select(Client).where(Client.id == order.location.client_id)
            )
            client = client_result.scalar_one_or_none()

        items.append(OrderWithDetails(
            id=order.id,
            location_id=order.location_id,
            contact_id=order.contact_id,
            items=order.items,
            notes=order.notes,
            status=order.status,
            signed_by_name=order.signed_by_name,
            signed_at=order.signed_at,
            signature_latitude=order.signature_latitude,
            signature_longitude=order.signature_longitude,
            reviewed_by_id=order.reviewed_by_id,
            reviewed_at=order.reviewed_at,
            rejection_reason=order.rejection_reason,
            admin_notes=order.admin_notes,
            telegram_user_id=order.telegram_user_id,
            created_at=order.created_at,
            updated_at=order.updated_at,
            # Detalles expandidos
            location_name=order.location.name if order.location else None,
            location_address=order.location.address if order.location else None,
            contact_name=order.contact.name if order.contact else None,
            contact_phone=order.contact.phone if order.contact else None,
            client_id=client.id if client else None,
            client_name=client.name if client else None,
            reviewed_by_name=order.reviewed_by.name if order.reviewed_by else None,
        ))

    return OrderList(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if total > 0 else 1
    )


# ==================== OBTENER PEDIDO ====================

@router.get("/{order_id}", response_model=OrderWithDetails)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Obtiene un pedido por ID con todos sus detalles."""
    result = await db.execute(
        select(ProductOrder)
        .options(
            selectinload(ProductOrder.location),
            selectinload(ProductOrder.contact),
            selectinload(ProductOrder.reviewed_by)
        )
        .where(ProductOrder.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    # Obtener cliente
    client = None
    if order.location:
        client_result = await db.execute(
            select(Client).where(Client.id == order.location.client_id)
        )
        client = client_result.scalar_one_or_none()

    return OrderWithDetails(
        id=order.id,
        location_id=order.location_id,
        contact_id=order.contact_id,
        items=order.items,
        notes=order.notes,
        status=order.status,
        signed_by_name=order.signed_by_name,
        signed_at=order.signed_at,
        signature_latitude=order.signature_latitude,
        signature_longitude=order.signature_longitude,
        reviewed_by_id=order.reviewed_by_id,
        reviewed_at=order.reviewed_at,
        rejection_reason=order.rejection_reason,
        admin_notes=order.admin_notes,
        telegram_user_id=order.telegram_user_id,
        created_at=order.created_at,
        updated_at=order.updated_at,
        location_name=order.location.name if order.location else None,
        location_address=order.location.address if order.location else None,
        contact_name=order.contact.name if order.contact else None,
        contact_phone=order.contact.phone if order.contact else None,
        client_id=client.id if client else None,
        client_name=client.name if client else None,
        reviewed_by_name=order.reviewed_by.name if order.reviewed_by else None,
    )


# ==================== APROBAR PEDIDO ====================

@router.patch("/{order_id}/approve", response_model=OrderResponse)
async def approve_order(
    order_id: int,
    data: OrderApprove,
    reviewed_by_id: int = Query(..., description="ID del contacto que aprueba"),
    db: AsyncSession = Depends(get_db)
):
    """Aprueba un pedido pendiente."""
    result = await db.execute(
        select(ProductOrder).where(ProductOrder.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if order.status != OrderStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Solo se pueden aprobar pedidos pendientes. Estado actual: {order.status.value}"
        )

    # Verificar que el revisor existe
    reviewer_result = await db.execute(
        select(Contact).where(Contact.id == reviewed_by_id)
    )
    reviewer = reviewer_result.scalar_one_or_none()
    if not reviewer:
        raise HTTPException(status_code=404, detail="Revisor no encontrado")

    # Aprobar
    order.status = OrderStatus.APPROVED
    order.reviewed_by_id = reviewed_by_id
    order.reviewed_at = datetime.utcnow()
    order.admin_notes = data.admin_notes

    await db.commit()
    await db.refresh(order)

    logger.info(f"Pedido #{order_id} aprobado por {reviewer.name}")

    # Obtener contacto del pedido y notificar
    contact_result = await db.execute(
        select(Contact).where(Contact.id == order.contact_id)
    )
    order_contact = contact_result.scalar_one_or_none()
    if order_contact:
        try:
            await notify_order_approved(db, order, order_contact)
        except Exception as e:
            logger.error(f"Error sending approval notification: {e}")

    return order


# ==================== RECHAZAR PEDIDO ====================

@router.patch("/{order_id}/reject", response_model=OrderResponse)
async def reject_order(
    order_id: int,
    data: OrderReject,
    reviewed_by_id: int = Query(..., description="ID del contacto que rechaza"),
    db: AsyncSession = Depends(get_db)
):
    """Rechaza un pedido pendiente."""
    result = await db.execute(
        select(ProductOrder).where(ProductOrder.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if order.status != OrderStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Solo se pueden rechazar pedidos pendientes. Estado actual: {order.status.value}"
        )

    # Verificar que el revisor existe
    reviewer_result = await db.execute(
        select(Contact).where(Contact.id == reviewed_by_id)
    )
    reviewer = reviewer_result.scalar_one_or_none()
    if not reviewer:
        raise HTTPException(status_code=404, detail="Revisor no encontrado")

    # Rechazar
    order.status = OrderStatus.REJECTED
    order.reviewed_by_id = reviewed_by_id
    order.reviewed_at = datetime.utcnow()
    order.rejection_reason = data.rejection_reason
    order.admin_notes = data.admin_notes

    await db.commit()
    await db.refresh(order)

    logger.info(f"Pedido #{order_id} rechazado por {reviewer.name}: {data.rejection_reason}")

    # Obtener contacto del pedido y notificar
    contact_result = await db.execute(
        select(Contact).where(Contact.id == order.contact_id)
    )
    order_contact = contact_result.scalar_one_or_none()
    if order_contact:
        try:
            await notify_order_rejected(db, order, order_contact, data.rejection_reason)
        except Exception as e:
            logger.error(f"Error sending rejection notification: {e}")

    return order


# ==================== ACTUALIZAR ESTADO ====================

@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Actualiza el estado de un pedido (shipping, delivered, etc)."""
    result = await db.execute(
        select(ProductOrder).where(ProductOrder.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    # Validar transiciones de estado permitidas
    valid_transitions = {
        OrderStatus.APPROVED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
        OrderStatus.PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
        OrderStatus.SHIPPED: [OrderStatus.DELIVERED],
        OrderStatus.PENDING: [OrderStatus.CANCELLED],
    }

    allowed = valid_transitions.get(order.status, [])
    if data.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transición no permitida de {order.status.value} a {data.status.value}"
        )

    old_status = order.status
    order.status = data.status
    if data.admin_notes:
        order.admin_notes = data.admin_notes

    await db.commit()
    await db.refresh(order)

    logger.info(f"Pedido #{order_id} actualizado a {data.status.value}")

    # Notificar cambio de estado
    contact_result = await db.execute(
        select(Contact).where(Contact.id == order.contact_id)
    )
    order_contact = contact_result.scalar_one_or_none()
    if order_contact:
        try:
            await notify_order_status_change(db, order, order_contact, data.status.value)
        except Exception as e:
            logger.error(f"Error sending status notification: {e}")

    return order


# ==================== OBTENER FIRMA (IMAGEN) ====================

@router.get("/{order_id}/signature")
async def get_order_signature(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Devuelve la imagen de la firma como PNG."""
    result = await db.execute(
        select(ProductOrder).where(ProductOrder.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if not order.signature_data:
        raise HTTPException(status_code=404, detail="Este pedido no tiene firma")

    # Decodificar base64
    try:
        # Remover prefijo data:image/png;base64, si existe
        signature = order.signature_data
        if signature.startswith("data:"):
            signature = signature.split(",", 1)[1]

        image_data = base64.b64decode(signature)
        return Response(content=image_data, media_type="image/png")
    except Exception as e:
        logger.error(f"Error decodificando firma: {e}")
        raise HTTPException(status_code=500, detail="Error al procesar la firma")


# ==================== ESTADÍSTICAS ====================

@router.get("/stats/summary", response_model=OrderStats)
async def get_order_stats(
    db: AsyncSession = Depends(get_db)
):
    """Obtiene estadísticas de pedidos."""
    # Total por estado
    stats = {}
    for status in OrderStatus:
        count = (await db.execute(
            select(func.count()).select_from(ProductOrder)
            .where(ProductOrder.status == status)
        )).scalar() or 0
        stats[status.value] = count

    # Total general
    total = sum(stats.values())

    # Este mes
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    created_this_month = (await db.execute(
        select(func.count()).select_from(ProductOrder)
        .where(ProductOrder.created_at >= month_start)
    )).scalar() or 0

    delivered_this_month = (await db.execute(
        select(func.count()).select_from(ProductOrder)
        .where(and_(
            ProductOrder.status == OrderStatus.DELIVERED,
            ProductOrder.updated_at >= month_start
        ))
    )).scalar() or 0

    return OrderStats(
        total=total,
        pending=stats.get("pending", 0),
        approved=stats.get("approved", 0),
        rejected=stats.get("rejected", 0),
        processing=stats.get("processing", 0),
        shipped=stats.get("shipped", 0),
        delivered=stats.get("delivered", 0),
        cancelled=stats.get("cancelled", 0),
        created_this_month=created_this_month,
        delivered_this_month=delivered_this_month,
    )
