# Consulta: Incluir Fotos de Telegram en Reportes PDF

**Fecha:** 2026-01-17
**Estado:** Pendiente de implementación
**Prioridad:** Para después del chatbot

---

## Resumen Ejecutivo

Se analizó la factibilidad de incluir las fotos de evidencia (enviadas via Telegram) en los reportes PDF de compliance.

**Conclusión:** SÍ es factible con el Enfoque A (cliente-side).

---

## Arquitectura Actual

- Fotos almacenadas como `file_id` de Telegram (no archivos locales)
- Endpoint proxy existente: `/api/compliance/records/{id}/photo`
- PDF actual solo tiene datos agregados, sin fotos
- Librería @react-pdf/renderer soporta imágenes

---

## Enfoque Recomendado: Cliente-Side (2-3 días)

```
Usuario genera PDF → Frontend descarga fotos via proxy →
Convierte a Base64 → Inserta en PDF → Descarga
```

### Ventajas
- No requiere cambios en backend
- Usa infraestructura existente
- Implementación rápida

### Limitaciones
- Lento con >20 fotos
- PDF pesado (~500KB por foto)
- Consume memoria del navegador

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/reports/compliance-pdf.tsx` | Agregar `<Image>` de react-pdf |
| `frontend/src/app/(dashboard)/reports/page.tsx` | Cargar registros con fotos antes de generar |
| `frontend/src/services/reports.ts` | Función para obtener fotos en base64 |
| `frontend/src/types/index.ts` | Extender tipos para incluir fotos |

---

## Código de Referencia

```typescript
// En compliance-pdf.tsx
import { Image as PDFImage } from "@react-pdf/renderer"

// Función para convertir URL a Base64
async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}

// En el componente PDF
<PDFImage src={record.photoBase64} style={{ width: 200, height: 150 }} />
```

---

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Rate limit Telegram | Limitar fotos por reporte (max 15-20) |
| Timeout generación | Mostrar progreso, procesar en chunks |
| PDF muy pesado | Comprimir imágenes, usar thumbnails |
| Fotos antiguas no disponibles | Telegram guarda ~1 año, mostrar placeholder |

---

## Enfoque Alternativo: Servidor (5-7 días)

Para producción con alto volumen:
- Nuevo endpoint `/api/reports/export-with-photos`
- Backend descarga fotos en paralelo
- Genera PDF con Python (ReportLab)
- Mejor rendimiento, más complejo

---

## Notas Adicionales

- Campo `photo_url` existe en modelo pero no se usa (oportunidad de mejora)
- Considerar cache de imágenes para reportes frecuentes
- Para producción: migrar a Celery + Redis para generación async
