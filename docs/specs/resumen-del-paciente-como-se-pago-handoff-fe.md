# Handoff FE — el panel «Lo que suma el paciente hoy» ya dice CÓMO se pagó

**Estado: EN PRODUCCIÓN y verificado por HTTP real el 6-oct-2026.** El BE ya manda el dato; falta
pintarlo.

**Origen**: el dueño, mirando Bayamón, récord **62107**, **PAGAN ROBLES, ANGELA**, factura
**000373** ($39.23): *«quiero que muestre cómo se pagó, porque hubo un caso en que el paciente
tenía varias facturas y en una de ellas pagó con 4 métodos de pago y fue difícil llegar al
problema»*.

---

## 1. El endpoint es el MISMO que ya usas

```
GET /api/v1/facturas/resumen-paciente?pacienteId=<uuid>[&desde=&hasta=]
GET /api/v2/invoices/patient-summary?patientId=<uuid>[&from=&to=]
```

No cambia la ruta, ni los parámetros, ni ningún campo existente. **Solo se añaden dos cosas**:
`pagos[]` dentro de cada factura y `formasDePago[]` en la raíz.

## 2. Respuesta REAL de producción (6-oct-2026, factura 000373)

Esto está **copiado de la llamada**, no del DTO. En `/api/v1`:

```json
{
  "facturas": [
    {
      "id": "47cf2e86-…", "referencia": "000373", "estado": "emitida",
      "total": 39.23, "cobrado": 39.23, "pendiente": 0, "cuenta": true,
      "pagos": [
        { "formaPagoId": "857bf51d-…", "formaPagoClave": "master",
          "labelKey": "pago.master", "nombre": "Mastercard",
          "monto": 39.23, "tipo": "pago", "referencia": null }
      ]
    }
  ],
  "totalGeneral": 39.23, "totalCobrado": 39.23, "totalPendiente": 0,
  "formasDePago": [
    { "formaPagoId": "857bf51d-…", "formaPagoClave": "master",
      "labelKey": "pago.master", "nombre": "Mastercard", "monto": 39.23 }
  ]
}
```

En `/api/v2` los MISMOS campos traducidos — verificado en la misma llamada:

| v1 | v2 |
|----|----|
| `pagos` | `payments` |
| `formasDePago` | `paymentMethods` |
| `formaPagoId` | `paymentMethodId` |
| `formaPagoClave` | `paymentMethodKey` |
| `monto` | `amount` |
| `tipo` | `type` |
| `referencia` | `reference` |
| `nombre` | `name` |
| `labelKey` | `labelKey` (igual) |

> **Ojo con v2**: los campos viejos de este endpoint (`totalGeneral`, `devuelto`, `cobrado`,
> `pendiente`, `cuenta`, `conceptoLabelKeys`, `anuladasExcluidas`) **siguen saliendo en español**
> también en v2. Es deuda anterior a este cambio, no una novedad; si te estorba, dímelo y la cierro
> aparte.

## 3. Qué significa cada campo

**`pagos[]` (por factura)** — un renglón por movimiento, en el orden en que se registraron:

- `labelKey` → **el texto lo pones tú**. El BE no manda nombres traducidos. `nombre` viene como
  respaldo si no tienes la clave en el diccionario; úsalo solo entonces.
- `monto` → lo que entró por esa vía.
- `tipo` → `pago` (suma) o `reembolso` (**resta**: píntalo distinto, en negativo o con su color).
- `referencia` → últimos 4 de la tarjeta o nº de aprobación. Suele venir `null`; si viene, enséñalo
  pequeño junto al método: es con lo que se concilia en el cuadre.
- `formaPagoClave` → clave estable (`master`, `efectivo`, `ath`…) por si quieres un icono por
  método. **No la muestres como texto.**

**`formasDePago[]` (raíz)** — el consolidado de TODAS las facturas del rango, **ya ordenado de
mayor a menor**. Es la respuesta a «¿y en total, con qué pagó hoy?». Píntalo junto a
`totalCobrado`, que es el número que tiene que cuadrar con la suma de estos montos.

## 4. Reglas que el BE ya aplica (no las repitas en el FE)

- **Los pagos anulados NO vienen.** No son dinero. No los filtres tú: no llegan.
- **`montoAbonado`/`cobrado` sigue siendo la verdad de lo cobrado.** `pagos[]` lo **explica**, no lo
  recalcula. Si algún día no cuadran, **es un defecto del BE**: avísame, no lo disimules sumando
  los pagos en pantalla.
- **Factura anulada**: sus pagos se ven en su fila (para auditar) pero **no entran** en
  `formasDePago[]`. Por eso el pie puede ser menor que la suma de las filas si hay una anulada.
- **Forma con neto cero** (cobrada y reembolsada entera) **no se lista**.
- **Sin pagos** → `pagos: []` y `formasDePago: []`. Nunca `undefined`, nunca `null`: puedes mapear
  directo.
- Las formas salen del catálogo y se leen **aunque estén desactivadas**: una forma retirada ayer
  sigue explicando un cobro de anteayer.
- Si una forma ya no existe, llega `labelKey: "pago.forma_desconocida"` con `nombre: null`. Ten una
  traducción para esa clave.

## 5. Lo que se pide pintar

En el panel «Lo que suma el paciente hoy»:

1. Bajo cada factura (o en un desplegable de la fila), **el desglose de sus pagos**: método + monto,
   y la referencia si viene.
2. En el pie, junto a **Cobrado**, **las formas consolidadas**: «Mastercard $39.23», y con varias,
   una línea por forma.

El caso que motivó esto —una factura con **cuatro** métodos entre varias facturas— tiene que
leerse de un vistazo, sin abrir nada.

## 6. Claves i18n que necesitas

Las del catálogo de formas de pago (`pago.efectivo`, `pago.tarjeta`, `pago.master`, `pago.ath`,
`pago.seguro`…) más `pago.forma_desconocida`. Si falta alguna en tu diccionario, el `nombre` del
BE sirve de respaldo.

---

Razón completa en el BE: `cmr-be/docs/specs/el-resumen-dice-como-se-pago.md`.
