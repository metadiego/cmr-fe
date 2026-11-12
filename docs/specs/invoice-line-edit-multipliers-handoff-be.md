# Handoff BE — editar Áreas / Días de una línea ya agregada (HILT, MLS, PEMF…)

Fecha: 2026-11-12 · Origen: dueño (reporte de recepción) · FE: cmr-fe

## Problema

En facturación general, una línea con multiplicadores (`meta.multiplicadores`, p. ej. `areas` × `dias`)
no se puede corregir después de agregada: Cantidad muestra la efectiva (48 = 12 días × 4 áreas) y es de
solo lectura. Recepción tiene que **borrar la línea y volver a agregarla**.

## Verificado

- `UpdateItemDto` (cmr-be `origin/main` f0a4ba25, `src/modules/facturacion/dto/factura.dto.ts`) acepta
  `descripcion, cantidad, sesiones, precioUnitario, descuento*, gravado, impuestoId`. **No acepta `meta`.**
- Las sesiones/paquetes del paciente se derivan de áreas × días (`cantidad-efectiva.ts`,
  `reparar-sesiones-infladas-por-areas.ts`), así que el recálculo es del BE, no del FE.

## Por qué no lo hacemos en el FE (borrar + re-agregar)

No es atómico: si el POST falla después del DELETE, la línea se pierde; además cambia el orden de las
líneas y no deja rastro en el registro de cambios.

## Pedido

`PUT /api/v2/invoices/:id/items/:itemId` acepta `meta` (mismas claves que el POST de items, p. ej.
`{ "meta": { "areas": 4, "dias": 12 } }`) **solo en borrador**:

1. Recalcula `meta.multiplicadores`, cantidad efectiva, total, impuestos y totales de cabecera.
2. Re-deriva las sesiones / descarga como si la línea se hubiera agregado así (sin duplicar).
3. Valida igual que el POST (enteros ≥ 1; columnas `required`); errores con `messageKey`.
4. Mantiene el id y la posición de la línea; registra el cambio en el change-log (antes → después).
5. Swagger + MCP actualizados; tests.

## FE (cuando el BE lo publique)

En la fila de la línea (borrador), Áreas y Días pasan a ser campos editables inline; al salir del campo
se manda el PUT con `meta`. Cantidad efectiva sigue siendo de solo lectura y el total sale del BE.
