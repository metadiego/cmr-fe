# Handoff BE — enlazar cada consumo de vial a su FACTURA (relacionar inventario ↔ cobranza)

> FE → BE. Fecha: 2026-08-22. Complementa la pantalla de viales (`/inventario/viales`).

## Por qué
Norma del dueño: nada aislado — todo se relaciona (paciente, tratamiento, producto/vial, factura,
caja). En «Seguimiento de viales», cada dosis ya enlaza al PACIENTE (`pacienteId` viene en el
reporte, el FE ya lo pinta como link a `/clientes/:id`). Falta poder saltar de la dosis a la
**FACTURA** que la consumió — el eslabón con la cobranza.

## El hueco (verificado en el contrato actual)
`GET /inventario/viales-abiertos/reporte` → cada item de `consumos[]` trae hoy:
`{ fecha, cantidad, vialId, vialNumero, pacienteId, paciente, record, sesionId, usuarioId }`.
Hay `sesionId` pero **no** `facturaId`, y el FE no puede resolver sesión→factura sin inventar. Por eso
no puede enlazar la dosis a su factura sin adivinar.

## Pedido (mínimo)
Agregar a cada `consumos[]` el documento que originó el consumo, con su número ya resuelto:

```jsonc
{
  "fecha": "…", "cantidad": 15, "vialId": "…", "vialNumero": 3,
  "pacienteId": "…", "paciente": "…", "record": "…", "sesionId": "…", "usuarioId": "…",
  "facturaId": "…",            // ← NUEVO (null si el consumo no nació de una factura)
  "facturaNumero": "000646"    // ← NUEVO (numeroDisplay ya formateado; null si no aplica)
}
```

- `facturaId: null` cuando el consumo no provenga de una factura (ajuste manual, etc.) → el FE no pinta
  link, muestra la fila igual.
- `facturaNumero` = el `numeroDisplay` que ya usa el resto (para pintar «#000646» sin recomputar).
- Fuente de verdad: la misma línea de factura / sesión que descontó el vial. No recalcular en el FE.

## FE (lo que haremos al llegar el campo)
Pintar el nº de factura como link a `/facturacion/:facturaId` en la tabla de consumos de
`app/(app)/inventario/viales/page.tsx` (junto al paciente, que ya enlaza). Sin endpoint nuevo, sin
tocar el resto. RBAC igual que el reporte.

## Verificar
`GET /inventario/viales-abiertos/reporte?productoId=…` de un producto con consumos reales → cada
consumo trae `facturaId`/`facturaNumero` (o null), y en la pantalla la dosis enlaza a su factura.
```
