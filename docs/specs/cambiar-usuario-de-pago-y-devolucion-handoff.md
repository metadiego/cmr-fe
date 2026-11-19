# Handoff FE — Cambiar el usuario (cajero) de un pago o una devolución, en un paso

**Pedido del dueño, 19-nov-2026:** «que cambiar el cajero o usuario sea una tarea simple, no que haya
que desmontar todo un aparataje».

- BE: `cmr-be`, rama `feat/api-on-behalf-and-reassign-user`.
- Spec: `cmr-be/docs/specs/via-api-a-nombre-del-usuario.md`.

## 1. Devolución
En la pantalla de la devolución (detalle o reparación), junto a «Atendió», va un lápiz que abre
«Cambiar usuario» con un selector de personal activo del centro.
- Llamada: `PATCH /api/v2/invoices/:id/refunds/:refundId?centerIds=<centro>`, con body `{ userId }`.
- Cambia la devolución **y sus reembolsos activos** en un paso.
- Toast: «Usuario cambiado a <nombre>». Después, recargar el detalle.
- Permiso: `factura.refund.repair`, el mismo que reparar.

## 2. Pago
En la lista de pagos de la factura, cada pago activo tiene la acción «Cambiar usuario», con el mismo
selector.
- Llamada: `PATCH /api/v2/invoices/:id/payments/:paymentId?centerIds=<centro>`, con body `{ userId }`.
- Mismo pago y mismo monto: no se anula nada.
- Permiso: `factura.update`.

## Errores
Mostrarlos con `labelKey`:
- 409 `PAYMENT_NOT_ACTIVE` (`payment.reassign.notActive`): «Un pago anulado conserva quién lo hizo».
- 400 `STAFF_NOT_ACTIVE` (`refund.reassign.staffNotActive`): «Esa persona no está activa».
- 403 `CASH_PAST_DAY_LOCKED`: el día de caja está cerrado (aviso de siempre).

## i18n
Claves (es/en):
- `reassignUser.action`
- `reassignUser.title`
- `reassignUser.done`
- `payment.reassign.notActive`
- `refund.reassign.staffNotActive`

## Historial
El registro de cambios ya trae `actorName` como «Mirna de Arciles · API: <llave>» cuando algo se hizo
por la API a nombre de alguien. Mostrarlo tal cual.

## Verificación
Solo leyendo, o con el visto bueno del dueño: es caja. Si se prueba, que sea con un pago real del día,
reasignado y luego devuelto a su cajero original.
