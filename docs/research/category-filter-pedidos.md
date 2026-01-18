# Research: Filtro por Categorías en Pedidos de Telegram

**Fecha:** 2026-01-18
**Estado:** Implementado (Tabs Fijos)
**Decisión:** Opción B - Tabs Fijos

---

## Contexto

El catálogo de productos Biorem tiene 3 categorías:
- **Ecológico** (5 productos)
- **Químico** (10 productos)
- **Biotecnológico** (2 productos)

Se requería agregar filtrado por categoría en la WebApp de pedidos de Telegram.

---

## Opciones Evaluadas

### Opción A: Pills Horizontales (Scroll)

```
┌─────────────────────────────────────────────────┐
│  [Todos] [Ecológico] [Químico] [Biotecnológico] │
│  ───────────────────────────────────────►scroll │
└─────────────────────────────────────────────────┘
```

**Pros:**
- Patrón familiar en apps de e-commerce (Mercado Libre, Rappi)
- Escalable a muchas categorías
- No ocupa espacio vertical fijo

**Contras:**
- Requiere scroll para ver todas las opciones
- Menos visible que tabs

**Mejor para:** 5+ categorías

---

### Opción B: Tabs Fijos (SELECCIONADA)

```
┌─────────────────────────────────────────────────┐
│  Todos  │ Ecológico │ Químico │ Biotec.         │
│  ═══════                                        │
└─────────────────────────────────────────────────┘
```

**Pros:**
- Todas las opciones visibles sin scroll
- Navegación clara y directa
- Patrón común en apps móviles

**Contras:**
- Espacio limitado si hay muchas categorías
- Texto puede truncarse en pantallas pequeñas

**Mejor para:** 2-4 categorías

---

### Opción C: Secciones Colapsables (Acordeón)

```
┌─────────────────────────────────────────────────┐
│ ▼ Ecológico (5 productos)                       │
│   [productos...]                                │
│ ► Químico (10 productos)                        │
│ ► Biotecnológico (2 productos)                  │
└─────────────────────────────────────────────────┘
```

**Pros:**
- Agrupa visualmente por categoría
- Muestra conteo de productos
- Permite ver múltiples categorías expandidas

**Contras:**
- Más complejo de navegar
- Requiere más interacciones (expandir/colapsar)
- Más código para implementar

**Mejor para:** Cuando el usuario necesita comparar categorías

---

## Decisión

**Opción B (Tabs Fijos)** porque:
1. Solo hay 3 categorías - caben perfectamente
2. Navegación más directa
3. Implementación más simple
4. Funciona bien en Telegram WebApp

---

## Implementación

**Archivo modificado:** `frontend/src/app/webapp/pedido/page.tsx`

**Cambios:**
1. Agregar estado `selectedCategory: string | null`
2. Agregar componente de tabs debajo del header
3. Filtrar productos según categoría seleccionada
4. Mostrar contador de productos filtrados

**Categorías disponibles:**
```typescript
const CATEGORIES = [
  { id: null, label: "Todos" },
  { id: "Ecológico", label: "Ecológico" },
  { id: "Químico", label: "Químico" },
  { id: "Biotecnológico", label: "Biotec." },
];
```

---

## Migración Futura

Si en el futuro se agregan más categorías (5+), considerar migrar a **Opción A (Pills Horizontales)** con los siguientes cambios:

```tsx
// Cambiar de tabs fijos a scroll horizontal
<div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
  {categories.map((cat) => (
    <Badge
      key={cat.id}
      variant={selectedCategory === cat.id ? "default" : "outline"}
      className="cursor-pointer whitespace-nowrap flex-shrink-0"
      onClick={() => setSelectedCategory(cat.id)}
    >
      {cat.label}
    </Badge>
  ))}
</div>
```

---

## Referencias

- Archivo: `frontend/src/app/webapp/pedido/page.tsx`
- API categorías: `GET /api/products/categories`
- Commit: (pendiente)
