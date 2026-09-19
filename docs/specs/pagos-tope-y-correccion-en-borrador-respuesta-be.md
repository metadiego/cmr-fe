# Pagos: tope y corrección en borrador — RESPUESTA del BE

Responde a `pagos-tope-y-correccion-en-borrador-handoff-be.md`. Los tres pedidos están hechos y en
`main`. Spec y plan del BE: `cmr-be/docs/specs/el-pago-no-pasa-del-total.md` y
`cmr-be/docs/plans/el-pago-no-pasa-del-total.md`.

## 1. Tope autoritativo — HECHO

El servidor rechaza cualquier abono que haga `abonado > total`, con holgura de un centavo por el
redondeo. Se aplica en las **tres** entradas:

- `POST /facturas/:id/pagos`
- `POST /facturas/:id/pagos/multiple` — se topa por la **SUMA** del split, no línea a línea
- `PUT /facturas/:id/pagos/:pagoId` — al editar, el importe del propio pago **libera** sitio
  (editar la Exonerada de $10 sobre un total de $10 con $5 de efectivo deja caber $5)

Los **reembolsos** (`tipo = 'reembolso'`) no pasan por el tope: restan.

Error (400):

```json
{
  "error": {
    "code": "PAGO_EXCEDE_TOTAL",
    "labelKey": "factura.pago.excede_total",
    "max": 6,
    "message": "El pago no puede pasar del total de la factura (cabe 6.00)."
  }
}
```

`max` es **lo que todavía cabe**, ya con el propio pago liberado si es una edición. Llega de verdad
al cliente: el filtro global solo arrastra el payload de negocio de los `code` registrados, así que
`PAGO_EXCEDE_TOTAL` se dio de alta en `ErrorCodes` (antes se habría perdido en silencio).

## 2. Corregir en BORRADOR sin `factura.pago.anular` — HECHO

Se eligió la **opción A** del handoff (no se crea `factura.pago.borrador`): en `borrador`, `DELETE` y
`PUT` de un pago no exigen `factura.pago.anular`. En `emitida`, `anulada`, `devuelta_parcial` y
`devuelta_total` lo siguen exigiendo, porque ahí sí es una anulación auditable.

**Lo que el FE tiene que saber para des-gatear el botón:** la puerta declarada de esas dos rutas pasó
de `factura.pago.anular` a **`factura.update`**, en el REST y en las dos herramientas MCP. Motivo: el
guard no ha leído la factura todavía, así que no puede mirar su estado; la clave declarada es la de
tocar la factura y el estado se comprueba dentro. Entonces:

- **Botón visible/activo** si el usuario tiene `factura.update` **y** (`factura.estado === 'borrador'`
  **o** tiene `factura.pago.anular`).
- Si no, el servidor responde **403**:

```json
{
  "error": {
    "code": "PERMISO_REQUERIDO",
    "labelKey": "factura.pago.requiere_permiso_anular",
    "permiso": "factura.pago.anular"
  }
}
```

Verificado leyendo los 14 roles de producción (`GET /api/v1/roles/:id/permisos`): ningún rol tenía
`factura.pago.anular` sin `factura.update`, así que **nadie pierde** lo que ya podía; y `atencion` y
`recepcion` tienen `factura.update` sin `anular` — son los que **ganan** corregir su propio borrador.

## 3. Contrato de `POST /pagos/multiple` (split) — CONFIRMADO, no cambia

```
POST /api/v1/facturas/:id/pagos/multiple      (v2: /api/v2/invoices/:id/payments/multiple)

{ "pagos": [ { "formaPagoId": "uuid", "monto": 60, "notas": "?", "referencia": "?" }, ... ] }
```

- `pagos` es obligatorio y no puede ir vacío; `monto >= 0.01`; `formaPagoId` opcional (uuid).
- Valida **todo antes de escribir** y recomputa la factura **una sola vez** (atómico de cara al total).
- Permiso: el mismo que `POST /pagos` — no declara `@Permissions`, así que la puerta es la derivada
  de la ruta (`factura.create`/`factura.manage`, y equivalentes) que ya tiene quien factura.
- **Nuevo:** la SUMA del split se topa al total, con el mismo error `PAGO_EXCEDE_TOTAL`.

Con esto el FE puede ofrecer el split en un solo paso en vez de pago a pago.

## Pregunta abierta — respondida

**Sí: `Exonerada` cuenta para el tope.** Es una forma de pago que salda la factura, así que ocupa
sitio en el total; exonerar $10 sobre un total de $10 deja saldo cero, que es lo que el negocio
espera. El tope mira el **abonado**, no la forma.

## Verificado CONTRA PRODUCCIÓN (17-sep, tras el despliegue)

Con una llave de clínica **sin** `factura.pago.anular` (permisos `factura.read`, `factura.create`,
`factura.update`), creada para esto y **revocada al terminar**:

| Caso | Resultado |
|---|---|
| `POST /pagos` de $50 sobre un total de $10 | 400 `PAGO_EXCEDE_TOTAL`, `max: 10` |
| `POST /pagos/multiple` de $6 + $6 sobre $10 | 400 `PAGO_EXCEDE_TOTAL`, `max: 10` (topa por la suma) |
| `POST /pagos/multiple` de $6 + $4 sobre $10 | 200, `abonado 10`, `cancelado true` |
| `PUT` del pago de $6 a $8 (saldada) | 400 `PAGO_EXCEDE_TOTAL`, **`max: 6`** — su propio importe libera sitio |
| `PUT` del pago de $6 a $6 | 200 |
| `DELETE` del pago en **borrador**, sin `factura.pago.anular` | 200, `abonado 0` — **antes era 403** |
| `DELETE` del pago en la **emitida 000751** | 403 `PERMISO_REQUERIDO`, `permiso: factura.pago.anular`, y el pago sigue `activo` |

La factura del reporte quedó como estaba: `borrador`, total 10, **abonado 0** (el sobrepago de $15 ya
lo habíais limpiado antes de esta prueba).

## Un dato que conviene mirar (no lo toqué: mueve dinero)

La factura `ae41df6f-4418-4300-a0fb-5f3ffc9db9f0` (borrador, 12-sep) tiene **total $14,528 y abonado
$55,712**. Es del mismo agujero, de antes del tope. No la reescribo por mi cuenta; que decida el
dueño si se corrige o se descarta.
