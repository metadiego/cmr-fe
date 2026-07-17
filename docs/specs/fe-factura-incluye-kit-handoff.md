# Handoff FE — Imprimir "Incluye:" de un kit (compuesto)

**BE listo (PR #96/#99, prod).** Sin nuevos endpoints.

> **⚠ FIX PRIORITARIO (2026-07-17):** el recibo muestra precio solo en algunos componentes porque los
> toma del **catálogo** (solo precios por-centro). El BE ya manda el precio de **TODOS** en
> `contenido[].precio` (resuelto con cascada centro→global→base). Cambio: pintar `c.precio` tal cual,
> NO mapear del catálogo. Verificado en prod: el ULTRA devuelve los 10 con precio.

## Dato (en `GET /facturas/:id`, por ítem)
Cada línea que es un **kit compuesto con `imprimeComponentes=true`** trae:
```jsonc
"contenido": [
  { "productoId": "…", "sku": "CMALA01", "nombre": "NPT Stem Cells", "cantidad": 1, "precio": 10000 },
  { "productoId": "…", "sku": "vitacintra", "nombre": "VITAMINA C INTRAVENOSA", "cantidad": 3, "precio": 140 },
  … (10 para el ULTRA)
]
```
- Disponible en **borrador/presupuesto Y emitida** (no hay que emitir para imprimir el "Incluye:").
- `cantidad` = receta × cantidad de la línea.
- Kit **compacto** (`imprimeComponentes=false`, p.ej. INFILTRA01) → `contenido: []` (no se detalla).

## Qué pintar
Bajo la línea del kit, un bloque **"Incluye:"** con cada componente **indentado a la derecha y en
fuente menor** (ya validado en el preview): `cantidad · nombre · precio`.
- **`precio` viene en `contenido`** (resuelto por el BE con fallback a precio global) — pintar `precio`
  tal cual; si es `null`, no mostrar monto. NO hace falta mapear del catálogo.
- Los precios del "Incluye:" son **referencia** (NO suman al total; el total lo fija el precio del kit).

## Aceptación
- Un kit con `imprimeComponentes=true` imprime su "Incluye:" en el presupuesto (borrador), indentado + fuente menor.
- Un kit compacto no lo imprime.
- El total no cambia por los componentes.
