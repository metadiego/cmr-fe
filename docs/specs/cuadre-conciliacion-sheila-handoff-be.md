# Cuadre de caja: lo que contabilidad necesita para conciliar (handoff FE → BE)

**Fecha:** 11-nov-2026 · **Pedido por:** Sheila (contabilidad), con el cuadre de Caguas del 10-nov. El
dueño lo marcó urgente.

Leído en producción (solo lectura) de `GET /api/v2/cash/reports/day?date=2026-11-10`, Caguas, consolidado.

## 1. Recuadro del conteo — lo hace el FE (ya en producción)

$140 contado = $50 de fondo inicial + $90 de ventas en efectivo. El recuadro del conteo muestra ahora las
tres líneas: total contado, fondo inicial y ventas en efectivo (a depositar). No hace falta nada del BE.

## 2. Bloque tributario: «exento» con descuento — PIDE BE

Hoy llega `tributario.exempt = { amount: 5402, discount: 840, base: 5402 }`:

- `amount` y `base` son iguales.
- El descuento de 840 no deja claro si los 5402 son antes o después del descuento.

Hay una segunda incoherencia: `tributario.taxable.discount = 0`, pero
`productSales.taxable.discount = 277.44` para las mismas 6 líneas.

**Pide:** en cada partida (`taxable`, `exempt`, `exonerado`):

- `gross`: el importe **antes** del descuento;
- `discount`: el descuento aplicado;
- `base`: neto **después** del descuento y antes del impuesto;
- `tax`: el impuesto;
- `amount`: base + impuesto.

Con eso, gross − discount = base, sin que el FE tenga que deducirlo. Y que `taxable.discount` cuadre
con `productSales`.

## 3. Detalle de devoluciones — PIDE BE

Hoy llega `devolucionesDetalle[] = { id, number, invoiceId, refundedAmount, reason }`. Con eso no se
sabe:

- a qué factura corresponde cada devolución;
- con qué forma se reembolsó, por ejemplo Care Credit.

**Pide añadir en cada fila:**

- `displayNumber` (`D-000026`);
- `invoiceNumber` (factura de origen, `L006875`);
- `patient`, `medicalRecordNumber`;
- `refundMethod` (nombre de la forma, «Care Credit») y `refundMethodSlug` (`care_credit`);
- `refundedTax`;
- `date`.

## 4. Resumen general por forma de pago, con las devoluciones aparte — PIDE BE

Hoy `byMethod.care_credit = -6960` y `detalle.tarjetas[care_credit].amount = -6960`: la devolución va
restada dentro de la forma de pago, así que no se ve lo cobrado ni lo devuelto. `porGrupo.tarjetas =
-789.29` mezcla Visa, ATH y la devolución de Care Credit.

**Pide**, por forma de pago (en `detalle.efectivo`, `detalle.tarjetas[]` y `detalle.otros[]`):

- `sales`: lo cobrado ese día;
- `refunds`: lo devuelto por esa forma (positivo, para mostrarlo en negativo);
- `amount`: el neto. Se queda como hoy, para no romper nada.

Totales del día:

- `totalTarjetasVentas`: tarjetas sin devoluciones, para cotejar con los settlements;
- `refundsByMethod[]`: `{ slug, name, amount }`.

Con esto el FE pinta:

- efectivo, tarjetas (para los settlements) y Care Credit por separado;
- las devoluciones por forma;
- el camino ventas → devoluciones → neto, cuadrando con el depósito y con cada settlement.

## Verificación

Caguas, 10-nov:

- las devoluciones salen como D-000025 (S038158, Care Credit, $600) y D-000026 (L006875, Care Credit,
  $6,360). Total $6,960; Sheila escribió $6,690 por error;
- `care_credit` sale como `sales` 0, `refunds` 6960 y `amount` −6960;
- el exento sale con `gross`, `discount` 840 y `base`. Si los 5402 ya son el neto, `gross` es 6242;
  eso es un **supuesto**: lo confirma el BE.
