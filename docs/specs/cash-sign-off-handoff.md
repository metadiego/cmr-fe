# Firma del cuadre de caja («Acepto») — handoff BE → FE

**Fecha:** 6-nov-2026 · **Pedido por:** el dueño · **Spec BE:** `cmr-be/docs/specs/firma-del-cuadre-de-caja.md`

## Lo que pidió el dueño

> «Que el cajero y el gerente firmen. Pero los cajeros muchas veces se van antes que los gerentes:
> entonces que cada cajero deje su firma confirmando que todo está bien, como las firmas de las apps
> modernas, que aceptando o dando OK ya están de acuerdo. Y que coloque la hora y la fecha en que fue
> aceptado, configurable.»

> «Yo no uso el cierre porque es problemático»: el facturador puede vender por teléfono después de irse.

Consecuencias para la pantalla:

- **La firma NO exige cerrar el cuadre.** No pongas el botón detrás del cierre.
- Una firma es un **sello**, no un dibujo: el nombre, la fecha y la hora en que se aceptó, y las cifras
  que se aceptaron.

## Contrato (los nombres de campo se verifican contra producción cuando esté desplegado)

### Firmar

`POST /api/v2/cash/reconciliations/:id/sign`, con `?centerIds=` opcional, igual que el GET de la hoja.

```json
{ "signAs": "cashier" | "supervisor", "agree": true }
```

- `cashier`: solo puede firmar el cajero **de esa hoja**. Si firma otra persona, responde 403.
  - El consolidado y el cuadre total no tienen cajero: firmarlos como `cashier` responde 400.
- `supervisor`: requiere `caja.ver_todos` y vale para cualquier hoja: la de un cajero, el consolidado o
  el total. Sin ese permiso responde 403.
- Si `agree` no es `true`, responde 400.
- Si la misma persona vuelve a firmar (por ejemplo, después de una venta tardía), la firma anterior queda
  anulada (`voidReason: "re-signed"`) y se crea una nueva.
- Si otra persona intenta firmar con el mismo papel, responde 409 con `signedBy` y `signedAt`.
- Si se reabre una hoja cerrada, sus firmas quedan anuladas (`voidReason: "reopened: <motivo>"`).

**200 (la firma):**

```json
{ "id", "reconciliationId", "role": "cashier", "staffId", "signerName",
  "statement": "Confirmo que el conteo y los totales de esta hoja son correctos.",
  "signedAt": "2026-11-06T19:45:00.000Z",
  "figures": { "dayTotal": 500, "salesCash": 40, "countedCash": 90, "difference": 0 },
  "voidedAt": null, "voidReason": null }
```

### Ver las firmas

`GET /api/v2/cash/reconciliations/:id/signatures`, con `?centerIds=` opcional.

- Devuelve todas las firmas, también las anuladas (`voidedAt` distinto de null), en orden cronológico.
- Pueden pedirlas el cajero de la hoja o un supervisor.

### Lo configurable

- **El texto que se acepta**, por centro: la preferencia `caja.signOff.statement`. Se edita con el editor
  de preferencias, igual que `caja.emailRecipients`. El valor por defecto es «Confirmo que el conteo y los
  totales de esta hoja son correctos.».
- **La hora** se muestra en la zona horaria del centro (`time_zone`).

## Qué construir

1. **En la hoja del cajero** (`cuadre-caja.tsx`):
   - Un botón **«Firmar y aceptar»**. Al pulsarlo se abre un diálogo con el texto de `statement`, las
     cifras actuales (total del día, efectivo de ventas, efectivo en caja y diferencia) y un botón
     «Acepto». Al aceptar se envía `signAs: "cashier"`.
   - Para quien tiene `caja.ver_todos`, un segundo botón: «Firmar como gerente» (`signAs: "supervisor"`).
2. **En el cuadre total y en el consolidado:** solo el botón del gerente.
3. **El estado de cada firma, visible**: «Aceptado por NOMBRE · 11/06/2026, 3:45 PM». Si las cifras de la
   firma (`figures`) ya no coinciden con las de la hoja actual, un aviso en rojo: «Firmado con otras
   cifras: total $X · diferencia $Y». Ese es justo el caso de la venta tardía por teléfono.
4. **La hoja impresa** (`buildPrintHtml`): los bloques de firma muestran, encima de la línea, la misma
   leyenda «Aceptado por … · fecha y hora» y el aviso en rojo; debajo, la etiqueta.
   - En el total y en el consolidado hay un bloque «Cajero — NOMBRE» por cada cajero del día, más
     «Gerente».
   - El email del BE ya los dibuja así: úsalo como referencia.
5. **i18n** de los textos nuevos con `labelKey` en `es` y `en`.

## Verificación

- Con la sesión de un cajero de Caguas: firmar su hoja de hoy y recibir el correo del cuadre. La
  leyenda «Aceptado por…» tiene que salir con la hora de Puerto Rico.
- Después, con la sesión de un gerente: firmar el cuadre total y enviar el correo. Tienen que verse todos
  los cajeros y el gerente.
