# Respuesta BE — Cierre de devoluciones (4 puntos del FE)

## 1) Formas de reembolso / Cheque ✅
- **Cheque sembrado en PROD** (`formas_pago`: clave `cheque`, `esEfectivo=false`, activo). Ya sale en el selector.
- **El reembolso usa el MISMO catálogo que las formas de pago** (`formas_pago`). `devolver` acepta
  `formaReembolsoId` (un `formas_pago.id`), que **puede diferir** del de la venta (pagó tarjeta → reembolsa
  cheque). No hay catálogo aparte; si mañana se quiere restringir cuáles aplican a reembolso, se agrega un
  flag `aplicaReembolso` a `formas_pago` (avisar). CRUD: `POST /facturacion/formas-pago`.

## 2) Anular devolución = revertir TODO ✅ (confirmado en código + tests)
`POST /facturas/:id/devoluciones/:devId/anular` revierte por completo: re-descarga el inventario reintegrado
(a_la_venta → `operaciones.vender`), regresa `sesionesDevueltas`/`cantidadDevuelta` a lo previo (reabre el
paquete devuelto→activo), **anula el reembolso** en el ledger de pagos, y **recomputa el estado de la
factura → `emitida`** (o devuelta_parcial/total según lo que reste). La devolución queda `anulada` (append-only).
Idéntico a antes de la devolución.

## 3) Doble-IVU + TOPE ✅ (FIX #111, en prod)
- **Causa:** el FE manda `precioDevuelto` BRUTO (total con IVU); el BE lo trataba como neto y **re-sumaba el
  impuesto** → doble IVU ($10,603.29 → $10,691.02, +$87.73). **Corregido:** `monto` es bruto consistente;
  `montoDevuelto = Σ monto` sin re-sumar. "Como facturada" completo = **exacto al total** (con descuento e impuesto).
- **TOPE (enforcement BE):** pre-check antes de aplicar nada → `ya_devuelto + pedido` NUNCA excede
  `factura.total`; si excede → **400 `DEVOLUCION_EXCEDE_TOTAL`**. (El FE ya bloquea; esto es el candado del BE.)

## 4) Items internos de PC — qué hace el BE hoy y qué necesita tu decisión
- **Precio base por COMPONENTE** ✅ ya posible SIN cambio BE: el FE resuelve el base de cada componente con
  `GET /facturas/precio-base?productoId=<componenteId>` y lo manda como `precioDevuelto` del componente.
- **Opcionales** ✅ ya respetados: el snapshot/`contenido[]` sólo trae los componentes INCLUIDOS
  (`opcionalesIncluidos`); su reembolso se edita con `precioDevuelto`.
- **PENDIENTES (requieren tu criterio de negocio, luego contrato BE):**
  - Componentes que son SERVICIOS con **sesiones/días** (devolver sesiones no entregadas del componente):
    hoy la disponibilidad (`paquetes_sesiones`) es por LÍNEA (facturaItem), no por componente → devolver
    sesiones a nivel de componente exige un modelo de paquete por-componente (arco nuevo). Definir si se necesita.
  - **PC anidado** (componente que es compuesto): `contenido[]` es de 1 nivel. Definir profundidad.
  - **Reprecio del kit al quitar un componente** (según promoción/cómo se vendió): regla de negocio a definir;
    hoy el reembolso del componente = su `precioDevuelto` (no recomputa el kit). El BE tiene el snapshot
    (`factura_item_componentes` + precio de línea + `opcionalesIncluidos`) para derivarlo cuando definas la regla.
  - **Backfill emitidas viejas**: 0 afectadas (todas las emitidas ya traen `facturaItemComponenteId`); tool
    `backfill:fic` disponible por si acaso.
