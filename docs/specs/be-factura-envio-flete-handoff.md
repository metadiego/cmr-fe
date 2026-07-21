# Handoff FE — Envío/flete (delivery) en la factura

## Contexto
El BE ya expone la capacidad de **envío/flete**: un monto de cabecera que se **suma al total DESPUÉS del
impuesto** (como el legacy `monto_flete`). Origen: la factura 0010142 de Caguas quedaba $12 corta sin este
campo. **EN PROD** (BE PR #123).

## Lo que el BE entrega (listo)
- Campo `factura.envio` (numeric, default 0) en la cabecera → viene en `GET /facturas/:id` y en la
  proyección de la factura. El **total ya lo incluye** (`total = subtotal − descuento + impuesto + envio`).
- **Fijar el envío:** `PUT /api/v1/facturas/:id/envio` · body `{ "monto": number }` (>= 0) · **solo borrador**
  · permiso `factura.update`. Devuelve la factura con **totales recomputados** (el BE es la autoridad; el FE
  NO recalcula). En factura no-borrador → error (como descuento-global/exento).
- Regla de impuesto = **config por centro** `facturacion.envioGravado` (default false). Por defecto el envío
  NO se grava (va sobre el total ya con IVU). El FE no decide esto; solo captura el monto.

## Qué debe hacer el FE (UI moderna, tokens-only, i18n)
Patrón 2026 shadcn "order summary / checkout": el desglose muestra **Subtotal · Descuento · Impuesto · Envío ·
Total** en el panel de resumen (sticky), con el envío como línea propia + input inline.

1. **`lib/api/facturas.ts`**: helper `setEnvio(facturaId, monto, centroId)` → `PUT /facturas/:id/envio`
   (calca `setDescuentoGlobal`). Sin recomputar en FE: usar los totales que devuelve el BE.
2. **Componente de venta** (`"use client"`): en el bloque de totales, fila **Envío** con input numérico
   (solo borrador; deshabilitado si emitida). Al cambiar (debounced) → `setEnvio` → re-render con totales del BE.
   Solo tokens (`text-muted-foreground`, `border-border`…).
3. **Recibo térmico**: imprimir la línea de envío cuando `envio > 0` (entre Impuesto y Total), con el util de
   moneda existente (no duplicar formateo).
4. **i18n** `messages/{es,en}.json`: `facturacion.envio` = "Envío" / "Shipping" (+ tooltip). Claves en inglés.
5. **RBAC cosmético**: `can('factura.update')` habilita el input; el BE es el que manda.

## Notas
- Nombre del campo: **`envio`** (no `montoFlete`). El legacy MSSQL es `monto_flete`; lo mapea el bridge (BE).
- No mezclar con descuento/impuesto: el envío es una línea aparte que se suma al final.
- Fuentes UI: shadcn order-summary / checkout blocks (buscar el layout más moderno 2026).
