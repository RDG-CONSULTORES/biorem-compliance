"""
Script para inicializar datos de demostración.

Ejecutar con: python -m scripts.init_demo_data
"""
import asyncio
import sys
sys.path.insert(0, '.')

from datetime import datetime, time
from app.database import AsyncSessionLocal, async_engine, Base
from app.models import (
    Client, Location, Contact, Product,
    BusinessType, ContactRole
)


async def init_demo_data():
    """Crea datos de demostración."""

    # Crear tablas
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Verificar si ya hay datos
        from sqlalchemy import select, func
        count = (await db.execute(select(func.count()).select_from(Client))).scalar()
        if count > 0:
            print("Ya existen datos en la base de datos. Saliendo...")
            return

        print("Creando datos de demostración...")

        # ==================== PRODUCTOS ====================
        productos = [
            Product(
                name="BioRem Drenajes",
                sku="BR-DREN-001",
                description="Tratamiento biológico para drenajes y tuberías",
                application_instructions="1. Asegúrese de que el drenaje esté despejado\n2. Vierta 500ml directamente en el drenaje\n3. Deje actuar por 30 minutos sin usar agua",
                dosage="500ml por aplicación",
                frequency_recommended=7,
                validation_keywords="botella azul, etiqueta BioRem, líquido aplicándose en drenaje",
                category="Drenajes"
            ),
            Product(
                name="BioRem Trampas de Grasa",
                sku="BR-TRAP-001",
                description="Tratamiento enzimático para trampas de grasa",
                application_instructions="1. Abra la trampa de grasa\n2. Vierta 1L del producto\n3. Cierre y deje actuar durante la noche",
                dosage="1L por aplicación",
                frequency_recommended=7,
                validation_keywords="galón verde, trampa de grasa abierta, producto siendo vertido",
                category="Trampas de grasa"
            ),
            Product(
                name="BioRem Mantenimiento",
                sku="BR-MANT-001",
                description="Producto de mantenimiento preventivo",
                application_instructions="Aplicar en áreas de drenaje según indicaciones",
                dosage="250ml por aplicación",
                frequency_recommended=14,
                validation_keywords="spray naranja, área de aplicación visible",
                category="Mantenimiento"
            ),
        ]

        for p in productos:
            db.add(p)
        await db.flush()
        print(f"  - Creados {len(productos)} productos")

        # ==================== CLIENTES ====================
        clientes = [
            Client(
                name="Plaza Comercial Las Américas",
                business_type=BusinessType.PLAZA,
                address="Av. Principal #123, Col. Centro",
                city="Monterrey",
                state="Nuevo León",
                country="México",
                postal_code="64000",
                latitude=25.6866,
                longitude=-100.3161,
                phone="+52 81 1234 5678",
                email="mantenimiento@plazaamericas.mx",
                default_reminder_time="08:00",
                default_frequency_days=7,
                notes="Cliente premium, 3 ubicaciones"
            ),
            Client(
                name="Restaurante El Buen Sabor",
                business_type=BusinessType.RESTAURANTE,
                address="Calle Hidalgo #456",
                city="Guadalajara",
                state="Jalisco",
                country="México",
                postal_code="44100",
                latitude=20.6597,
                longitude=-103.3496,
                phone="+52 33 9876 5432",
                email="gerencia@buensabor.mx",
                default_reminder_time="07:00",
                default_frequency_days=7,
                notes="Cocina grande, trampa de grasa industrial"
            ),
            Client(
                name="Hotel Grand Resort",
                business_type=BusinessType.HOTEL,
                address="Blvd. Turístico #789",
                city="Cancún",
                state="Quintana Roo",
                country="México",
                postal_code="77500",
                latitude=21.1619,
                longitude=-86.8515,
                phone="+52 998 555 1234",
                email="facilities@grandresort.mx",
                default_reminder_time="06:00",
                default_frequency_days=5,
                notes="5 cocinas, múltiples trampas de grasa"
            ),
        ]

        for c in clientes:
            db.add(c)
        await db.flush()
        print(f"  - Creados {len(clientes)} clientes")

        # ==================== UBICACIONES ====================
        # Plaza Las Américas
        ubicaciones = [
            Location(
                client_id=clientes[0].id,
                name="Food Court - Drenaje Principal",
                code="PLA-FC-001",
                description="Drenaje principal del área de comidas",
                latitude=25.6867,
                longitude=-100.3162,
                product_id=productos[0].id,
                frequency_days=7,
                reminder_time=time(8, 0),
                reminder_days="1,3,5"  # Lunes, Miércoles, Viernes
            ),
            Location(
                client_id=clientes[0].id,
                name="Cocina Central - Trampa de Grasa",
                code="PLA-CC-001",
                description="Trampa de grasa de la cocina central",
                latitude=25.6865,
                longitude=-100.3160,
                product_id=productos[1].id,
                frequency_days=7,
                reminder_time=time(7, 0),
                reminder_days="2,4,6"  # Martes, Jueves, Sábado
            ),
            # Restaurante El Buen Sabor
            Location(
                client_id=clientes[1].id,
                name="Cocina - Trampa de Grasa",
                code="RBS-COC-001",
                description="Trampa de grasa principal",
                latitude=20.6598,
                longitude=-103.3497,
                product_id=productos[1].id,
                frequency_days=7,
                reminder_time=time(7, 0),
                reminder_days="1,2,3,4,5,6"
            ),
            # Hotel Grand Resort
            Location(
                client_id=clientes[2].id,
                name="Cocina Principal - Drenaje",
                code="HGR-CP-001",
                description="Drenaje de la cocina principal",
                latitude=21.1620,
                longitude=-86.8516,
                product_id=productos[0].id,
                frequency_days=5,
                reminder_time=time(6, 0),
                reminder_days="1,2,3,4,5,6,7"
            ),
            Location(
                client_id=clientes[2].id,
                name="Cocina Buffet - Trampa de Grasa",
                code="HGR-CB-001",
                description="Trampa de grasa del buffet",
                latitude=21.1621,
                longitude=-86.8517,
                product_id=productos[1].id,
                frequency_days=5,
                reminder_time=time(6, 30),
                reminder_days="1,2,3,4,5,6,7"
            ),
        ]

        for u in ubicaciones:
            db.add(u)
        await db.flush()
        print(f"  - Creadas {len(ubicaciones)} ubicaciones")

        # ==================== CONTACTOS ====================
        contactos = [
            # Plaza Las Américas
            Contact(
                client_id=clientes[0].id,
                name="Juan Pérez",
                phone="+52 81 1111 2222",
                email="juan.perez@plazaamericas.mx",
                role=ContactRole.SUPERVISOR,
                invite_code=Contact.generate_invite_code()
            ),
            Contact(
                client_id=clientes[0].id,
                name="María García",
                phone="+52 81 3333 4444",
                email="maria.garcia@plazaamericas.mx",
                role=ContactRole.OPERADOR,
                invite_code=Contact.generate_invite_code()
            ),
            # Restaurante El Buen Sabor
            Contact(
                client_id=clientes[1].id,
                name="Carlos López",
                phone="+52 33 5555 6666",
                email="carlos@buensabor.mx",
                role=ContactRole.ADMIN,
                invite_code=Contact.generate_invite_code()
            ),
            # Hotel Grand Resort
            Contact(
                client_id=clientes[2].id,
                name="Ana Martínez",
                phone="+52 998 7777 8888",
                email="ana.martinez@grandresort.mx",
                role=ContactRole.SUPERVISOR,
                invite_code=Contact.generate_invite_code()
            ),
            Contact(
                client_id=clientes[2].id,
                name="Roberto Sánchez",
                phone="+52 998 9999 0000",
                email="roberto.sanchez@grandresort.mx",
                role=ContactRole.OPERADOR,
                invite_code=Contact.generate_invite_code()
            ),
        ]

        for c in contactos:
            db.add(c)
        await db.flush()
        print(f"  - Creados {len(contactos)} contactos")

        await db.commit()

        # Mostrar códigos de invitación
        print("\n" + "="*50)
        print("CÓDIGOS DE INVITACIÓN PARA PRUEBAS:")
        print("="*50)
        for c in contactos:
            print(f"  {c.name}: {c.invite_code}")
        print("="*50)
        print("\nUsa estos códigos en el bot de Telegram para vincular usuarios.")
        print("Bot: @biorem_compliance_bot")


if __name__ == "__main__":
    asyncio.run(init_demo_data())
