# Cuadre de caja: sección de VENTA DE PRODUCTOS con su IVU + reporte de exonerados — handoff FE → BE

**Fecha:** 2026-11-05.
**Pedido por:** Contabilidad (Sheila González) y el dueño. **Va en:** Cuadre de caja *general* y
*Cuadre total (único)*.

## La solicitud de Contabilidad (textual, resumida)

> El nuevo sistema debe permitir obtener un cuadre o reporte de **ventas de productos separado de
> las ventas de servicios**, aunque la facturación sea integrada. Con eso se prepara la planilla de
> IVU. Debe identificar:
>
> 1. el total de ventas **tributables**;
> 2. el total de ventas **exentas**;
> 3. el **IVU cobrado**, desglosado en **estatal** y **municipal**;
> 4. las **devoluciones o ajustes** de esas ventas.
>
> Se mantiene el cuadre general consolidado, siempre que este detalle se pueda conciliar con el
> **total de ventas del día**.

## La regla del dueño

- **Producto = `Prod_serv = 'p'`** del legado (`select * from MInventario where activo=1 and
  Prod_serv='p'`). Todos llevan IVU de PR, **estatal + municipal**.
  - En el catálogo nuevo, `mapTipo` convierte `'p'` en `tipo='unico'`, pero `unico` es también el
    caso por defecto de otras letras.
  - **Hay que decidir el criterio exacto en el BE:** ¿`tipo='unico'`, `taxable` del producto
    (`legacyAplicaIva`) o una marca explícita «producto»? Sin hardcode en el FE.
- Las facturas de productos se siguen mostrando como hoy, **más** una sección propia con la mayor
  información y claridad.
- Muchas veces a esos productos **se les exonera el impuesto**. Deben verse también, como
  exonerados.
- **Fin de mes:** reporte de facturas que **debían llevar impuesto y se les exoneró**. Referencia
  del legado CMA: `cma/vistas/reportes/repventasnoivu.php`.
  - Filtra un rango de fechas, factura no anulada (`statfact<>'2'`) y `TotImpuesto=0`.
  - Columnas: Factura, Fecha, Paciente, Subtotal, Descuento, Envío, Total, Estatus, M. Pago.
  - Lleva totales.
  - En CMR, además, solo las facturas con **productos**.

## Lo que hay hoy (verificado)

- El reporte del día (`/cash/reports/day`) trae `tributario { taxable, exempt, exonerado,
  facturasExoneradas }`.
- Ese bloque cubre **todas** las líneas, productos y servicios. El impuesto viene en un **solo
  número** (`tax`), sin estatal ni municipal.
- El desglose por componente ya existe en otros lados: `desglosarImpuestos` (devoluciones) y
  `facturas-reportes.desglosePorImpuesto(desde, hasta)`.

## Lo que se pide

### 1. Bloque `productSales` en el reporte del día

Va en el reporte del día del cuadre general y del cuadre total (y en lo que use `Cuadre total`),
acotado igual que el cuadre: fecha, división y cajero.

```
productSales: {
  taxable:   { amount, discount, base, lines },          // productos con IVU cobrado
  exempt:    { amount, discount, base, lines },          // productos exentos por naturaleza (si existen)
  exonerated:{ amount, discount, base, lines, taxWouldBe? }, // debían llevar IVU y se exoneró
  tax:       { state, municipal, total },                // IVU COBRADO, por componente
  refunds:   { amount, base, tax: { state, municipal, total }, documents },   // devoluciones/ajustes de productos
  net:       number,                                     // ventas de productos netas
  invoices:  [{ id, number, patient, medicalRecordNumber, base, discount, state, municipal, total,
               exonerated: boolean, status, paymentMethods }],
  check: { productsPlusServices, dayTotal, squares, gap } // conciliación con el total de ventas del día
}
```

### 2. Reporte por rango de facturas exoneradas (fin de mes)

`GET /…/reports/tax-exempted-products?from&to[&centerIds]` → filas como el CMA (Factura, Fecha,
Paciente, Subtotal, Descuento, Envío si aplica, Total, Estatus, Método de pago) + el **IVU que debía
cobrarse** (estatal / municipal) + totales.
- RBAC de contabilidad o caja.
- Con MCP equivalente.
- Comentarios en la base de datos y en Swagger tipado (DTO real, no `{}`).

### 3. Typing

Todo con DTOs en OpenAPI, para que el FE use `components["schemas"]` y tsc detecte la deriva.

## FE (cuando esté)

- **Cuadre general y Cuadre total:** sección «Venta de productos (IVU)» con los totales de arriba,
  la tabla de facturas y la conciliación (`check.squares`).
- **Hoja impresa:** la misma sección en el papel del cuadre.
- **Reportes:** página «Productos exonerados de IVU» por rango, imprimible y exportable.
