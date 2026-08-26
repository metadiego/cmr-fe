# Descuento global: el control manda el TIPO equivocado

**Estado BE:** desplegado y verificado en producción (26-ago-2026).
**Qué hay que tocar en el FE:** el bloque «DESCUENTO GLOBAL» de la factura (selector + campo + Aplicar)
y el toast de error.

## Lo que pasa hoy en pantalla

Factura de **$6.120**. El cajero escribe **2520** para descontar dos mil quinientos veinte **dólares**.
El selector está en **`%`** (es el valor por defecto del control), así que el FE envía:

```json
PUT /api/v1/facturas/:id/descuento-global   { "tipo": "porcentaje", "valor": 2520 }
```

Antes eso calculaba `6120 × 2520 / 100`, el motor lo topaba en la base y **la factura quedaba en $0
sin un solo aviso**. Ahora el BE lo **rechaza con 400** — que es lo correcto — pero el FE pinta un
toast que solo dice `VALIDATION ERROR`, así que el cajero no sabe qué hacer.

## Lo que el BE devuelve ahora (contrato exacto, verificado en prod)

Todos son **HTTP 400** con esta forma:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "labelKey": "factura.descuentoPorcentajeMayorQue100",
    "message": "un descuento en porcentaje no puede pasar de 100 (llegó 2520). Si querías descontar 2520 de dinero, el tipo es 'monto'.",
    "meta": { "valor": 2520 }
  },
  "meta": { "tenant": "...", "timestamp": "...", "requestId": "..." }
}
```

`labelKey` y sus datos:

| labelKey | cuándo | meta |
|---|---|---|
| `factura.descuentoPorcentajeMayorQue100` | tipo `porcentaje` con valor > 100 | `{ valor }` |
| `factura.descuentoMayorQueLaBase` | tipo `monto` con valor > subtotal | `{ valor, base }` |
| `factura.descuentoNegativo` | valor < 0 | — |
| `factura.descuentoNoEsNumero` | valor no numérico | — |
| `factura.descuentoTipoInvalido` | tipo distinto de `monto`/`porcentaje` | — |

Comprobado contra producción con la factura `ea67e6eb-36d4-419f-93b1-48f9e43b384e` (subtotal 5400):

- `{"tipo":"monto","valor":9999}` → 400 · «el descuento de 9999 es mayor que el importe al que se
  aplica (5400). Si querías regalar el total, el descuento es exactamente 5400.»
- `{"tipo":"monto","valor":2520}` → 200 · subtotal 5400, descuento 2520, **total 2880**.
- `{"tipo":"porcentaje","valor":100}` → 200 (cortesía del 100%, sigue permitida).

## Verificado EN PANTALLA (navegador real, 26-ago-2026, sesión de Edgardo)

Factura de $150 en CMR Bayamón, control de descuento con el selector en su valor por defecto (`%`),
valor 2520, botón Aplicar:

- `PUT …/descuento-global` → **400** (el BE hace lo correcto: no regala la factura).
- En la pantalla **no aparece absolutamente nada**: ni toast, ni texto en rojo, ni el campo marcado.
  El total se queda en $150 y el cajero no sabe si aplicó o no. Silencio total.

Eso es peor que el `VALIDATION ERROR` de la captura anterior: el rechazo llega y se pierde.
**Este es el punto 2 de la lista, y es el más urgente.**

## Lo que hay que cambiar en el FE

1. **El tipo por defecto es `$` (monto), no `%`.** Quien escribe «2520» en una caja está pensando en
   dólares. El `%` es el caso raro y debe elegirse a propósito.
2. **Mostrar `error.message` en el toast**, no el `code`. El mensaje ya viene redactado para el
   cajero y le dice exactamente qué hacer. Si hay i18n, usar `labelKey` + `meta`; si no, el `message`
   tal cual sirve.
3. **Validar en el control antes de llamar**: con `%` seleccionado, un valor > 100 se marca en rojo
   en el propio campo («un porcentaje no pasa de 100 — ¿querías $2520?») con un atajo que cambia el
   selector a `$`. Así el error se ve donde se escribe, no en un toast.
4. **Con `$` seleccionado, un valor mayor que el subtotal** se marca igual, ofreciendo el monto exacto
   que regala el total (`meta.base`).

## Lo que NO cambia

El endpoint, la ruta y la forma del cuerpo son los mismos: `PUT /api/v1/facturas/:id/descuento-global`
con `{ tipo, valor }`. Solo cambia qué se rechaza y con qué mensaje.
