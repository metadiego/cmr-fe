# Handoff FE — La devolución no deja deuda (10-nov-2026)

**Pantalla:** el detalle de la factura (`/billing/invoices/:id`): el panel **Resumen / PAGOS** y el botón
**«Imprimir recibo»**. BE: `cmr-be/docs/specs/la-devolucion-no-deja-deuda.md`.

## Qué pasó

Las dos primeras devoluciones de Caguas (`L006875` → D-000026, `S038158` → D-000025):

- tras devolver todo, la pantalla mostró «Saldo» = el total y el personal volvió a cobrar;
- se imprimió el recibo de la FACTURA, no el de la DEVOLUCIÓN;
- cada papel traía un bloque de totales distinto, y el reembolso salía como un «Care Credit» positivo.

## 1. Imprimir el recibo de la devolución (ya existe en el BE)

`GET /api/v2/invoices/:invoiceId/refunds/:refundId/receipt` (verificado en producción). Campos v2:

- `tipoDocumento`: `'devolucion'`
- `displayNumber`: `D-000026`
- `invoiceNumber`
- `date`, `status`
- `refundedAmount`, `refundedTax`
- `formaReembolso`
- `reason`
- `items[]`, `patient{}`, `empresa{}`, `emisor{}`

Las devoluciones de una factura: `GET /api/v2/invoices/:id/refunds` (`id`, `number`, `refundedAmount`,
`status`, `date`).

Pide:

- si la factura está `devuelta_parcial` o `devuelta_total`, «Imprimir recibo» ofrece el recibo de cada
  devolución activa y **por defecto el de la última**; el de la factura sigue disponible;
- el papel se titula **«DEVOLUCIÓN #D-…»** y lleva:
  - «Factura de origen #…»;
  - las líneas devueltas;
  - el importe reembolsado;
  - la forma de reembolso.

## 2. Bloque de totales: el mismo en pantalla y en papel (nuevo en el BE)

`GET /api/v2/invoices/:id` trae `totals` (los nombres v2 se confirman contra la respuesta real al desplegar):

- `totals.lines[]` `{ key, labelKey, amount }`: siempre estas, en este orden:
  - `subtotal`;
  - `discount` (negativo);
  - `tax`;
  - `shipping`;
  - `total`;
  - `paid`;
  - `refunded` (negativo);
  - `balance`.

  `labelKey` = `invoice.totals.<key>`.
- `totals.moves[]` `{ kind: 'payment'|'refund', labelKey, method, amount, date, refundId }`: el pago en
  positivo y el reembolso en **negativo**, con `invoice.totals.payment` / `invoice.totals.refund`.
- `totals.fullyReturned`: true cuando lo devuelto cubre el total; mostrar «Devuelta» junto al saldo 0.

Pide:

- pintar el Resumen y el pie de **todos** los recibos con `totals.lines` y `totals.moves`, sin calcular nada;
- **no** calcular «Saldo» como total − pagado: el saldo es `balance` (ya resta lo devuelto);
- traducir en es y en las 10 `labelKey` nuevas:
  - `invoice.totals.subtotal` = «Subtotal»;
  - `invoice.totals.discount` = «Descuento»;
  - `invoice.totals.tax` = «Impuesto»;
  - `invoice.totals.shipping` = «Envío»;
  - `invoice.totals.total` = «Total»;
  - `invoice.totals.paid` = «Pagado»;
  - `invoice.totals.refunded` = «Reembolsado»;
  - `invoice.totals.balance` = «Saldo»;
  - `invoice.totals.payment` = «Pago»;
  - `invoice.totals.refund` = «Reembolso».

## 3. Pagar una factura devuelta

El BE ya rechaza un pago que no cabe una vez contado lo devuelto: `400 PAGO_EXCEDE_TOTAL`, con
`labelKey: factura.pago.excede_total` y `max`. En una devuelta del todo, `max` = 0.

Pide: con `balance` = 0, no ofrecer «Agregar pago».
