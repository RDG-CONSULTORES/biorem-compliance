"""API endpoints para Productos."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from app.database import get_db
from app.models.product import Product
from app.schemas.product import (
    ProductCreate, ProductUpdate, ProductResponse, ProductList
)

router = APIRouter()


@router.get("", response_model=ProductList)
async def list_products(
    search: Optional[str] = None,
    category: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Lista todos los productos."""
    query = select(Product)

    if active_only:
        query = query.where(Product.active == True)
    if category:
        query = query.where(Product.category == category)
    if search:
        query = query.where(
            Product.name.ilike(f"%{search}%") |
            Product.sku.ilike(f"%{search}%") |
            Product.description.ilike(f"%{search}%")
        )

    query = query.order_by(Product.name)

    result = await db.execute(query)
    products = result.scalars().all()

    return ProductList(
        items=[ProductResponse.model_validate(p) for p in products],
        total=len(products)
    )


@router.get("/categories")
async def list_categories(
    db: AsyncSession = Depends(get_db)
):
    """Lista todas las categorías de productos."""
    query = (
        select(Product.category)
        .where(Product.category.isnot(None))
        .where(Product.active == True)
        .distinct()
    )
    result = await db.execute(query)
    categories = [row[0] for row in result.fetchall()]
    return {"categories": sorted(categories)}


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Obtiene un producto por ID."""
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    return ProductResponse.model_validate(product)


@router.post("", response_model=ProductResponse, status_code=201)
async def create_product(
    product_data: ProductCreate,
    db: AsyncSession = Depends(get_db)
):
    """Crea un nuevo producto."""
    # Verificar SKU único si se proporciona
    if product_data.sku:
        result = await db.execute(
            select(Product).where(Product.sku == product_data.sku)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="El SKU ya está en uso"
            )

    product = Product(**product_data.model_dump())
    db.add(product)
    await db.flush()
    await db.refresh(product)

    return ProductResponse.model_validate(product)


@router.patch("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Actualiza un producto existente."""
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    update_data = product_data.model_dump(exclude_unset=True)

    # Verificar SKU único si se cambia
    if "sku" in update_data and update_data["sku"]:
        result = await db.execute(
            select(Product).where(
                Product.sku == update_data["sku"],
                Product.id != product_id
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="El SKU ya está en uso"
            )

    for field, value in update_data.items():
        setattr(product, field, value)

    await db.flush()
    await db.refresh(product)

    return ProductResponse.model_validate(product)


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    hard_delete: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """Elimina un producto (soft delete por defecto)."""
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if hard_delete:
        await db.delete(product)
    else:
        product.active = False

    await db.flush()
    return None
