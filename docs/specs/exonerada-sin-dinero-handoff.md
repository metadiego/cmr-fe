# Exonerar es un descuento del 100 %, no un pago — handoff BE → FE

**Origen:** dueño, 11-nov-2026, Caguas. Tres consultas exoneradas se cobraron $10 con la forma «Exonerada», y el cuadre total sumó «Exonerada ×3 $30». El BE es el PR #564.

## Qué cambia en el BE

1. Cada forma de pago tiene un campo nuevo, **`carriesMoney`** (por defecto `true`). Se lee en `GET /v2/billing/payment-methods` y se cambia con `PUT /v2/billing/payment-methods/:id`. Exonerada queda con `carriesMoney: false`.
2. Cualquier pago, pago dividido o corrección con una forma `carriesMoney: false` se rechaza con:
   - 400 `PAYMENT_METHOD_CARRIES_NO_MONEY`;
   - `labelKey: factura.pago.forma_sin_dinero`;
   - `formaPago`: el nombre de la forma.
3. Una factura con más dinero cobrado que su total no se puede emitir. Responde:
   - 400 `FACTURA_PAGO_SUPERA_TOTAL`;
   - `labelKey: facturacion.error.pago_supera_total`;
   - `sobrante`: lo cobrado de más.

   Pasa, por ejemplo, si se cobra, se reabre, se aplica un 100 % y se intenta emitir.
4. El cuadre (por cajero y total) ya no suma los pagos de formas `carriesMoney: false`.

## Qué pide al FE

1. **No ofrecer las formas `carriesMoney: false`** en el selector de pago, ni en el dividido ni en «corregir pago». Para exonerar, la pantalla debe llevar al descuento del 100 %, que emite sin pago.
2. Traducir las dos claves:
   - `factura.pago.forma_sin_dinero`: «"{formaPago}" no lleva dinero: para exonerar, aplica un descuento del 100 % y emite sin pago». En inglés: «"{formaPago}" carries no money: to exempt, apply a 100% discount and issue without payment».
   - `facturacion.error.pago_supera_total`: «La factura tiene {sobrante} cobrados de más: anula o corrige ese pago antes de emitir». En inglés: «This invoice holds {sobrante} more than its total: void or correct that payment before issuing».
3. En Configuración → Formas de pago, mostrar y editar «Lleva dinero» (`carriesMoney`), igual que ya se hace con «Es efectivo».

## Verificación

Hacerla tras el despliegue, en producción y en Caguas:
- `GET /v2/billing/payment-methods` debe devolver Exonerada con `carriesMoney: false`;
- el selector de pago no debe mostrar Exonerada;
- el cuadre total de hoy no debe tener fila «Exonerada».

Los nombres de campo se confirman con la respuesta real cuando el BE esté desplegado.
