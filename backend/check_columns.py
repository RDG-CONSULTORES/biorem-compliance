#!/usr/bin/env python3
"""
Script de diagnóstico para verificar columnas de Photo Guard en la base de datos.
"""
import asyncio
import os
import sys

# Agregar el directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database import async_engine


async def check_columns():
    """Verifica si las columnas de Photo Guard existen."""
    print("=" * 60)
    print("DIAGNÓSTICO DE COLUMNAS - Photo Guard")
    print("=" * 60)

    columns_to_check = {
        "contacts": [
            "last_known_latitude",
            "last_known_longitude",
            "last_location_at",
            "last_location_accuracy"
        ],
        "compliance_records": [
            "expected_latitude",
            "expected_longitude",
            "authenticity_score",
            "location_verified",
            "time_verified",
            "distance_from_expected",
            "time_diff_minutes",
            "ai_appears_screenshot"
        ]
    }

    async with async_engine.connect() as conn:
        for table, columns in columns_to_check.items():
            print(f"\n📋 Tabla: {table}")
            print("-" * 40)

            # Verificar si la tabla existe
            result = await conn.execute(text(f"""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = '{table}'
            """))
            existing_columns = [row[0] for row in result.fetchall()]

            if not existing_columns:
                print(f"   ❌ La tabla no existe!")
                continue

            missing = []
            for col in columns:
                if col in existing_columns:
                    print(f"   ✅ {col}")
                else:
                    print(f"   ❌ {col} (FALTA)")
                    missing.append(col)

            if missing:
                print(f"\n   ⚠️  Faltan {len(missing)} columnas en {table}")

    print("\n" + "=" * 60)
    print("FIN DEL DIAGNÓSTICO")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(check_columns())
