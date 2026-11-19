# Handoff FE — Devolución de facturas del legado: el redondeo no bloquea

**Pedido del dueño, 19-nov-2026.**
- BE: `cmr-be`, rama `feat/legacy-refund-rounding`.
- Spec: `cmr-be/docs/specs/devolucion-de-facturas-del-legado.md`.

## El caso
S040286 (Caguas):
- las líneas suman 1616.80 y el legado guardó un total de 1616.79;
- la pantalla dijo «El reembolso no puede superar el total de la factura ($1616.79)» y bloqueó;
- hubo que bajar un céntimo a mano.

## Lo que cambia en la pantalla de devolución
1. Leer `config.legacyRoundingTolerance` de la política de devolución de la factura, que ya se pide
   (`GET /api/v2/invoices/:id/refund-policy`). Por defecto vale 0.05.
2. Si la factura viene del legado (trae número del legado, p. ej. `legado-S040286`) y el neto supera
   lo que queda de la factura en **no más** de la tolerancia:
   - no bloquear;
   - debajo del neto, mostrar «Ajuste de redondeo del legado: −$0.01» (i18n
     `refund.legacyRoundingAdjustment`, con el monto);
   - mostrar como neto el total de la factura;
   - enviar los montos de cada línea tal cual: el BE resta el exceso de la línea mayor y responde
     `roundingAdjustment`.
3. Si el exceso supera la tolerancia, o la factura no es del legado, el bloqueo sigue como hoy.
4. En el toast de éxito, si `roundingAdjustment > 0`, añadir «(ajuste de redondeo $0.01)».

## Verificación
- En producción, con una factura del legado cuyo total sea un céntimo menor que la suma de sus
  líneas: la pantalla deja devolver, el neto es igual al total y la devolución queda por el total.
- Comprobarlo SOLO leyendo, o con una devolución que el dueño autorice: es dinero.
