# Mini-handoff BE — POS: `gravado` editable por ítem + descartar borrador

> **De:** cmr-fe. **Para:** cmr-be. **Fecha:** 2026-07-14. **No bloquea** (hay workaround/mitigación).
> Surgió construyendo el POS general (`fe-facturacion-general-pos-handoff.md`). Verificado en vivo contra prod.

## Gap 1 — No se puede cambiar el IVU (`gravado`) de una línea ya agregada
**Requerimiento:** el cajero debe poder **togglear IVU/exento por ítem** (lo pide el handoff del POS §IVU).
**Evidencia (prod 2026-07-14):**
- `POST /facturas/:id/items` **sí** acepta `gravado` (`AgregarItemDto.gravado?`). ✓ (se puede fijar al agregar)
- `PUT /facturas/:id/items/:itemId` con `{gravado:false}` → **400** `"property gravado should not exist"`.
  `UpdateItemDto` **no** incluye `gravado`.
**Contrato propuesto:** agregar `gravado?: boolean` a `UpdateItemDto` (que el PUT lo acepte y recalcule impuesto).
**Pregunta sí/no:** ¿lo agregan? (Mientras tanto el FE togglea vía delete+re-add, que pierde orden/personalización.)

## Gap 2 — No se puede descartar/cancelar un borrador
**Requerimiento:** si el cajero inicia una venta general (`POST /facturas` = borrador) y la abandona, debe poder
**descartarla**; hoy quedan borradores huérfanos.
**Evidencia:** no existe `DELETE /facturas/:id`; `POST /facturas/:id/anular` sobre un borrador → **400**
(anular es solo para emitidas). No hay ruta para descartar un borrador.
**Contrato propuesto:** `DELETE /facturas/:id` (solo estado `borrador`) **o** permitir `anular` en borrador
(estado → `cancelada`). Perm `factura.anular` o similar.
**Pregunta sí/no:** ¿cuál prefieren? (Mitigación FE: crear el borrador lo más tarde posible; los borradores no
emitidos no tocan stock ni contabilidad.)

## Impacto FE mientras tanto
- IVU por ítem: se fija **al agregar**; el toggle post-agregado usa delete+re-add (funcional, no ideal).
- Borrador: el FE crea el borrador solo al confirmar inicio de venta; no ofrece "descartar" hasta que exista la ruta.
