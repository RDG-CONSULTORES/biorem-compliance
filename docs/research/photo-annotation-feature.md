# Investigación: Feature de Anotación de Fotos estilo Zenput

**Fecha:** 2026-01-18
**Estado:** Pendiente de implementación
**Prioridad:** Por definir

---

## Resumen Ejecutivo

**¿Es factible?** Sí, es completamente factible.

**Nivel de dificultad:** Medio-Alto (depende de qué tan sofisticado quieras el editor)

**Tiempo estimado de desarrollo:** 3-7 días dependiendo de la complejidad deseada

---

## Estado Actual del Componente

El `CameraCapture.tsx` actual:
- ✅ Captura fotos con la cámara del dispositivo
- ✅ Agrega watermarks automáticos (fecha, hora, ubicación) usando Canvas
- ✅ Maneja geolocalización
- ❌ **NO tiene capacidades de dibujo/anotación**

El componente ya usa `canvas.getContext("2d")` para watermarks, lo cual es buena base pero **no es suficiente** para anotación interactiva.

---

## Opciones de Implementación

### Opción A: Librería Especializada (Recomendada)

| Librería | Pros | Contras | Touch Mobile |
|----------|------|---------|--------------|
| **react-konva** | Muy potente, bien mantenido, React nativo | Curva de aprendizaje media | ✅ Excelente |
| **marker.js** | Específico para anotación, UI incluida | Licencia comercial para uso completo | ✅ Sí |
| **Pintura** | Editor completo tipo Photoshop | De pago ($99-299) | ✅ Excelente |
| **react-canvas-draw** | Simple, gratis, fácil de usar | Menos features | ✅ Sí |
| **Annotorious** | Ligero, open source | Más para shapes que dibujo libre | ✅ Sí |

**Recomendación**: `react-konva` o `react-canvas-draw`

### Opción B: Implementación Custom con Canvas API

Construir desde cero usando HTML5 Canvas. Más control pero más trabajo.

---

## Análisis Detallado por Feature

### 1. **Dibujo Libre con Pincel** 🖌️
- **Dificultad**: Media
- **Con librería**: 1-2 horas de integración
- **Custom**: 4-8 horas

### 2. **Selector de Colores** 🎨
- **Dificultad**: Fácil
- **Tiempo**: 1-2 horas

### 3. **Diferentes Grosores de Pincel**
- **Dificultad**: Fácil
- **Tiempo**: 1 hora

### 4. **Goma de Borrar**
- **Dificultad**: Media
- **Con librería**: Generalmente incluido
- **Custom**: 2-3 horas

### 5. **Formas (Flechas, Círculos, Rectángulos)**
- **Dificultad**: Media-Alta
- **Con librería**: Ya incluido en react-konva/marker.js
- **Custom**: 4-6 horas por forma

### 6. **Undo/Redo**
- **Dificultad**: Media
- **Con librería**: Ya incluido
- **Custom**: 3-4 horas

### 7. **Texto sobre Imagen**
- **Dificultad**: Media
- **Con librería**: Ya incluido
- **Custom**: 3-4 horas

---

## Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────┐
│                  CameraCapture.tsx                   │
│  (Actual - sin cambios mayores)                     │
└─────────────────────────────────────────────────────┘
                         │
                         ▼ onPhotoCapture()
┌─────────────────────────────────────────────────────┐
│               PhotoAnnotator.tsx (NUEVO)             │
│  ┌─────────────────────────────────────────────────┐│
│  │  Imagen base (foto capturada)                   ││
│  │  ┌─────────────────────────────────────────┐    ││
│  │  │  Canvas overlay para dibujo              │   ││
│  │  │  (react-konva o custom canvas)           │   ││
│  │  └─────────────────────────────────────────┘    ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  ┌─ Toolbar ─────────────────────────────────────┐  │
│  │ [🖌️ Brush] [⭕ Circle] [➡️ Arrow] [🔤 Text]  │  │
│  │ [Colores: 🔴🟢🔵⚫] [Grosor: ─ ── ███]        │  │
│  │ [↩️ Undo] [↪️ Redo] [✅ Guardar]               │  │
│  └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

---

## Estimación de Esfuerzo

### Con Librería (react-konva o react-canvas-draw):

| Tarea | Tiempo |
|-------|--------|
| Instalar y configurar librería | 2 hrs |
| Crear PhotoAnnotator component | 4-6 hrs |
| Integrar con CameraCapture | 2-3 hrs |
| Toolbar con herramientas básicas | 4-6 hrs |
| Testing en móvil/Telegram | 3-4 hrs |
| Ajustes y bugs | 4-6 hrs |
| **Total** | **~20-30 horas** (3-4 días) |

### Implementación Custom:

| Tarea | Tiempo |
|-------|--------|
| Canvas drawing engine | 8-12 hrs |
| Sistema de eventos touch/mouse | 4-6 hrs |
| Herramientas (brush, eraser, shapes) | 12-16 hrs |
| UI Toolbar | 4-6 hrs |
| Undo/Redo system | 4-6 hrs |
| Integración y testing | 8-10 hrs |
| **Total** | **~40-56 horas** (5-7 días) |

---

## Recomendación Final

**`react-canvas-draw` + toolbar custom**

**Por qué:**
1. Es simple y ligero (importante para Telegram WebApp)
2. Ya soporta touch events
3. Tiene undo/redo integrado
4. Es gratuito y open source
5. Fácil de integrar con React + Next.js

---

## Enlaces de Referencia

- [react-konva - GitHub](https://github.com/konvajs/react-konva)
- [react-canvas-draw](https://embiem.github.io/react-canvas-draw/)
- [marker.js](https://markerjs.com/)
- [Pintura Image Editor](https://pqina.nl/pintura/)
- [Annotorious](https://annotorious.dev/)
- [tldraw SDK](https://tldraw.dev/)

---

## Notas Adicionales

- El componente actual `CameraCapture.tsx` está en: `frontend/src/components/webapp/CameraCapture.tsx`
- Ya usa Canvas para watermarks (línea 107)
- La integración sería crear un nuevo componente `PhotoAnnotator.tsx` que se active después de capturar la foto
