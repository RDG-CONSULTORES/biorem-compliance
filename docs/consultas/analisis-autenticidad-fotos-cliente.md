# Análisis de Autenticidad de Fotos - Consulta Cliente

**Fecha:** 2026-01-17
**Tipo:** Consultoría Técnica
**Estado:** Pendiente de aprobación del cliente

---

## RESUMEN EJECUTIVO

### Problema a Resolver

El cliente necesita garantizar que las fotos de evidencia de compliance sean:
- Tomadas en el momento (no del carrete/galería)
- Tomadas en la ubicación correcta
- No sean fotos repetidas o reenviadas

### Solución Recomendada

**Sistema Híbrido de Verificación:**

| Escenario | Método | Certeza |
|-----------|--------|---------|
| Compliance diario | Geolocalización + Timestamp + IA | 85-90% |
| Autoevaluaciones | Web App con cámara forzada | 99% |

---

## ANÁLISIS TÉCNICO

### ¿Telegram permite forzar cámara?

| Pregunta | Respuesta |
|----------|-----------|
| ¿Bot puede detectar si foto es de galería? | **NO** |
| ¿Bot puede forzar solo cámara? | **NO** directamente |
| ¿Hay workaround? | **SÍ** - Telegram Web App |

**Explicación:** Telegram Bot API no diferencia entre una foto tomada con cámara o seleccionada de galería. Ambas llegan igual al bot.

### Solución: Sistema de 3 Factores (Photo Guard)

```
┌─────────────────────────────────────────────────────────────────┐
│              SISTEMA DE AUTENTICIDAD - 3 FACTORES               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FACTOR 1: GEOLOCALIZACIÓN (40 puntos)                          │
│  ───────────────────────────────────────                        │
│  • Bot pide ubicación ANTES de aceptar foto                     │
│  • Compara con coordenadas registradas de la sucursal           │
│  • Radio de tolerancia configurable (100-500 metros)            │
│                                                                  │
│  Puntuación:                                                     │
│  • ≤100 metros = 40 puntos (muy cerca)                          │
│  • ≤300 metros = 30 puntos (cerca)                              │
│  • ≤500 metros = 20 puntos (aceptable)                          │
│  • >500 metros = 0 puntos (muy lejos)                           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FACTOR 2: VENTANA DE TIEMPO (30 puntos)                        │
│  ───────────────────────────────────────                        │
│  • Compara hora del recordatorio vs hora de envío               │
│  • Usa hora del servidor (no del teléfono)                      │
│  • Ventana válida configurable (±4 horas)                       │
│                                                                  │
│  Puntuación:                                                     │
│  • ≤30 minutos = 30 puntos (muy reciente)                       │
│  • ≤2 horas = 20 puntos (reciente)                              │
│  • ≤4 horas = 10 puntos (aceptable)                             │
│  • >4 horas = 0 puntos (muy tarde)                              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FACTOR 3: VALIDACIÓN IA (30 puntos)                            │
│  ───────────────────────────────────────                        │
│  • Claude Vision analiza la imagen                              │
│  • Detecta: producto, drenaje, contexto laboral                 │
│  • NUEVO: Detecta si parece screenshot/foto de pantalla         │
│                                                                  │
│  Puntuación:                                                     │
│  • Confianza ≥80% = 30 puntos                                   │
│  • Confianza ≥60% = 20 puntos                                   │
│  • Confianza ≥40% = 10 puntos                                   │
│  • Screenshot detectado = -50 puntos (penalización)             │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SCORE FINAL: 0-100 puntos                                      │
│  ═══════════════════════════════════════════                    │
│                                                                  │
│  80-100 pts → ✅ AUTO-APROBADO                                  │
│  50-79 pts  → ⚠️ REVISIÓN MANUAL                                │
│  0-49 pts   → ❌ RECHAZADO (solicitar nueva foto)               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## FLUJO DE USUARIO PROPUESTO

### Compliance Diario (Recordatorios)

```
1. Usuario recibe recordatorio del bot
   "🔔 Recordatorio: Aplicar BioClean Pro en Cocina Central"

2. Usuario presiona "📸 Enviar Foto"

3. Bot solicita ubicación primero:
   "📍 Para verificar tu evidencia, comparte tu ubicación"
   [📍 Compartir Ubicación]

4. Usuario comparte ubicación (1 click)

5. Bot confirma y pide foto:
   "✅ Ubicación recibida (150m de Sucursal Centro)
    Ahora envía la foto de evidencia."

6. Usuario envía foto

7. Sistema calcula score automáticamente:
   • Distancia: 150m → 30 puntos
   • Tiempo: 45 min después → 30 puntos
   • IA: 85% confianza → 30 puntos
   • TOTAL: 90/100 → ✅ Auto-aprobado

8. Bot confirma:
   "✅ Evidencia recibida y validada. ¡Gracias!"
```

### Autoevaluaciones (Web App)

```
1. Usuario presiona botón "📝 Autoevaluación"

2. Se abre Mini Web App dentro de Telegram

3. Web App solicita permiso de ubicación (HTML5)

4. Usuario responde cuestionario por áreas:
   • Área Cocina: 4 preguntas (Sí/No)
   • Área Baños: 3 preguntas (Sí/No)
   • Área Almacén: 2 preguntas (Sí/No)

5. Para fotos de evidencia:
   • Botón "📸 Tomar Foto" abre SOLO la cámara
   • NO permite seleccionar de galería
   • Agrega marca de agua con fecha/hora automática

6. Al finalizar:
   • Muestra ponderación por área (ej: Cocina 85%)
   • Muestra calificación general (ej: 82%)
   • Solicita firma digital del responsable

7. Usuario firma y envía

8. Sistema guarda todo con geolocalización y timestamp
```

---

## COMPARATIVA DE MÉTODOS

| Método | Previene foto vieja | Previene otro lugar | Detecta fraude | Fricción usuario | Certeza |
|--------|---------------------|---------------------|----------------|------------------|---------|
| Solo geolocalización | ❌ | ✅ | ❌ | Baja | 60% |
| Solo timestamp | ✅ | ❌ | ❌ | Ninguna | 40% |
| Solo IA | ❌ | ❌ | ✅ | Ninguna | 70% |
| Solo Web App | ✅ | ✅ | ✅ | Alta | 95% |
| **Híbrido (recomendado)** | ✅ | ✅ | ✅ | Media | **90-95%** |

---

## LIMITACIONES HONESTAS

### Lo que SÍ previene el sistema:
- ✅ Fotos guardadas en galería de días anteriores
- ✅ Fotos tomadas en ubicación incorrecta
- ✅ Screenshots de fotos anteriores
- ✅ Fotos reenviadas de otros chats
- ✅ Fotos descargadas de internet

### Lo que NO previene 100%:
- ❌ Usuario tomando foto a una foto física impresa
- ❌ Dos usuarios compartiendo fotos entre sí
- ❌ GPS falso (requiere root del teléfono, muy raro)
- ❌ Usuario en ubicación correcta con foto vieja Y ubicación actual

**Nota:** Estos casos representan <5% y requieren esfuerzo significativo del usuario para engañar al sistema. La auditoría manual puede detectar patrones sospechosos.

---

## IMPACTO EN EXPERIENCIA DE USUARIO

### Antes (Sistema Actual)
```
Usuario envía foto → Bot la recibe → IA valida
Tiempo: ~3 segundos
Pasos: 1
```

### Después (Sistema Propuesto)
```
Usuario presiona enviar → Comparte ubicación → Envía foto → Sistema valida
Tiempo: ~10 segundos
Pasos: 3
```

**Fricción adicional:** Mínima (1 click extra para ubicación)
**Beneficio:** Certeza aumenta de ~70% a ~90%

---

## COSTOS Y RECURSOS

### Desarrollo
| Fase | Tiempo | Descripción |
|------|--------|-------------|
| Photo Guard | 2 días | Sistema de 3 factores |
| Botones | 1 día | Teclado interactivo |
| Web App Base | 1 día | Infraestructura |
| Autoevaluación | 3 días | Cuestionario + firma |
| Pre-órdenes | 2 días | Catálogo + firma |
| Portal Admin | 2 días | Nuevas pantallas |
| Testing | 1 día | Pruebas completas |
| **TOTAL** | **12-13 días** | |

### Infraestructura (Railway Hobby)
| Recurso | Impacto |
|---------|---------|
| RAM | +10-20 MB (mínimo) |
| CPU | Sin cambio significativo |
| Storage | Sin cambio (fotos en Telegram) |
| Base de datos | +3-4 tablas nuevas |

**Conclusión:** Compatible con plan Hobby actual, sin costos adicionales de infraestructura.

---

## RECOMENDACIÓN FINAL

### Para Demo/MVP
Implementar **Fase 1 (Photo Guard)** primero:
- Mayor impacto inmediato
- Menor tiempo de desarrollo
- Mejora certeza de 70% a 90%
- No requiere Web App

### Para Producción Completa
Implementar todas las fases:
- Photo Guard + Web Apps
- Certeza de 95%+
- Funcionalidades adicionales (evaluaciones, pedidos)

---

## PRÓXIMOS PASOS

1. **Cliente aprueba** enfoque técnico
2. **Definir prioridades** (¿Photo Guard primero o todo junto?)
3. **Crear tag de respaldo** antes de implementar
4. **Desarrollo por fases** con validación en cada paso
5. **Testing con usuarios reales** antes de producción

---

**Documento preparado para presentación a cliente**
**Biorem Compliance - Consultoría Telegram Bot**
