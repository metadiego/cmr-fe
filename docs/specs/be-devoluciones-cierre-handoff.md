# Handoff BE — Cierre de Devoluciones (lo que necesita el FE)

El FE ya tiene: lista + acciones ⋯, pantalla completa, "como facturada" pre-llenado exacto (= total factura,
con IVU), precio base (flag), tope al total, componentes de PC, email, anular devolución, resumen de factura
en la cabecera. Pendiente del BE:

## 1. Métodos de reembolso — sembrar "Cheque" (y confirmar el set) en PROD
El catálogo de formas de pago (`GET /facturacion/formas-pago`) **no trae "Cheque"**, que en el legacy es un
método común de **reembolso**. Hay CRUD (`POST /facturacion/formas-pago`), así que es dato.
- **Pedido:** sembrar en PROD (y confirmar en todos los centros) `Cheque` (`clave:cheque`, `esEfectivo:false`)
  y cualquier otro método de reembolso del legacy que falte. (En LOCAL ya lo agregué por API para probar.)
- **Confirmar:** ¿el **reembolso** debe usar el MISMO catálogo que las formas de **pago**, o debe ser un
  concepto/flag aparte ("es método de reembolso")? El dueño dice que el modo de reembolso NO siempre es igual
  al de la venta (ej. pagó con tarjeta, se reembolsa con cheque) — hoy el FE ya lo deja elegir libre, pero si
  quieren separar catálogos, definirlo.

## 2. Anular devolución = revertir TODO al estado original (confirmar)
El dueño enfatiza: anular una devolución debe **dejar todo intacto como antes** de la devolución —
inventario reintegrado se vuelve a descontar, `cantidadDevuelta`/`sesionesDevueltas` regresan a lo previo,
y el estado de la factura vuelve (devuelta_parcial/total → emitida). **Confirmar que `POST
/facturas/:id/devoluciones/:devId/anular` ya hace la reversión COMPLETA** (no solo marca la devolución anulada).

## 3. Tope: `montoDevuelto` NUNCA debe superar el total de la factura (enforcement BE)
Vi en LOCAL una devolución con `montoDevuelto = $10,691.02` sobre una factura de **total $10,603.29**
(se pasó **$87.73** = el IVU). El FE ya **bloquea** confirmar si el neto supera el total, pero el **BE debe
enforzarlo** (el FE es cosmético). **Revisar** por qué esa devolución quedó por encima (¿el cálculo del monto
sumó IVU dos veces, o valoró sobre subtotal+impuesto+algo?). El neto "como facturada" completo debe ser
EXACTO al total (con su descuento e impuesto), ni un centavo más.

## 4. Casos de items internos de PC (compuestos) — definir contrato
Ver `docs/plans/fe-devolucion-general-pc-internos-pendientes.md`. Faltan: componentes que son **servicios con
sesiones/días** (no solo cantidad), **PC anidado** (kit dentro de kit), **precio base por componente**
variable, **opcionales** incluidos/excluidos en la devolución, **recálculo del precio del kit** al quitar un
componente según la **promoción/cómo se vendió**. Para cada uno: definir cómo lo calcula/expone el BE.

## Ya cerrado por BE (referencia, no tocar)
`facturaItemComponenteId` poblado en emitidas (#106), `aplicaPrecioBaseDevolucion` + precio-base (#107),
reintegro de inventario en devolver (#107), email de factura (#106), politica-devolucion/timing.
