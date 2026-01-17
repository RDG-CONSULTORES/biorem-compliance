# Diseño Avanzado: Telegram Bot Biorem v2.0

**Fecha:** 2026-01-17
**Versión:** 2.0
**Estado:** Aprobado para planificación
**Autor:** Consultoría Telegram Bot Expert

---

## TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Análisis de Autenticidad de Fotos](#2-análisis-de-autenticidad-de-fotos)
3. [Arquitectura de Botones](#3-arquitectura-de-botones)
4. [Mini Web App: Autoevaluación](#4-mini-web-app-autoevaluación)
5. [Mini Web App: Pre-Órdenes](#5-mini-web-app-pre-órdenes)
6. [Modelos de Base de Datos](#6-modelos-de-base-de-datos)
7. [Endpoints de API](#7-endpoints-de-api)
8. [Plan de Implementación](#8-plan-de-implementación)
9. [Análisis de Riesgos](#9-análisis-de-riesgos)
10. [Rollback y Recuperación](#10-rollback-y-recuperación)

---

## 1. RESUMEN EJECUTIVO

### Objetivos

1. **Garantizar autenticidad de fotos** - Evitar fotos del carrete/repetidas
2. **Implementar botones interactivos** - Mejorar UX del chatbot
3. **Crear Web App de Autoevaluación** - Estilo Zenput con ponderación
4. **Crear Web App de Pre-Órdenes** - Con firma digital
5. **Capturar firmas digitales** - Para responsabilidad legal

### Funcionalidades Nuevas

| Módulo | Descripción | Prioridad |
|--------|-------------|-----------|
| Photo Guard | Sistema anti-fraude de fotos | ALTA |
| Menu Buttons | Teclado persistente con acciones | MEDIA |
| Web App Evaluación | Cuestionario + fotos + firma | ALTA |
| Web App Pedidos | Catálogo + firma autorización | MEDIA |

---

## 2. ANÁLISIS DE AUTENTICIDAD DE FOTOS

### El Problema

Los usuarios podrían enviar:
- Fotos guardadas en el carrete (de días anteriores)
- Fotos reenviadas de otros chats
- Screenshots de fotos anteriores
- Fotos descargadas de internet

### Métodos de Verificación Disponibles

#### Método A: Geolocalización + Timestamp (RECOMENDADO)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHOTO GUARD SYSTEM                            │
│                  (Verificación Multi-Factor)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Factor 1: GEOLOCALIZACIÓN                                      │
│  ├─ Capturar coordenadas al momento de enviar                   │
│  ├─ Comparar con coordenadas registradas de la ubicación        │
│  ├─ Radio de tolerancia: 100-500 metros                         │
│  └─ Score: +40 puntos si coincide                               │
│                                                                  │
│  Factor 2: TIMESTAMP                                             │
│  ├─ Hora del servidor al recibir foto                           │
│  ├─ Comparar con hora del recordatorio                          │
│  ├─ Ventana válida: ±4 horas del recordatorio                   │
│  └─ Score: +30 puntos si está en ventana                        │
│                                                                  │
│  Factor 3: ANÁLISIS DE IMAGEN (IA)                              │
│  ├─ Claude Vision analiza contenido                             │
│  ├─ Detecta producto, drenaje, contexto                         │
│  ├─ Detecta si parece foto de pantalla/screenshot               │
│  └─ Score: +30 puntos si pasa validación                        │
│                                                                  │
│  SCORE TOTAL: 0-100                                             │
│  ├─ 80-100: Auto-aprobado ✅                                    │
│  ├─ 50-79: Revisión manual ⚠️                                   │
│  └─ 0-49: Rechazado ❌                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Método B: Web App con Cámara Forzada

```javascript
// SOLO permite cámara, NO galería
<input type="file" accept="image/*" capture="environment" />
```

| Ventaja | Desventaja |
|---------|------------|
| 100% certeza de foto nueva | Requiere Web App |
| Control total del flujo | Más fricción para usuario |
| Puede agregar marca de agua | Necesita desarrollo adicional |

#### Método C: Telegram Location Request

```python
# Pedir ubicación antes de aceptar foto
keyboard = ReplyKeyboardMarkup([
    [KeyboardButton("📍 Compartir Ubicación", request_location=True)],
    [KeyboardButton("📸 Enviar Foto")]
])
```

### RECOMENDACIÓN EXPERTA: Enfoque Híbrido

```
┌─────────────────────────────────────────────────────────────────┐
│              ESTRATEGIA RECOMENDADA                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PARA COMPLIANCE DIARIO (Recordatorios):                        │
│  ─────────────────────────────────────────                      │
│  Usar: Método A (Geo + Timestamp + IA)                          │
│  Razón: Menos fricción, flujo natural del chat                  │
│  Implementación:                                                 │
│    1. Bot pide ubicación ANTES de foto                          │
│    2. Usuario comparte ubicación (1 click)                      │
│    3. Usuario envía foto                                        │
│    4. Sistema valida: ubicación + tiempo + IA                   │
│                                                                  │
│  PARA AUTOEVALUACIONES (Web App):                               │
│  ─────────────────────────────────────────                      │
│  Usar: Método B (Cámara forzada en Web App)                     │
│  Razón: Evaluación es proceso formal, amerita control total     │
│  Implementación:                                                 │
│    1. Usuario abre Web App                                      │
│    2. Web App pide geolocalización HTML5                        │
│    3. Input de cámara con capture="environment"                 │
│    4. Timestamp automático + marca de agua                      │
│    5. No hay forma de usar galería                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Datos a Capturar por Foto

```python
class PhotoMetadata:
    # Información básica
    file_id: str              # ID de Telegram
    received_at: datetime     # Hora servidor (UTC)

    # Geolocalización
    latitude: float           # Coordenada
    longitude: float          # Coordenada
    accuracy: float           # Precisión en metros
    location_timestamp: datetime  # Cuándo se capturó ubicación

    # Validación de ubicación
    expected_latitude: float  # Coordenadas registradas
    expected_longitude: float
    distance_meters: float    # Distancia calculada
    location_valid: bool      # ¿Está dentro del radio?

    # Validación de tiempo
    reminder_scheduled_at: datetime
    time_diff_minutes: int    # Diferencia con recordatorio
    time_valid: bool          # ¿Está en ventana válida?

    # Validación IA
    ai_confidence: float
    ai_product_detected: bool
    ai_drainage_visible: bool
    ai_appears_screenshot: bool  # NUEVO: detectar screenshot

    # Score final
    authenticity_score: int   # 0-100
    auto_approved: bool
    requires_review: bool
    rejected: bool
```

### Cálculo del Score de Autenticidad

```python
def calculate_authenticity_score(metadata: PhotoMetadata) -> int:
    score = 0

    # Factor 1: Geolocalización (40 puntos)
    if metadata.location_valid:
        if metadata.distance_meters <= 100:
            score += 40  # Muy cerca
        elif metadata.distance_meters <= 300:
            score += 30  # Cerca
        elif metadata.distance_meters <= 500:
            score += 20  # Aceptable
        else:
            score += 0   # Muy lejos

    # Factor 2: Timestamp (30 puntos)
    if metadata.time_valid:
        if abs(metadata.time_diff_minutes) <= 30:
            score += 30  # Muy reciente
        elif abs(metadata.time_diff_minutes) <= 120:
            score += 20  # Reciente
        elif abs(metadata.time_diff_minutes) <= 240:
            score += 10  # Aceptable
        else:
            score += 0   # Muy tarde

    # Factor 3: Validación IA (30 puntos)
    if metadata.ai_confidence >= 0.8:
        score += 30
    elif metadata.ai_confidence >= 0.6:
        score += 20
    elif metadata.ai_confidence >= 0.4:
        score += 10

    # Penalizaciones
    if metadata.ai_appears_screenshot:
        score -= 50  # Penalización fuerte por screenshot

    return max(0, min(100, score))
```

---

## 3. ARQUITECTURA DE BOTONES

### Diseño del Teclado Principal

```
┌─────────────────────────────────────────────────────────────────┐
│                    TELEGRAM CHAT                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Mensajes del chat...]                                         │
│                                                                  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ 📸 Enviar Foto   │  │ 📊 Mi Estado     │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ 📝 Autoevaluación│  │ 🛒 Pedir Producto│                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ 📍 Mi Ubicación  │  │ ❓ Ayuda         │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
│  [_________ Escribe un mensaje... _________]                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementación de Botones

```python
from telegram import (
    ReplyKeyboardMarkup,
    KeyboardButton,
    WebAppInfo,
    InlineKeyboardMarkup,
    InlineKeyboardButton
)

def get_main_keyboard(user_has_pending: bool = False) -> ReplyKeyboardMarkup:
    """Genera el teclado principal del bot."""

    # Botón de foto con indicador si hay pendientes
    photo_text = "📸 Enviar Foto" + (" 🔴" if user_has_pending else "")

    keyboard = [
        # Fila 1: Acciones principales
        [
            KeyboardButton(photo_text),
            KeyboardButton("📊 Mi Estado")
        ],
        # Fila 2: Web Apps
        [
            KeyboardButton(
                "📝 Autoevaluación",
                web_app=WebAppInfo(url="https://biorem.app/webapp/evaluacion")
            ),
            KeyboardButton(
                "🛒 Pedir Producto",
                web_app=WebAppInfo(url="https://biorem.app/webapp/pedido")
            )
        ],
        # Fila 3: Utilidades
        [
            KeyboardButton("📍 Mi Ubicación", request_location=True),
            KeyboardButton("❓ Ayuda")
        ]
    ]

    return ReplyKeyboardMarkup(
        keyboard,
        resize_keyboard=True,
        one_time_keyboard=False,
        input_field_placeholder="Selecciona una opción o envía una foto"
    )
```

### Flujo de Ubicación antes de Foto

```python
async def handle_photo_request(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cuando el usuario quiere enviar foto, primero pedimos ubicación."""
    user = update.effective_user

    # Verificar si ya tenemos ubicación reciente (últimos 5 minutos)
    recent_location = await get_recent_location(user.id, minutes=5)

    if recent_location:
        # Ya tenemos ubicación, proceder a esperar foto
        await update.message.reply_text(
            "✅ Ubicación registrada. Ahora envía la foto de evidencia.",
            reply_markup=ReplyKeyboardRemove()
        )
        context.user_data['awaiting_photo'] = True
        context.user_data['location'] = recent_location
    else:
        # Pedir ubicación primero
        await update.message.reply_text(
            "📍 Antes de enviar la foto, necesito tu ubicación actual.\n\n"
            "Presiona el botón para compartir tu ubicación:",
            reply_markup=ReplyKeyboardMarkup([
                [KeyboardButton("📍 Compartir Ubicación", request_location=True)],
                [KeyboardButton("❌ Cancelar")]
            ], resize_keyboard=True, one_time_keyboard=True)
        )
        context.user_data['awaiting_location_for_photo'] = True


async def handle_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Procesa ubicación compartida."""
    location = update.message.location
    user = update.effective_user

    # Guardar ubicación
    await save_user_location(
        telegram_id=user.id,
        latitude=location.latitude,
        longitude=location.longitude,
        timestamp=datetime.utcnow()
    )

    if context.user_data.get('awaiting_location_for_photo'):
        context.user_data['awaiting_location_for_photo'] = False
        context.user_data['awaiting_photo'] = True
        context.user_data['location'] = {
            'latitude': location.latitude,
            'longitude': location.longitude,
            'timestamp': datetime.utcnow()
        }

        await update.message.reply_text(
            "✅ Ubicación recibida.\n\n"
            "Ahora envía la foto de evidencia de la aplicación del producto.",
            reply_markup=get_main_keyboard()
        )
```

---

## 4. MINI WEB APP: AUTOEVALUACIÓN

### Estructura del Cuestionario

```typescript
interface EvaluationTemplate {
  id: string
  name: string
  areas: Area[]
  passingScore: number  // Ej: 70%
}

interface Area {
  id: string
  name: string
  weight: number  // Peso en el total (ej: 0.25 = 25%)
  questions: Question[]
}

interface Question {
  id: string
  text: string
  type: 'yes_no' | 'yes_no_na' | 'scale' | 'photo'
  required: boolean
  weight: number  // Peso dentro del área
  requiresPhoto: boolean
  helpText?: string
}

// Ejemplo de template
const bioremEvaluation: EvaluationTemplate = {
  id: "biorem_standard_v1",
  name: "Evaluación Estándar Biorem",
  passingScore: 70,
  areas: [
    {
      id: "cocina",
      name: "Área de Cocina",
      weight: 0.30,  // 30% del total
      questions: [
        {
          id: "cocina_1",
          text: "¿Los drenajes están libres de obstrucciones?",
          type: "yes_no",
          required: true,
          weight: 0.25,
          requiresPhoto: true
        },
        {
          id: "cocina_2",
          text: "¿Se aplicó el producto según las instrucciones?",
          type: "yes_no",
          required: true,
          weight: 0.25,
          requiresPhoto: true
        },
        {
          id: "cocina_3",
          text: "¿El área está libre de malos olores?",
          type: "yes_no",
          required: true,
          weight: 0.25,
          requiresPhoto: false
        },
        {
          id: "cocina_4",
          text: "¿Las trampas de grasa están limpias?",
          type: "yes_no_na",
          required: true,
          weight: 0.25,
          requiresPhoto: true
        }
      ]
    },
    {
      id: "banos",
      name: "Área de Baños",
      weight: 0.25,  // 25% del total
      questions: [
        {
          id: "banos_1",
          text: "¿Los sanitarios drenan correctamente?",
          type: "yes_no",
          required: true,
          weight: 0.33,
          requiresPhoto: false
        },
        {
          id: "banos_2",
          text: "¿Los lavabos drenan sin problemas?",
          type: "yes_no",
          required: true,
          weight: 0.33,
          requiresPhoto: false
        },
        {
          id: "banos_3",
          text: "¿Se aplicó producto en todos los drenajes?",
          type: "yes_no",
          required: true,
          weight: 0.34,
          requiresPhoto: true
        }
      ]
    },
    {
      id: "almacen",
      name: "Área de Almacén",
      weight: 0.20,  // 20% del total
      questions: [
        {
          id: "almacen_1",
          text: "¿El producto está almacenado correctamente?",
          type: "yes_no",
          required: true,
          weight: 0.50,
          requiresPhoto: true
        },
        {
          id: "almacen_2",
          text: "¿Hay suficiente inventario de producto?",
          type: "yes_no",
          required: true,
          weight: 0.50,
          requiresPhoto: false
        }
      ]
    },
    {
      id: "general",
      name: "Condiciones Generales",
      weight: 0.25,  // 25% del total
      questions: [
        {
          id: "general_1",
          text: "¿El personal conoce el procedimiento de aplicación?",
          type: "yes_no",
          required: true,
          weight: 0.33,
          requiresPhoto: false
        },
        {
          id: "general_2",
          text: "¿Se cuenta con el equipo de protección necesario?",
          type: "yes_no",
          required: true,
          weight: 0.33,
          requiresPhoto: true
        },
        {
          id: "general_3",
          text: "¿Se registra la aplicación en bitácora?",
          type: "yes_no_na",
          required: true,
          weight: 0.34,
          requiresPhoto: false
        }
      ]
    }
  ]
}
```

### Cálculo de Ponderación

```typescript
interface EvaluationResult {
  areaScores: Record<string, number>  // Por área
  totalScore: number                   // General
  passed: boolean
  details: QuestionResult[]
}

function calculateScore(answers: Record<string, Answer>, template: EvaluationTemplate): EvaluationResult {
  const areaScores: Record<string, number> = {}
  let totalScore = 0

  for (const area of template.areas) {
    let areaScore = 0
    let applicableWeight = 0

    for (const question of area.questions) {
      const answer = answers[question.id]

      if (answer.value === 'na') {
        // N/A no cuenta en el peso
        continue
      }

      applicableWeight += question.weight

      if (answer.value === 'yes' || answer.value === true) {
        areaScore += question.weight * 100
      }
      // 'no' = 0 puntos
    }

    // Normalizar si hubo N/A
    if (applicableWeight > 0) {
      areaScores[area.id] = Math.round(areaScore / applicableWeight)
    } else {
      areaScores[area.id] = 100  // Todo N/A = pasa
    }

    totalScore += areaScores[area.id] * area.weight
  }

  return {
    areaScores,
    totalScore: Math.round(totalScore),
    passed: totalScore >= template.passingScore,
    details: [] // Llenar con detalles por pregunta
  }
}
```

### Componente de Firma Digital

```typescript
// components/SignaturePad.tsx
import { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'

interface SignaturePadProps {
  onSignatureChange: (signature: string | null) => void
  signerName: string
}

export function SignaturePad({ onSignatureChange, signerName }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  const handleEnd = () => {
    if (sigRef.current) {
      const dataUrl = sigRef.current.toDataURL('image/png')
      onSignatureChange(dataUrl)
      setIsEmpty(sigRef.current.isEmpty())
    }
  }

  const handleClear = () => {
    sigRef.current?.clear()
    onSignatureChange(null)
    setIsEmpty(true)
  }

  return (
    <div className="signature-container">
      <p className="signature-label">
        Firma de: <strong>{signerName}</strong>
      </p>
      <p className="signature-disclaimer">
        Al firmar, confirmo que la información proporcionada es verídica.
      </p>

      <div className="signature-box">
        <SignatureCanvas
          ref={sigRef}
          canvasProps={{
            className: 'signature-canvas',
            width: 350,
            height: 150
          }}
          onEnd={handleEnd}
          penColor="black"
          backgroundColor="white"
        />
      </div>

      <div className="signature-actions">
        <button onClick={handleClear} disabled={isEmpty}>
          Limpiar firma
        </button>
      </div>

      <p className="signature-timestamp">
        Fecha y hora: {new Date().toLocaleString('es-MX')}
      </p>
    </div>
  )
}
```

### Captura de Foto con Cámara Forzada

```typescript
// components/CameraCapture.tsx
import { useRef, useState } from 'react'

interface CameraCaptureProps {
  onPhotoCapture: (photo: PhotoData) => void
  questionId: string
}

interface PhotoData {
  questionId: string
  base64: string
  timestamp: string
  location?: { latitude: number; longitude: number }
}

export function CameraCapture({ onPhotoCapture, questionId }: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null)

  // Capturar ubicación al montar
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation(pos.coords),
      (err) => console.error('Geolocation error:', err),
      { enableHighAccuracy: true }
    )
  }, [])

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Convertir a Base64
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setPreview(base64)

      // Agregar marca de agua con timestamp
      addWatermark(base64, new Date()).then(watermarkedBase64 => {
        onPhotoCapture({
          questionId,
          base64: watermarkedBase64,
          timestamp: new Date().toISOString(),
          location: location ? {
            latitude: location.latitude,
            longitude: location.longitude
          } : undefined
        })
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="camera-capture">
      {preview ? (
        <div className="photo-preview">
          <img src={preview} alt="Captura" />
          <button onClick={() => {
            setPreview(null)
            if (inputRef.current) inputRef.current.value = ''
          }}>
            Tomar otra
          </button>
        </div>
      ) : (
        <label className="capture-button">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"  // FUERZA CÁMARA TRASERA
            onChange={handleCapture}
            style={{ display: 'none' }}
          />
          <span>📸 Tomar Foto</span>
        </label>
      )}
    </div>
  )
}

// Función para agregar marca de agua
async function addWatermark(base64: string, date: Date): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height

      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      // Agregar marca de agua
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.fillRect(10, img.height - 40, 300, 30)

      ctx.fillStyle = 'black'
      ctx.font = '14px Arial'
      ctx.fillText(
        `Biorem - ${date.toLocaleString('es-MX')}`,
        15,
        img.height - 18
      )

      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.src = base64
  })
}
```

---

## 5. MINI WEB APP: PRE-ÓRDENES

### Estructura de Productos

```typescript
interface Product {
  id: number
  name: string
  description: string
  sku: string
  unit: string  // "litro", "galón", "pieza"
  imageUrl?: string
  minQuantity: number
  maxQuantity: number
  requiresApproval: boolean  // Si necesita aprobación de admin
}

interface OrderItem {
  productId: number
  quantity: number
  notes?: string
}

interface ProductOrder {
  id?: number
  locationId: number
  contactId: number
  items: OrderItem[]
  notes: string

  // Firma
  signatureData: string  // Base64 PNG
  signedByName: string
  signedAt: string

  // Ubicación al firmar
  signatureLocation?: {
    latitude: number
    longitude: number
  }

  status: 'pending' | 'approved' | 'rejected' | 'shipped' | 'delivered'
}
```

### Flujo de Pre-Orden

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEB APP: PRE-ORDEN                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PASO 1: Seleccionar Ubicación                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │ 📍 Sucursal Centro                      │ ← Auto-detectada   │
│  │    Av. Principal 123                    │   por Telegram ID  │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  PASO 2: Seleccionar Productos                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │ 🧴 BioClean Pro (5L)                    │                    │
│  │    Limpiador enzimático                 │                    │
│  │    [−]  2  [+]                          │                    │
│  ├─────────────────────────────────────────┤                    │
│  │ 🧪 DrainMaster (1L)                     │                    │
│  │    Destapacaños industrial              │                    │
│  │    [−]  0  [+]                          │                    │
│  ├─────────────────────────────────────────┤                    │
│  │ 🧹 GreaseBuster (5L)                    │                    │
│  │    Desengrasante                        │                    │
│  │    [−]  1  [+]                          │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  PASO 3: Resumen                                                │
│  ┌─────────────────────────────────────────┐                    │
│  │ Tu pedido:                              │                    │
│  │ • 2x BioClean Pro (5L)                  │                    │
│  │ • 1x GreaseBuster (5L)                  │                    │
│  │                                          │                    │
│  │ Notas: [________________________]        │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  PASO 4: Firma de Autorización                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │ Yo, Juan Pérez, autorizo este pedido    │                    │
│  │ para la ubicación Sucursal Centro.      │                    │
│  │                                          │                    │
│  │ ┌─────────────────────────────────────┐ │                    │
│  │ │                                     │ │                    │
│  │ │     [Área de firma digital]         │ │                    │
│  │ │                                     │ │                    │
│  │ └─────────────────────────────────────┘ │                    │
│  │                                          │                    │
│  │ Fecha: 17/01/2026 14:35                 │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  [        📤 CONFIRMAR PEDIDO        ]                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. MODELOS DE BASE DE DATOS

### Nuevos Modelos

```python
# models/evaluation.py
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Text, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime

class EvaluationTemplate(Base):
    """Plantilla de evaluación configurable."""
    __tablename__ = "evaluation_templates"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    areas = Column(JSON, nullable=False)  # Estructura de áreas y preguntas
    passing_score = Column(Float, default=70.0)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)


class SelfEvaluation(Base):
    """Autoevaluación completada."""
    __tablename__ = "self_evaluations"

    id = Column(Integer, primary_key=True)
    template_id = Column(Integer, ForeignKey("evaluation_templates.id"))
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)

    # Respuestas
    answers = Column(JSON, nullable=False)  # {question_id: {value, photo_url, notes}}

    # Ponderaciones calculadas
    area_scores = Column(JSON)  # {area_id: score}
    total_score = Column(Float, nullable=False)
    passed = Column(Boolean, nullable=False)

    # Fotos de evidencia
    photos = Column(JSON)  # [{question_id, url, timestamp, location}]

    # Firma digital
    signature_data = Column(Text)  # Base64 o URL
    signed_by_name = Column(String(100), nullable=False)
    signed_at = Column(DateTime, nullable=False)

    # Geolocalización
    latitude = Column(Float)
    longitude = Column(Float)

    # Metadata
    telegram_user_id = Column(String(50))
    user_agent = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    location = relationship("Location", backref="evaluations")
    contact = relationship("Contact", backref="evaluations")
    template = relationship("EvaluationTemplate")


# models/product_order.py
class ProductOrder(Base):
    """Pre-orden de productos."""
    __tablename__ = "product_orders"

    id = Column(Integer, primary_key=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)

    # Items del pedido
    items = Column(JSON, nullable=False)  # [{product_id, quantity, notes}]
    notes = Column(Text)

    # Estado
    status = Column(String(20), default="pending")
    # pending, approved, rejected, processing, shipped, delivered

    # Firma de autorización
    signature_data = Column(Text)  # Base64
    signed_by_name = Column(String(100), nullable=False)
    signed_at = Column(DateTime, nullable=False)
    signature_latitude = Column(Float)
    signature_longitude = Column(Float)

    # Aprobación
    approved_by_id = Column(Integer, ForeignKey("contacts.id"))
    approved_at = Column(DateTime)
    rejection_reason = Column(Text)

    # Admin notas
    admin_notes = Column(Text)

    # Tracking
    telegram_user_id = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    # Relaciones
    location = relationship("Location", backref="orders")
    contact = relationship("Contact", foreign_keys=[contact_id], backref="orders")
    approved_by = relationship("Contact", foreign_keys=[approved_by_id])
```

### Modificaciones a Modelos Existentes

```python
# models/compliance.py - AGREGAR CAMPOS
class ComplianceRecord(Base):
    # ... campos existentes ...

    # NUEVOS: Score de autenticidad
    authenticity_score = Column(Integer)  # 0-100
    location_verified = Column(Boolean)
    time_verified = Column(Boolean)
    distance_from_expected = Column(Float)  # metros

    # NUEVO: Detectar screenshot
    ai_appears_screenshot = Column(Boolean, default=False)


# models/contact.py - AGREGAR CAMPOS
class Contact(Base):
    # ... campos existentes ...

    # NUEVO: Última ubicación conocida
    last_known_latitude = Column(Float)
    last_known_longitude = Column(Float)
    last_location_at = Column(DateTime)
```

---

## 7. ENDPOINTS DE API

### Evaluaciones

```python
# api/evaluations.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/evaluations", tags=["evaluations"])

@router.get("/templates")
async def list_templates(active_only: bool = True, db: AsyncSession = Depends(get_db)):
    """Lista plantillas de evaluación disponibles."""
    pass

@router.get("/templates/{template_id}")
async def get_template(template_id: int, db: AsyncSession = Depends(get_db)):
    """Obtiene una plantilla específica con todas sus preguntas."""
    pass

@router.post("/")
async def create_evaluation(
    data: EvaluationCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Recibe evaluación completada desde Web App.
    - Calcula scores
    - Guarda fotos
    - Valida firma
    - Notifica a supervisores si no pasa
    """
    pass

@router.get("/")
async def list_evaluations(
    location_id: int = None,
    contact_id: int = None,
    from_date: datetime = None,
    to_date: datetime = None,
    passed: bool = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """Lista evaluaciones con filtros."""
    pass

@router.get("/{evaluation_id}")
async def get_evaluation(evaluation_id: int, db: AsyncSession = Depends(get_db)):
    """Obtiene detalle de una evaluación."""
    pass

@router.get("/{evaluation_id}/pdf")
async def export_evaluation_pdf(evaluation_id: int, db: AsyncSession = Depends(get_db)):
    """Genera PDF de la evaluación con fotos y firma."""
    pass
```

### Pre-Órdenes

```python
# api/orders.py
router = APIRouter(prefix="/orders", tags=["orders"])

@router.post("/")
async def create_order(
    data: OrderCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Recibe pre-orden desde Web App.
    - Valida productos e inventario
    - Guarda firma
    - Notifica a admin para aprobación
    """
    pass

@router.get("/")
async def list_orders(
    location_id: int = None,
    status: str = None,
    from_date: datetime = None,
    to_date: datetime = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """Lista órdenes con filtros."""
    pass

@router.get("/{order_id}")
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    """Obtiene detalle de una orden."""
    pass

@router.patch("/{order_id}/approve")
async def approve_order(
    order_id: int,
    approved_by_id: int,
    notes: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Admin aprueba una orden."""
    pass

@router.patch("/{order_id}/reject")
async def reject_order(
    order_id: int,
    rejected_by_id: int,
    reason: str,
    db: AsyncSession = Depends(get_db)
):
    """Admin rechaza una orden."""
    pass

@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: int,
    status: str,
    notes: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Actualiza estado de orden (shipped, delivered, etc)."""
    pass

@router.get("/{order_id}/pdf")
async def export_order_pdf(order_id: int, db: AsyncSession = Depends(get_db)):
    """Genera PDF de la orden con firma."""
    pass
```

### Web App Data

```python
# api/webapp.py
router = APIRouter(prefix="/webapp", tags=["webapp"])

@router.post("/validate-telegram")
async def validate_telegram_init_data(init_data: str):
    """
    Valida que los datos de Telegram Web App son auténticos.
    Previene falsificación de identidad.
    """
    # Verificar hash HMAC con bot token
    pass

@router.get("/user-context/{telegram_id}")
async def get_user_context(telegram_id: str, db: AsyncSession = Depends(get_db)):
    """
    Obtiene contexto del usuario para Web App:
    - Contacto y cliente asociado
    - Ubicaciones disponibles
    - Productos disponibles
    - Plantillas de evaluación activas
    """
    pass
```

---

## 8. PLAN DE IMPLEMENTACIÓN

### Fases

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLAN DE IMPLEMENTACIÓN                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FASE 0: PREPARACIÓN (1 día)                                    │
│  ├─ Crear tag de respaldo: pre-bot-v2                           │
│  ├─ Documentar estado actual                                    │
│  └─ Configurar ambiente de pruebas                              │
│                                                                  │
│  FASE 1: PHOTO GUARD (2 días)                                   │
│  ├─ Agregar campos de autenticidad a ComplianceRecord           │
│  ├─ Implementar flujo ubicación → foto                          │
│  ├─ Agregar cálculo de authenticity_score                       │
│  ├─ Modificar validación IA para detectar screenshots           │
│  └─ Testing del flujo completo                                  │
│                                                                  │
│  FASE 2: BOTONES INTERACTIVOS (1 día)                           │
│  ├─ Implementar Reply Keyboard principal                        │
│  ├─ Agregar handlers para cada botón                            │
│  ├─ Implementar flujo de ubicación antes de foto                │
│  └─ Testing de interacciones                                    │
│                                                                  │
│  FASE 3: INFRAESTRUCTURA WEB APP (1 día)                        │
│  ├─ Crear ruta /webapp en frontend Next.js                      │
│  ├─ Configurar Telegram Web App SDK                             │
│  ├─ Implementar validación de initData                          │
│  ├─ Crear componentes base (firma, cámara)                      │
│  └─ Configurar CORS y seguridad                                 │
│                                                                  │
│  FASE 4: WEB APP AUTOEVALUACIÓN (3 días)                        │
│  ├─ Crear modelos de DB (templates, evaluations)                │
│  ├─ Crear endpoints de API                                      │
│  ├─ Implementar UI del cuestionario                             │
│  ├─ Implementar captura de fotos con marca de agua              │
│  ├─ Implementar firma digital                                   │
│  ├─ Implementar cálculo de ponderación                          │
│  ├─ Generar PDF de evaluación                                   │
│  └─ Testing completo                                            │
│                                                                  │
│  FASE 5: WEB APP PRE-ÓRDENES (2 días)                           │
│  ├─ Crear modelos de DB (orders)                                │
│  ├─ Crear endpoints de API                                      │
│  ├─ Implementar UI del catálogo                                 │
│  ├─ Implementar firma de autorización                           │
│  ├─ Implementar flujo de aprobación                             │
│  ├─ Generar PDF de orden                                        │
│  └─ Testing completo                                            │
│                                                                  │
│  FASE 6: PORTAL ADMIN (2 días)                                  │
│  ├─ Crear páginas de evaluaciones                               │
│  ├─ Crear páginas de órdenes                                    │
│  ├─ Implementar flujo de aprobación                             │
│  └─ Dashboard con nuevas métricas                               │
│                                                                  │
│  FASE 7: TESTING & DEPLOY (1 día)                               │
│  ├─ Testing end-to-end                                          │
│  ├─ Pruebas con usuarios reales                                 │
│  ├─ Deploy a staging                                            │
│  └─ Deploy a producción                                         │
│                                                                  │
│  TOTAL ESTIMADO: 13 días                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Detalle por Fase

#### FASE 0: Preparación

```bash
# Comandos a ejecutar
cd /Users/robertodavila/biorem-compliance

# Crear tag de respaldo
git tag -a pre-bot-v2 -m "Backup before Bot v2.0 implementation"
git push origin pre-bot-v2

# Verificar estado actual
git status
git log --oneline -5
```

#### FASE 1: Photo Guard

**Archivos a modificar:**
- `backend/app/models/compliance.py` - Agregar campos
- `backend/app/bot/handlers.py` - Flujo ubicación → foto
- `backend/app/services/claude_vision.py` - Detectar screenshots
- `backend/app/api/compliance.py` - Endpoint con score

**Migraciones:**
```python
# alembic/versions/xxx_add_authenticity_fields.py
def upgrade():
    op.add_column('compliance_records', sa.Column('authenticity_score', sa.Integer))
    op.add_column('compliance_records', sa.Column('location_verified', sa.Boolean))
    op.add_column('compliance_records', sa.Column('time_verified', sa.Boolean))
    op.add_column('compliance_records', sa.Column('distance_from_expected', sa.Float))
    op.add_column('compliance_records', sa.Column('ai_appears_screenshot', sa.Boolean))
```

#### FASE 2: Botones

**Archivos a modificar:**
- `backend/app/bot/handlers.py` - Teclado y handlers

**Sin migraciones necesarias.**

#### FASE 3: Infraestructura Web App

**Archivos a crear:**
- `frontend/src/app/webapp/layout.tsx` - Layout sin sidebar
- `frontend/src/app/webapp/page.tsx` - Menú principal
- `frontend/src/lib/telegram.ts` - SDK utilities
- `frontend/src/components/webapp/SignaturePad.tsx`
- `frontend/src/components/webapp/CameraCapture.tsx`

**Backend:**
- `backend/app/api/webapp.py` - Endpoints para Web App

#### FASE 4 & 5: Web Apps

**Detallado en secciones anteriores.**

---

## 9. ANÁLISIS DE RIESGOS

### Matriz de Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Web App no abre en algunos dispositivos | Media | Alto | Testing en múltiples dispositivos, fallback a chat |
| Geolocalización denegada por usuario | Alta | Medio | Mensaje explicativo, permitir continuar sin ubicación |
| Firma digital no válida legalmente | Baja | Bajo | Es para control interno, no legal |
| Migraciones rompen datos existentes | Baja | Alto | Backup antes de migrar, campos nullable |
| Timeout en generación de PDF | Media | Medio | Optimizar tamaño de fotos, paginación |
| Rate limit de Telegram Web App | Baja | Medio | Caché de datos, reducir llamadas |
| Usuario cierra Web App sin guardar | Alta | Medio | Auto-guardado, confirmación de salida |

### Plan de Contingencia

```
SI: Web App falla
ENTONCES: Usuario puede seguir usando chat normal para fotos

SI: Geolocalización no disponible
ENTONCES: Registrar sin ubicación, marcar para revisión manual

SI: Migración falla
ENTONCES: Rollback a tag pre-bot-v2

SI: PDF no genera
ENTONCES: Mostrar datos en HTML, opción de reintentar
```

---

## 10. ROLLBACK Y RECUPERACIÓN

### Comandos de Rollback

```bash
# Rollback completo a versión anterior
git checkout pre-bot-v2
git push origin main --force  # CUIDADO: solo si necesario

# Rollback de migración
cd backend
alembic downgrade -1  # Una migración atrás
alembic downgrade base  # Todas las migraciones

# Restaurar base de datos (si hay backup)
pg_restore -d biorem_db backup_pre_v2.dump
```

### Puntos de Verificación

Después de cada fase, verificar:
1. Bot responde a /start
2. Fotos se reciben correctamente
3. Validación IA funciona
4. Portal admin carga
5. Sin errores en logs

---

## ANEXO: CONFIGURACIÓN TELEGRAM WEB APP

### En @BotFather

```
1. /mybots
2. Seleccionar @BioremComplianceBot
3. Bot Settings > Menu Button
4. Configurar:
   - Text: "🏠 Biorem"
   - URL: https://biorem-compliance-front-end-production.up.railway.app/webapp
```

### Variables de Entorno Nuevas

```bash
# .env
WEBAPP_URL=https://biorem-compliance-front-end-production.up.railway.app/webapp
WEBAPP_SECRET=<hash-del-bot-token>  # Para validar initData
```

---

**Documento preparado por: Consultoría Telegram Bot Expert**
**Fecha: 2026-01-17**
**Versión: 2.0**
