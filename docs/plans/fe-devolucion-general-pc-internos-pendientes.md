# NOTA ESPECIAL — Devolución (Facturación General): items internos de PC (compuestos) — PENDIENTES

> Estado al 2026-07-18. La devolución general ya funciona en lo básico y en muchos casos de PC, pero
> **quedan casos de los items internos de los productos compuestos sin hacer**. Este doc los deja anotados
> para no perderlos. Antes de construir cada uno: confirmar el detalle con el dueño y verificar el contrato BE.

## ✅ Ya HECHO (en prod)
- Devolución a **pantalla completa** (`/facturacion/:id/devolver`) tipo factura: tabla ancha, panel lateral.
- Devolver **línea completa** o **parte de componentes** de un PC (sub-filas expandibles "▸ Componentes del kit").
- Por línea y por componente: **cantidad a devolver** + **reembolso editable**.
- Componentes editables **solo en facturas EMITIDAS** (traen `facturaItemComponenteId`; en borrador null por diseño).
- Políticas: **como facturada** (reembolso auto-exacto = total línea/cantidad × devuelto) y **precio base**
  (solo productos con flag `aplicaPrecioBaseDevolucion`). Neto en vivo 🟢/🔴. **Tope: nunca supera el total de la factura.**
- Reintegro de **inventario/disponibilidad**: automático del BE al devolver (a_la_venta → revertirVenta; a_la_entrega → sesionesDevueltas).
- **Anular devolución** (deshace todo) desde la lista de Devoluciones. Múltiples devoluciones por factura.
- Candado: solo facturas emitidas/devuelta_parcial.

## ⏳ PENDIENTE — items internos de PC (por hacer / por definir)
Estos casos tocan los componentes internos del compuesto y **aún no están resueltos**. Falta confirmar
alcance con el dueño y contrato BE antes de construir:

1. **Componentes que son SERVICIOS con sesiones/días** (no solo cantidad). Hoy el input del componente es
   por *cantidad*; si un componente interno es un servicio a_la_entrega (ej. "Terapia del dolor 6 sesiones"
   dentro del ULTRA), habría que permitir devolver **sesiones no entregadas** del componente, no unidades.
   → Requiere que el BE exponga, por componente, su modoDescarga + sesiones/disponibles.
2. **PC dentro de PC (anidado)**. Un componente que a su vez es compuesto → devolver un **sub-kit** o sus
   sub-componentes. Hoy el desglose es de un solo nivel. → Definir profundidad y contrato.
3. **Precio base a nivel de COMPONENTE variable** (láser/vit C/GLP-1 dentro del PC). La política precio_base
   hoy razona a nivel de producto/línea; falta valorar **cada componente consumido a su precio base** y que
   el neto lo refleje (puede ser negativo → el paciente debe). → Confirmar cómo el BE calcula el componente
   bajo precio_base y si el FE debe mostrar el base por componente.
4. **Opcionales incluidos/excluidos dentro del PC en la devolución**. Un kit vendido con opcionales
   (`precioIncremental`) → al devolver, distinguir qué opcionales se incluyeron y su reembolso. Hoy la
   devolución no cruza con `opcionalesIncluidos`. → Definir.
5. **Recalcular el precio del PC al quitar un componente** (no solo registrar el reembolso). Según cómo se
   pactó/promoción, quitar un componente puede recomputar el valor del kit. → Regla de negocio del BE;
   el FE solo mostraría el resultado.
6. **Casos por PROMOCIÓN / cómo fue vendido**. El dueño mencionó que el reembolso depende de la promoción y
   de cómo se vendió el paquete. → Falta el criterio (¿el BE lo deriva del snapshot? ¿flags?).
7. **Backfill de emitidas viejas** (antes de #106) para habilitar sus componentes — el BE confirmó que las
   emitidas nuevas ya vienen pobladas; las viejas quedarían editables si el BE corre `backfill:fic`.

## Regla de trabajo (ver [[no-romper-otros-dominios]])
- No tocar lo que ya funciona al construir estos casos; verificar el flujo completo de devolución después
  de cada cambio (línea completa, parcial, componente, precio base, anular).
- Cada caso arriba: confirmar detalle con el dueño + contrato BE ANTES de codear.
