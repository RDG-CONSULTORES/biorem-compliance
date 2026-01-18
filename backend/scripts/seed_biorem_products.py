"""
Script para cargar el catálogo completo de productos Biorem.

Datos extraídos de: https://biorem.mx/productos-de-limpieza/

Ejecutar con:
    cd backend
    python -m scripts.seed_biorem_products

Características:
    - Idempotente: puede ejecutarse múltiples veces sin duplicar datos
    - Verifica productos existentes por SKU
    - Reporta productos agregados y omitidos
"""
import asyncio
import sys
sys.path.insert(0, '.')

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.product import Product
from app.data.biorem_catalog import BIOREM_PRODUCTS


async def seed_biorem_products():
    """
    Carga los productos de Biorem en la base de datos.

    Es idempotente: verifica por SKU antes de agregar.
    """
    print("\n" + "=" * 60)
    print("🏭 CARGA DE CATÁLOGO BIOREM")
    print("=" * 60)
    print(f"Total de productos en catálogo: {len(BIOREM_PRODUCTS)}")
    print("-" * 60)

    # Contadores
    added = 0
    skipped = 0
    errors = 0

    async with AsyncSessionLocal() as db:
        for product_data in BIOREM_PRODUCTS:
            sku = product_data["sku"]
            name = product_data["name"]

            try:
                # Verificar si ya existe por SKU
                result = await db.execute(
                    select(Product).where(Product.sku == sku)
                )
                existing = result.scalar_one_or_none()

                if existing:
                    print(f"  ⏭️  {sku}: {name} (ya existe, ID={existing.id})")
                    skipped += 1
                    continue

                # Crear nuevo producto
                product = Product(**product_data)
                db.add(product)
                await db.flush()  # Para obtener el ID

                print(f"  ✅ {sku}: {name} (ID={product.id})")
                added += 1

            except Exception as e:
                print(f"  ❌ {sku}: {name} - ERROR: {e}")
                errors += 1

        # Commit final
        await db.commit()

    # Resumen
    print("-" * 60)
    print("📊 RESUMEN:")
    print(f"  ✅ Agregados: {added}")
    print(f"  ⏭️  Omitidos (ya existían): {skipped}")
    print(f"  ❌ Errores: {errors}")
    print("=" * 60)

    if added > 0:
        print("\n🎉 Catálogo cargado exitosamente!")
        print("   Verifica en: /api/products")
    elif skipped > 0 and added == 0:
        print("\n✅ Todos los productos ya estaban cargados.")

    return {"added": added, "skipped": skipped, "errors": errors}


async def list_products():
    """Lista los productos actuales en la base de datos."""
    print("\n📦 PRODUCTOS EN BASE DE DATOS:")
    print("-" * 60)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Product).where(Product.active == True).order_by(Product.category, Product.name)
        )
        products = result.scalars().all()

        if not products:
            print("  (vacío)")
            return

        current_category = None
        for p in products:
            if p.category != current_category:
                current_category = p.category
                print(f"\n  [{current_category}]")
            print(f"    {p.id:3d}. {p.sku}: {p.name}")

        print(f"\n  Total: {len(products)} productos")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Gestión del catálogo de productos Biorem")
    parser.add_argument("--list", action="store_true", help="Listar productos actuales")
    parser.add_argument("--seed", action="store_true", help="Cargar catálogo Biorem")

    args = parser.parse_args()

    if args.list:
        asyncio.run(list_products())
    elif args.seed:
        asyncio.run(seed_biorem_products())
    else:
        # Por defecto, ejecutar seed
        asyncio.run(seed_biorem_products())
