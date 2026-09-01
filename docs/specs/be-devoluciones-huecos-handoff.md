# Handoff BE — 2 huecos para cerrar Devoluciones (FE ya construyó el resto)

El FE terminó lista + acciones + modal enriquecido (política, precio editable, sesiones, neto verde/rojo,
guía de timing). Verificado E2E en prod. Faltan 2 datos/endpoints del BE para cerrar al 100%:

## 1. Email de factura (acción ✉ de la imagen 4)
NO existe endpoint para enviar la factura por email. `POST /comunicaciones/notificaciones/enviar` es
genérico (no adjunta la factura). El FE dejó la acción fuera para no poner un botón que no hace nada.
**Pedido:** definir `POST /api/v1/facturas/:id/email { destinatario?, ... }` (o el flujo exacto: ¿adjunta
PDF del recibo? ¿manda link?). En cuanto exista, el FE agrega el ítem "Email" al menú de la factura.

## 2. Devolución POR COMPONENTE de kit — falta `facturaItemComponenteId`
`DevolverComponenteDto` requiere `facturaItemComponenteId`, pero la proyección de `GET /facturas/:id`
**no lo expone**: `item.contenido[]` trae `{ productoId, sku, nombre, cantidad, precio, nota }` — sin el id
del componente de la línea. Sin ese id el FE no puede construir la selección de componentes a devolver.
**Pedido:** incluir `facturaItemComponenteId` en cada `item.contenido[]` (o un `item.componentes[]` con
`{ facturaItemComponenteId, nombre, cantidad, precio }`). Con eso el FE agrega la sub-tabla de componentes
en el modal (precio por componente editable, ya soportado en `DevolverDto.items[].componentes[]`).

## Nota (no bloqueante, confirmado en prod)
Al devolver **1 de 2** unidades el BE marca la devolución como `tipo: "total"` (no "parcial"), aunque
respeta el monto (`precioDevuelto:55 → montoDevuelto:55`). Confirmar si el `tipo` parcial/total se calcula
por cantidad devuelta vs total de la línea/factura, o si es intencional en el slice actual.
