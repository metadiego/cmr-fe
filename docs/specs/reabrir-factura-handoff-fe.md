# Handoff FE — Reabrir una factura emitida para corregirla (mismo número)

**Estado: BE EN PRODUCCIÓN y verificado por HTTP real el 8-oct-2026** (Bayamón, paciente de prueba
récord 111605 «PRUEBA CIERRE BAYAMON QA», facturas de prueba 000399 y 000400, ya anuladas).

**Origen**: una usuaria de Consulta: *«cuando se emite una factura en Consulta no encuentro la forma de
editarla si se cometió un error, o si se exoneró y luego el paciente paga 10 dólares; hoy se logra
anulando y rehaciéndola»*. Y el dueño: *«muchas veces hay que mover una factura de fecha, ajustar las
formas de pago o agregar o quitar productos… no quiero verme atado»*.

## Qué hace

**Reabrir** = la factura emitida vuelve a **borrador CON SU MISMO NÚMERO**. Se edita como cualquier
borrador (líneas, precios, pagos) y se **vuelve a emitir con el mismo número**. No es anular.

Al reabrir, el BE ya hace solo: repone el inventario vendido, anula los paquetes de sesiones sin uso
(re-emitir los crea de nuevo con las líneas corregidas), cancela sus auto-presentes del frontdesk, y
**conserva los pagos**.

## Endpoints (v2; v1 entre paréntesis)

| | ruta | permiso |
|---|---|---|
| ¿Se puede? (no cambia nada) | `GET /api/v2/invoices/:id/reopen/check` (`/api/v1/facturas/:id/reabrir/comprobar`) | `factura.reopen` |
| Reabrir | `POST /api/v2/invoices/:id/reopen` body `{ "reason": "…" }` (v1: `{ "motivo": "…" }`) | `factura.reopen` |
| Historial | `GET /api/v2/invoices/:id/reopenings` (`/facturas/:id/reaperturas`) | `factura.read` |

### Respuestas REALES (copiadas de producción)

`GET …/reopen/check` sobre una emitida:
```json
{ "data": { "canReopen": true, "reasons": [], "warnings": [] } }
```
sobre una que ya está en borrador:
```json
{ "data": { "canReopen": false, "reasons": [{ "labelKey": "invoice.reopen.notEmitted" }], "warnings": [] } }
```

`POST …/reopen` devuelve **la factura** (la misma forma que `GET /invoices/:id`) con
`status: "borrador"` y su `number` intacto. Los avisos van en **`meta.warnings`** (mismo patrón que los
cupos del frontdesk).

`GET …/reopenings` — una fila por reapertura, la más reciente primero:
`id, clinicId, createdAt, updatedAt, invoiceId, invoiceNumber, reopenedBy, reason, snapshot`.
`snapshot` es **la factura tal como estaba emitida** (con sus `items`, en inglés como el resto de v2):
compárala con la actual para enseñar «qué cambió».

## Cuándo NO se puede (bloquea) y cuándo solo AVISA

Pinta el botón **Reabrir** en toda factura emitida y llama a `reopen/check` para habilitarlo o
explicar por qué no. No repliques las reglas en el FE.

**Bloquean** (`reasons[].labelKey`):
- `invoice.reopen.disabled` — el centro lo tiene apagado.
- `invoice.reopen.notEmitted` — no está emitida (borrador, anulada o con devoluciones).
- `invoice.reopen.outOfWindow` — fuera de la ventana del centro (por defecto **no hay** ventana).
- `invoice.reopen.sessionsUsed` — alguna sesión de sus paquetes ya se entregó.

**Avisan sin bloquear** (`warnings[].labelKey`):
- `invoice.reopen.cashClosed` — el cuadre de caja de ese día ya está cerrado: corregirla lo altera.
  Enséñalo en el modal de confirmación («esto cambia un cuadre ya cerrado») y deja seguir.

Si el `POST` falla, el error trae `code: "INVOICE_REOPEN_NOT_ALLOWED"`, `labelKey` (la primera) y
`reasons` (todas). Sin motivo: `code: "INVOICE_REOPEN_REASON_REQUIRED"`.

## Mover de fecha

Reabrir y volver a emitir con `POST /api/v2/invoices/:id/issue` `{ "date": "YYYY-MM-DD" }` (v1
`/facturas/:id/emitir` `{ "fecha": … }`, solo hacia atrás, como siempre).
- **Sin fecha, conserva la suya** (no la de hoy).
- Con fecha, tiene que caber **entre la de su número anterior y la del siguiente**; si no, 400
  `code: "INVOICE_DATE_OUT_OF_SEQUENCE"`, `labelKey: "invoice.reopen.dateOutOfSequence"`, con
  `from` y `to`: el rango que sí cabe. Úsalo para limitar el selector de fecha o explicar el error.

## Lo que se pide en pantalla

1. **Botón «Reabrir»** en el visor de una factura emitida (Consulta y General), visible con
   `factura.reopen`. Al pulsar: modal con **motivo obligatorio**, los `warnings` del `check`, y
   confirmar. Tras reabrir, la factura se abre en modo edición (es un borrador).
2. En ese borrador ya funciona todo lo de siempre: cambiar precio/cantidades, agregar o quitar
   líneas, **anular un pago y registrar otro con otra forma**, y **emitir** (opcionalmente con otra
   fecha).
3. **Historial «Reaperturas»** en la factura: quién, cuándo, por qué, y «qué cambió» comparando
   `snapshot` con la actual.
4. En la configuración del centro (donde están los otros interruptores, `PUT
   /api/v2/centers/:id/tax-details`): `invoiceReopenEnabled` (bool, default `true`) e
   `invoiceReopenWindowDays` (entero ≥ 0 o `null` = sin límite, el default; `0` = solo el mismo día).

## i18n

`invoice.reopen.disabled`, `.notEmitted`, `.outOfWindow`, `.sessionsUsed`, `.cashClosed`,
`.reasonRequired`, `.dateOutOfSequence`, e `invoice.notFound`.

## Un cambio que te afecta aunque no toques nada

Quitarle el **último pago** a una factura emitida ya la devolvía a borrador; ahora además repone su
inventario y, al re-emitirla, **conserva su número** (antes quemaba otro y descontaba el inventario dos
veces). Para el FE no cambia el flujo.

Razón completa: `cmr-be/docs/specs/reabrir-una-factura-del-dia.md`.
