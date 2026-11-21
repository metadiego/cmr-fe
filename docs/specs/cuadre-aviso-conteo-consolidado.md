# Handoff — Cuadre total: aviso en ROJO cuando un conteo consolidado pisa a los cajeros (21-nov-2026)

## Qué pasó (Bayamón, hoy)

El cuadre total marcó **falta $50**. No faltaba dinero: Waldemar contó **$200 en el consolidado de la
caja general** (la vista sin cajero) y 15 s después **$250 en su propio cuadre**. El conteo del
consolidado manda sobre la suma de los cajeros, así que la hoja tomó 200 y no dijo nada. Dueño: «que
se vea inmediatamente en amarillo o rojo y que lo exprese claramente en un texto».

## Lo que manda el BE (rama `feat/cash-consolidated-override-warning`)

`GET /api/v2/cash/total-reconciliation` → `countMode.warnings[]` trae un elemento nuevo:

```json
{
  "code": "CONSOLIDATED_COUNT_OVERRIDES_CASHIERS",
  "labelKey": "caja.countMode.consolidatedOverridesCashiers",
  "division": "general",
  "params": { "counted": 200, "cashiersCounted": 250, "difference": -50 }
}
```

`params` es nuevo en los avisos (los otros tres no lo traen). Sale en los tres modos de conteo y
solo si los importes difieren.

## Lo que se pide (pieza compartida: el render de `countMode.warnings`)

1. `components/caja/cuadre-total.tsx` (~línea 357): al traducir, pasar **también** `w.params`
   (formateados como moneda) además de `division`: `tRoot(w.labelKey, { division, ...moneda(w.params) })`.
   Así cualquier aviso futuro con importes funciona sin tocar la pantalla.
2. Este `code` va en **rojo** (`destructive`: borde y fondo rojo suave, icono de alerta), arriba, junto
   a la diferencia. Los demás avisos siguen en ámbar. Mejor: un mapa `code → severidad` en un solo
   sitio, no un `if` suelto.
3. i18n (`messages/es.json` y `en.json`, bajo `caja.countMode`):
   - es: `"consolidatedOverridesCashiers": "Caja {division}: se usó un conteo consolidado de {counted} en lugar de lo que contaron los cajeros ({cashiersCounted}). Diferencia {difference}. Revise cuál es el correcto; si el bueno es el de los cajeros, vuelva el consolidado a la suma."`
   - en: `"consolidatedOverridesCashiers": "{division} drawer: a consolidated count of {counted} is used instead of the cashiers' counts ({cashiersCounted}). Difference {difference}. Check which one is right; if the cashiers' is, set the consolidated back to the sum."`
4. Volver a la suma = `POST /cash/reconciliations/:id/count` con `{ "conteos": [] }` sobre el
   consolidado de esa división (ya existe en la pantalla del consolidado).

## Verificación

- Cuadre total de un día con consolidado 200 y cajero 250 en general → aviso rojo con los tres
  importes; tras «volver a la suma», el aviso desaparece y la diferencia queda en 0.
- Mismo importe en los dos → sin aviso.
- Pantalla viva: Caja → Cuadre total.
