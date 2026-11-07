# Handoff FE → BE — Certificación de gastos: detalle por LÍNEA dentro de cada rubro

**Contexto:** con el arreglo de redondeo (PR #495) la Certificación de gastos ya cuadra, pero el dueño
señaló un hueco aparte: cuando un rubro sale `sin_clasificar`, hoy solo se ve un TOTAL y un CONTEO de
facturas. No hay forma de saber QUÉ compró el paciente dentro de ese monto sin ir a abrir cada factura
una por una.

Caso verificado ahora mismo por curl, PAMELA LUQUIS CAMACHO (record 82289, Caguas, id
`a2e23db5-7541-45bb-8136-c37907e67f46`), rango 2025-01-01 a 2026-12-31: `sin_clasificar` → 8 facturas,
$311.40; `bpc` → 1 factura, $250.00.

## Lo que el FE puede hacer hoy (verificado)

`GET /invoices/expenses-certificate` (`lib/api/facturas.ts:241-248`, `CertificacionConcepto`) devuelve
por rubro: `grupoId`, `slug`, `labelKey`, `total`, `refunds`, `invoices` (un NÚMERO, el conteo) — nada
que identifique cuáles facturas ni qué líneas/productos son. El FE no puede armar ese detalle por su
cuenta: no existe hoy un campo en la línea de factura que exponga su `billingGroupId`/grupo de
facturación (sí existe el catálogo de grupos — `lib/api/grupos-facturacion.ts` — pero las LÍNEAS de
`GET /invoices` no cargan su grupo).

## Lo que se pide

Para cada `CertificacionConcepto`, agregar el detalle de las facturas/líneas que lo componen — al
menos:
- número de factura, fecha, monto de esa factura dentro del rubro;
- idealmente también la(s) línea(s)/producto(s) específicos sin grupo asignado dentro de esa factura
  (para poder corregir el catálogo, no solo saber el monto).

No hace falta un endpoint nuevo necesariamente: puede ir como un array `invoiceIds`/`items` dentro de
cada `CertificacionConcepto`, o un parámetro `detalle=true` en el mismo endpoint.

## Por qué importa

`sin_clasificar` no es solo un bache de reporte: significa que hay productos/servicios en el catálogo
sin grupo de facturación asignado. Sin el detalle, nadie puede ir a corregir el catálogo — solo se ve
el síntoma agregado.

## Cómo verificar al terminar

`GET /invoices/expenses-certificate?patientId=a2e23db5-7541-45bb-8136-c37907e67f46&desde=2025-01-01&hasta=2026-12-31`
→ el concepto `sin_clasificar` debe traer, además de `total`/`invoices`, el detalle de esas 5 facturas
(número + fecha + monto, mínimo).
