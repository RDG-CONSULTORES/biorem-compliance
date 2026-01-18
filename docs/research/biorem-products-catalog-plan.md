# Plan: Carga del Catálogo de Productos Biorem

**Fecha:** 2026-01-18
**Estado:** Análisis Completo - Listo para Implementar
**Prioridad:** Alta (necesario para probar carrito en Telegram)

---

## Resumen Ejecutivo

| Aspecto | Evaluación |
|---------|------------|
| **Factibilidad** | ✅ 100% factible |
| **Riesgo de romper algo** | 🟢 Mínimo - solo agrega datos |
| **Complejidad** | 🟢 Baja |
| **Tiempo estimado** | 2-4 horas |
| **Método recomendado** | Script de seed con datos hardcodeados |

---

## 1. Productos Encontrados en biorem.mx

### Productos Ecológicos (5)

| # | Nombre | SKU Sugerido | Imagen |
|---|--------|--------------|--------|
| 1 | MULTIUSOS SANITIZANTE +LE04 | BIO-LE04 | LE04.png |
| 2 | DESINCRUSTANTE +LE02 | BIO-LE02 | LE02.png |
| 3 | DESENGRASANTE +LE01 | BIO-LE01 | LE01.png |
| 4 | CITRUS SHINE +LE05 | BIO-LE05 | LE05.png |
| 5 | JABÓN DE MANOS +LE03 | BIO-LE03 | LE03_2.png |

### Productos Químicos (10)

| # | Nombre | SKU Sugerido | Imagen |
|---|--------|--------------|--------|
| 6 | DESENGRASANTE +LQ01 | BIO-LQ01 | LQ01.png |
| 7 | DESINCRUSTANTE +LQ02 | BIO-LQ02 | LQ02_Porron.png |
| 8 | JABÓN DE MANOS +LQ03 | BIO-LQ03 | LQ03_Porron.png |
| 9 | MULTIUSOS +LQ04 | BIO-LQ04 | LQ04_Porron.png |
| 10 | CLORO +LQ05 | BIO-LQ05 | LQ05.png |
| 11 | ACEITE DE PINO +LQ06 | BIO-LQ06 | LQ06.png |
| 12 | ELIMINADOR DE OLORES +LQ07 | BIO-LQ07 | LQ07.png |
| 13 | ABRILLANTADOR DE LLANTAS +LQ08 | BIO-LQ08 | LQ08.png |
| 14 | GEL ANTIBACTERIAL +LQ09 | BIO-LQ09 | LQ09.png |
| 15 | LAVATRASTES +LQ10 | BIO-LQ10 | LQ10.png |

### Productos Biotecnológicos (2)

| # | Nombre | SKU Sugerido | Imagen |
|---|--------|--------------|--------|
| 16 | BACTERIA MBD-10 | BIO-MBD10 | Bacteria-copy.png |
| 17 | ENZIMA MBO-15 | BIO-MBO15 | Bacteria-copy.png |

**Total: 17 productos**

---

## 2. Estructura de Datos Actual

### Modelo Product (backend/app/models/product.py)

```python
class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)      # ✅ Tenemos
    sku = Column(String(50), unique=True)           # ✅ Generaremos
    description = Column(Text)                       # ✅ Tenemos
    application_instructions = Column(Text)          # ⚠️ Parcial
    dosage = Column(String(255))                     # ⚠️ Parcial
    frequency_recommended = Column(Integer)          # ➡️ Default 7
    image_url = Column(String(500))                  # ✅ Tenemos URLs
    thumbnail_url = Column(String(500))              # ✅ Misma URL
    validation_keywords = Column(String(500))        # ➡️ Generaremos
    category = Column(String(100))                   # ✅ Tenemos
    active = Column(Boolean, default=True)           # ➡️ Default True
```

### Campos que poblaremos:

| Campo | Fuente | Notas |
|-------|--------|-------|
| `name` | Web | Nombre del producto |
| `sku` | Generado | BIO-{código} |
| `description` | Web | Descripción extraída |
| `application_instructions` | Genérico | Instrucciones básicas por categoría |
| `dosage` | Genérico | "Según indicaciones del envase" |
| `frequency_recommended` | Default | 7 días |
| `image_url` | Web | URL completa de biorem.mx |
| `thumbnail_url` | Web | Misma URL |
| `validation_keywords` | Generado | "envase, etiqueta Biorem, {color}" |
| `category` | Web | Ecológico/Químico/Biotecnológico |

---

## 3. URLs de Imágenes

Base URL: `https://biorem.mx/wp-content/uploads/`

### Imágenes Completas:

```
# Ecológicos
https://biorem.mx/wp-content/uploads/2023/12/LE04-1024x868.png
https://biorem.mx/wp-content/uploads/2023/12/LE02.png
https://biorem.mx/wp-content/uploads/2023/12/LE01.png
https://biorem.mx/wp-content/uploads/2023/12/LE05.png
https://biorem.mx/wp-content/uploads/2023/12/LE03_2.png

# Químicos
https://biorem.mx/wp-content/uploads/2023/12/LQ01.png
https://biorem.mx/wp-content/uploads/2023/12/LQ02_Porron.png
https://biorem.mx/wp-content/uploads/2023/12/LQ03_Porron.png
https://biorem.mx/wp-content/uploads/2023/12/LQ04_Porron.png
https://biorem.mx/wp-content/uploads/2023/12/LQ05.png
https://biorem.mx/wp-content/uploads/2023/12/LQ06.png
https://biorem.mx/wp-content/uploads/2023/12/LQ07.png
https://biorem.mx/wp-content/uploads/2023/12/LQ08.png
https://biorem.mx/wp-content/uploads/2023/12/LQ09.png
https://biorem.mx/wp-content/uploads/2023/12/LQ10.png

# Biotecnológicos
https://biorem.mx/wp-content/uploads/2024/02/Bacteria-copy.png
```

---

## 4. Análisis de Viabilidad

### ¿Por qué NO hacer web scraping dinámico?

| Razón | Explicación |
|-------|-------------|
| **Overkill** | Solo son 17 productos, no miles |
| **Inestable** | La estructura HTML puede cambiar |
| **Innecesario** | Los productos raramente cambian |
| **Más trabajo** | Mantener scraper vs. script simple |

### ¿Por qué SÍ usar script de seed hardcodeado?

| Razón | Explicación |
|-------|-------------|
| **Simple** | Un archivo Python con los datos |
| **Confiable** | Datos verificados manualmente |
| **Rápido** | Corre en segundos |
| **Mantenible** | Fácil de actualizar cuando agreguen productos |
| **Controlado** | Puedes ajustar descripciones y SKUs |

---

## 5. Plan de Implementación

### Opción A: Script de Seed (RECOMENDADA)

```
backend/
└── scripts/
    └── seed_biorem_products.py    # Script con todos los productos
```

**Ejecutar con:**
```bash
cd backend
python -m scripts.seed_biorem_products
```

### Opción B: Endpoint de Seed

Crear endpoint `POST /api/products/seed-biorem` similar al que existe para evaluaciones:
```python
@router.post("/seed-biorem")
async def seed_biorem_products(db: AsyncSession = Depends(get_db)):
    """Carga el catálogo completo de productos Biorem."""
    # ... crear productos
```

### Opción C: Migration de Alembic

Agregar productos en una migración de base de datos.

**Recomendación: Opción A o B** - Más flexible y fácil de re-ejecutar.

---

## 6. Datos Completos para el Seed

```python
BIOREM_PRODUCTS = [
    # ========== ECOLÓGICOS ==========
    {
        "name": "Multiusos Sanitizante +LE04",
        "sku": "BIO-LE04",
        "description": "Producto elaborado con ingredientes naturales y biodegradables. Es un desinfectante y neutralizador de olores eficaz. No tóxico, hipoalergénico. Cumple con normas EPA y FDA.",
        "category": "Ecológico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LE04-1024x868.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LE04-1024x868.png",
        "application_instructions": "Aplicar directamente sobre superficies. Para desinfección, dejar actuar 5 minutos.",
        "dosage": "Listo para usar o diluir 1:10 según necesidad",
        "validation_keywords": "envase verde, etiqueta Biorem, sanitizante, LE04",
        "frequency_recommended": 1,
    },
    {
        "name": "Desincrustante +LE02",
        "sku": "BIO-LE02",
        "description": "Desincrustante natural y biodegradable con fuerte capacidad de remoción de cal y minerales. Elimina sarro, óxido y depósitos de agua dura.",
        "category": "Ecológico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LE02.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LE02.png",
        "application_instructions": "Aplicar sobre superficies con incrustaciones. Dejar actuar 10-15 minutos y enjuagar.",
        "dosage": "Aplicar sin diluir para incrustaciones severas",
        "validation_keywords": "envase, etiqueta Biorem, desincrustante, LE02",
        "frequency_recommended": 7,
    },
    {
        "name": "Desengrasante +LE01",
        "sku": "BIO-LE01",
        "description": "Desengrasante realizado con ingredientes de origen natural y biodegradables. Seguro para contacto con alimentos. Apto para uso doméstico e industrial.",
        "category": "Ecológico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LE01.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LE01.png",
        "application_instructions": "Rociar sobre superficies grasosas. Dejar actuar 3-5 minutos y limpiar.",
        "dosage": "Diluir 1:5 para limpieza regular, sin diluir para grasa pesada",
        "validation_keywords": "envase, etiqueta Biorem, desengrasante, LE01",
        "frequency_recommended": 1,
    },
    {
        "name": "Citrus Shine +LE05",
        "sku": "BIO-LE05",
        "description": "Desengrasante natural para cocinas y maquinaria. No inflamable, hipoalergénico. Aroma cítrico agradable.",
        "category": "Ecológico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LE05.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LE05.png",
        "application_instructions": "Aplicar y limpiar con paño húmedo.",
        "dosage": "Listo para usar",
        "validation_keywords": "envase, etiqueta Biorem, citrus, LE05",
        "frequency_recommended": 1,
    },
    {
        "name": "Jabón de Manos +LE03",
        "sku": "BIO-LE03",
        "description": "Jabón de manos con ingredientes naturales. Hipoalergénico, respetuoso con el medio ambiente.",
        "category": "Ecológico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LE03_2.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LE03_2.png",
        "application_instructions": "Aplicar cantidad suficiente, frotar por 20 segundos y enjuagar.",
        "dosage": "2-3 ml por lavado",
        "validation_keywords": "envase, etiqueta Biorem, jabón manos, LE03",
        "frequency_recommended": 1,
    },

    # ========== QUÍMICOS ==========
    {
        "name": "Desengrasante +LQ01",
        "sku": "BIO-LQ01",
        "description": "Desengrasante de grado industrial para múltiples superficies. Alta eficacia en grasa pesada.",
        "category": "Químico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ01.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ01.png",
        "application_instructions": "Aplicar sobre superficies grasosas, dejar actuar y enjuagar.",
        "dosage": "Diluir según grado de suciedad: 1:5 a 1:20",
        "validation_keywords": "envase, etiqueta Biorem, desengrasante, LQ01",
        "frequency_recommended": 1,
    },
    {
        "name": "Desincrustante +LQ02",
        "sku": "BIO-LQ02",
        "description": "Desincrustante multipropósito con fuerte remoción de minerales. Para uso industrial.",
        "category": "Químico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ02_Porron.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ02_Porron.png",
        "application_instructions": "Aplicar en áreas con sarro o incrustaciones. Dejar actuar 10-15 min.",
        "dosage": "Sin diluir para incrustaciones severas",
        "validation_keywords": "envase, etiqueta Biorem, desincrustante, LQ02, porrón",
        "frequency_recommended": 7,
    },
    {
        "name": "Jabón de Manos +LQ03",
        "sku": "BIO-LQ03",
        "description": "Jabón para limpieza de manos, seguro e hipoalergénico.",
        "category": "Químico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ03_Porron.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ03_Porron.png",
        "application_instructions": "Aplicar, frotar 20 segundos y enjuagar.",
        "dosage": "2-3 ml por lavado",
        "validation_keywords": "envase, etiqueta Biorem, jabón manos, LQ03",
        "frequency_recommended": 1,
    },
    {
        "name": "Multiusos +LQ04",
        "sku": "BIO-LQ04",
        "description": "Limpiador desodorizante universal que actúa rápidamente en todas las superficies lavables. Funciona en madera, vidrio, acero inoxidable y áreas de la industria alimenticia.",
        "category": "Químico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ04_Porron.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ04_Porron.png",
        "application_instructions": "Rociar y limpiar con paño. Para desodorizar, dejar actuar.",
        "dosage": "Listo para usar o diluir 1:10",
        "validation_keywords": "envase, etiqueta Biorem, multiusos, LQ04",
        "frequency_recommended": 1,
    },
    {
        "name": "Cloro +LQ05",
        "sku": "BIO-LQ05",
        "description": "Potente desinfectante utilizado para eliminar gérmenes. Desinfecta superficies y agua.",
        "category": "Químico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ05.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ05.png",
        "application_instructions": "Diluir según uso. Para superficies: 1:10. Para agua: según normativa.",
        "dosage": "Ver instrucciones del envase según aplicación",
        "validation_keywords": "envase, etiqueta Biorem, cloro, LQ05",
        "frequency_recommended": 1,
    },
    {
        "name": "Aceite de Pino +LQ06",
        "sku": "BIO-LQ06",
        "description": "Limpiador con aroma a pino para cocinas y baños. Desinfecta dejando un aroma fresco.",
        "category": "Químico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ06.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ06.png",
        "application_instructions": "Diluir y trapear pisos. Para superficies, aplicar directamente.",
        "dosage": "Diluir 1:20 para pisos",
        "validation_keywords": "envase, etiqueta Biorem, pino, LQ06",
        "frequency_recommended": 1,
    },
    {
        "name": "Eliminador de Olores +LQ07",
        "sku": "BIO-LQ07",
        "description": "Neutralizador de olores para descomposición orgánica y procesos industriales. No tóxico, seguro para personas y animales.",
        "category": "Químico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ07.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ07.png",
        "application_instructions": "Rociar en áreas con mal olor. Dejar actuar.",
        "dosage": "Aplicar según intensidad del olor",
        "validation_keywords": "envase, etiqueta Biorem, eliminador olores, LQ07",
        "frequency_recommended": 1,
    },
    {
        "name": "Abrillantador de Llantas +LQ08",
        "sku": "BIO-LQ08",
        "description": "Producto para dar brillo a llantas y tableros de vehículos. Funciona como lubricante para hule y plástico.",
        "category": "Químico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ08.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ08.png",
        "application_instructions": "Aplicar sobre llantas o tablero limpio. Dejar secar.",
        "dosage": "Aplicar cantidad moderada",
        "validation_keywords": "envase, etiqueta Biorem, abrillantador, LQ08",
        "frequency_recommended": 7,
    },
    {
        "name": "Gel Antibacterial +LQ09",
        "sku": "BIO-LQ09",
        "description": "Sanitizante en gel para manos con base alcohol, alta eficiencia. Elimina virus, bacterias, hongos y levaduras.",
        "category": "Químico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ09.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ09.png",
        "application_instructions": "Aplicar en manos secas y frotar hasta secar.",
        "dosage": "2-3 ml por aplicación",
        "validation_keywords": "envase, etiqueta Biorem, gel antibacterial, LQ09",
        "frequency_recommended": 1,
    },
    {
        "name": "Lavatrastes +LQ10",
        "sku": "BIO-LQ10",
        "description": "Detergente líquido para trastes con emulsificadores. Líquido azul, suave con las manos.",
        "category": "Químico",
        "image_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ10.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2023/12/LQ10.png",
        "application_instructions": "Aplicar sobre esponja húmeda y lavar trastes.",
        "dosage": "Pequeña cantidad rinde mucho",
        "validation_keywords": "envase azul, etiqueta Biorem, lavatrastes, LQ10",
        "frequency_recommended": 1,
    },

    # ========== BIOTECNOLÓGICOS ==========
    {
        "name": "Bacteria MBD-10",
        "sku": "BIO-MBD10",
        "description": "Formulación microbiológica con cepas no patógenas diseñadas para penetración eficiente, remoción de obstrucciones y digestión de depósitos orgánicos en sistemas de drenaje y trampas de grasa. Reduce parámetros de calidad de agua incluyendo DBO, DQO, grasas y aceites.",
        "category": "Biotecnológico",
        "image_url": "https://biorem.mx/wp-content/uploads/2024/02/Bacteria-copy.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2024/02/Bacteria-copy.png",
        "application_instructions": "Aplicar en drenajes y trampas de grasa según dosificación. Preferiblemente por la noche para mayor tiempo de acción.",
        "dosage": "500ml por drenaje o según tamaño de trampa de grasa",
        "validation_keywords": "envase, etiqueta Biorem, bacteria, MBD-10, biotecnológico",
        "frequency_recommended": 7,
    },
    {
        "name": "Enzima MBO-15",
        "sku": "BIO-MBO15",
        "description": "Biodigestor enzimático de materia orgánica, grasas, aceites, separador de sólidos suspendidos. Mejora la calidad de aguas residuales promoviendo la remoción de DBO, DQO, sólidos suspendidos totales y SAAM.",
        "category": "Biotecnológico",
        "image_url": "https://biorem.mx/wp-content/uploads/2024/02/Bacteria-copy.png",
        "thumbnail_url": "https://biorem.mx/wp-content/uploads/2024/02/Bacteria-copy.png",
        "application_instructions": "Aplicar en trampas de grasa, plantas de tratamiento o sistemas de drenaje según dosificación.",
        "dosage": "Según volumen del sistema a tratar",
        "validation_keywords": "envase, etiqueta Biorem, enzima, MBO-15, biotecnológico",
        "frequency_recommended": 7,
    },
]
```

---

## 7. Verificación Pre-Implementación

### Checklist antes de ejecutar:

- [ ] Verificar que la tabla `products` existe en la BD
- [ ] Verificar que no hay productos duplicados (por SKU)
- [ ] Confirmar que las URLs de imágenes funcionan
- [ ] Tener backup de la BD (por si acaso)

### Comando para verificar productos actuales:

```bash
curl https://resilient-strength-production-6673.up.railway.app/api/products
```

---

## 8. Resultado Esperado

### En la WebApp de Pedido:

```
┌─────────────────────────────────────────┐
│  🛒 Pedir Producto                      │
├─────────────────────────────────────────┤
│                                         │
│  📦 Ecológico (5)                       │
│  ┌─────────────────────────────────┐   │
│  │ [IMG] Multiusos Sanitizante     │   │
│  │       BIO-LE04                  │   │
│  │       [−] 0 [+]                 │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ [IMG] Desengrasante +LE01       │   │
│  │       BIO-LE01                  │   │
│  │       [−] 0 [+]                 │   │
│  └─────────────────────────────────┘   │
│  ...                                    │
│                                         │
│  🧪 Químico (10)                        │
│  ...                                    │
│                                         │
│  🦠 Biotecnológico (2)                  │
│  ┌─────────────────────────────────┐   │
│  │ [IMG] Bacteria MBD-10           │   │
│  │       BIO-MBD10                 │   │
│  │       [−] 0 [+]                 │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

---

## 9. Próximos Pasos

1. **Aprobar este plan** ✓
2. **Crear script de seed** (`backend/scripts/seed_biorem_products.py`)
3. **Ejecutar en producción** o crear endpoint para ejecutar via API
4. **Verificar en WebApp** que los productos aparecen
5. **Probar flujo completo** de pedido en Telegram

---

## 10. Notas Adicionales

### ¿Y si Biorem agrega más productos?

1. Revisar la página web
2. Agregar al script de seed
3. Re-ejecutar (el script puede verificar duplicados por SKU)

### ¿Necesitamos descargar las imágenes?

**No necesariamente.** Podemos usar las URLs directas de biorem.mx. Las imágenes se mostrarán desde su servidor.

**Ventajas de usar URLs directas:**
- No ocupamos storage
- Imágenes siempre actualizadas
- Implementación más simple

**Desventajas:**
- Dependemos de que biorem.mx esté disponible
- Si cambian URLs, se rompen imágenes

**Recomendación:** Usar URLs directas por ahora. Si es necesario, después podemos descargar y almacenar en S3/Cloudinary.

---

## Conclusión

| Pregunta | Respuesta |
|----------|-----------|
| ¿Es factible? | ✅ Sí, 100% |
| ¿Romperá algo? | 🟢 No, solo agrega datos |
| ¿Cuánto tiempo? | 2-4 horas |
| ¿Método? | Script de seed con datos hardcodeados |
| ¿Web scraping? | No necesario para 17 productos |

**Listo para implementar cuando lo apruebes.**
