# Pagos: tope al total y corrección en borrador — handoff BE

Reporte del dueño (17-sep-2026), sobre la asignación de pagos (visto en facturación de consulta
`#84687`, borrador; se asume igual en facturación general porque comparten componente):

1. El pago debe poder **dividirse** en varias formas de pago (split).
2. Debe poder **eliminarse** un pago si el usuario se equivocó al aplicarlo.
3. El pago **NO debe exceder el monto de la factura** (caso real: total pequeño, `Abonado $15.00` =
   Exonerada $10 + Efectivo $5, y sin poder borrarlo).

## Verificado en el código del BE (no supuesto)

- `POST :id/pagos` (`registrarPago`) — **sin `@Permissions`**: cualquiera que factura puede abonar.
  `facturacion.controller.ts:801`.
- `pagos.service.ts:218` valida `dto.monto <= 0` pero **no** valida `monto > saldo`: el servidor
  acepta sobre-pagar. Ahí está el `$15`.
- `POST :id/pagos/multiple` (`registrarMultiple`) **ya existe y no pide permiso** —
  `facturacion.controller.ts:811`. Es el split nativo.
- `DELETE :id/pagos/:pagoId` y `PUT :id/pagos/:pagoId` exigen **`@Permissions('factura.pago.anular')`
  en TODOS los estados**, borrador incluido — `facturacion.controller.ts:835-848`. Un facturador sin
  ese permiso (p. ej. Berkaira) no puede corregir ni borrar un pago de su propio borrador.

## Lo que ya hizo el FE (desplegado)

- **Tope en la UI** (barrera, no autoridad): al agregar/editar un pago tipo `pago` no se deja pasar de
  `total − abonado` (al editar se libera el importe actual del propio pago). Lógica pura y testeada en
  `lib/facturacion/tope-pago.ts` (+ `tope-pago.test.ts`). El botón «Agregar pago» se oculta con la
  factura ya saldada.
- **Split**: se documenta en la UI (una pista) que para cobrar en varias formas se agrega un pago por
  cada una; cada uno se topa al saldo restante. Los reembolsos (`type=reembolso`) **no** pasan por el
  tope (tienen su propia regla).

## Pedidos al BE (competencia BE — el FE está detenido aquí)

1. **Tope autoritativo (dinero → la autoridad es el servidor).** Rechazar en `POST /pagos`,
   `POST /pagos/multiple` y `PUT /pagos/:id` cualquier abono que haga `montoAbonado > total` (con
   holgura de centavos). Devolver un `labelKey` de error (p. ej. `factura.pago.excede_total`, con el
   `max` como parámetro) para que el FE lo muestre traducido. El FE ya topa en la UI, pero eso se puede
   saltar; el servidor debe ser la barrera real.

2. **Corregir un pago en BORRADOR sin `factura.pago.anular`.** Permitir `DELETE` y `PUT` de un pago
   cuando `factura.estado === 'borrador'` con el **mismo gate que `POST /pagos`** (que hoy no pide
   permiso), manteniendo `factura.pago.anular` para `emitida`/`devuelta_*` (ahí sí es anulación
   auditable). Alternativa si se prefiere permiso explícito: `factura.pago.borrador`. **Decidir y
   avisar** cuál, para que el FE des-gatee el botón solo en borrador.

3. **Confirmar el contrato de `POST /pagos/multiple`** (split): forma del `PagosMultipleDto`, si topa al
   total, y el permiso intencional. Si queda listo, el FE puede ofrecer un split en un solo paso en vez
   de agregar pago por pago.

## Pregunta abierta

- El tope se aplica al **total de la factura** sin importar la forma. `Exonerada` es una forma de pago
  que suma al abonado; ¿es correcto que una exoneración cuente para el tope (caso reportado:
  Exonerada $10 sobre un total de $10 ya deja saldo 0)? Se asume que sí. Confirmar.
