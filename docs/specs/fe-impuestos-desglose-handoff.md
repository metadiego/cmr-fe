# Handoff FE — Desglose de impuestos individual (factura + por línea)

**BE listo (PR #91).** El total NO cambia; solo se muestran los impuestos **desglosados**.

## De dónde sale (respuesta de `GET /facturas/:id`, ya existente)
```jsonc
{
  "impuesto": 58.11,                       // TOTAL de impuestos (déjalo como está)
  "impuestos": [                           // ← NUEVO desglose por impuesto (N renglones)
    { "clave": "estatal",   "nombre": "Estatal",   "tasa": 10.5, "base": 505.30, "monto": 53.06 },
    { "clave": "municipal", "nombre": "Municipal", "tasa": 1,    "base": 505.30, "monto": 5.05 }
  ],
  "baseExenta": 4560.00,
  "items": [
    { "descripcion": "CIRCULAT 300", "montoImpuesto": 20.65,
      "impuestos": [                       // ← NUEVO: impuesto individual POR PRODUCTO
        { "clave": "estatal", "tasa": 10.5, "monto": 18.85 },
        { "clave": "municipal", "tasa": 1, "monto": 1.80 } ] }
  ]
}
```

## Qué pintar
- **Recibo / totales:** en lugar de un solo "IVU PR (11.5%)", recorrer **`impuestos[]`** y pintar
  un renglón por elemento: `nombre (tasa%) …… $monto`. El **Total** sigue saliendo de `impuesto`
  (no lo calcules sumando tú). Ejemplo:
  ```
  SubTotal            $5,065.30
  Estatal (10.5%)        $53.06
  Municipal (1%)          $5.05
  Total               $5,123.41
  ```
- **Detalle por producto (si lo muestran):** cada `item.impuestos[]` trae el impuesto individual de
  esa línea. Úsalo para vistas/reportes por producto.

## Reglas (NO hardcodear)
- **NO** asumas 2 impuestos ni "11.5%". Recorre `impuestos[]` — pueden ser 1, 2 o más (configurable
  en el BE). Si mañana hay un 3º, aparece solo; tu UI no cambia.
- Si `impuestos[]` viene vacío (factura exenta o sin gravar) → no muestres línea de impuesto; usa `baseExenta`.
- `nombre`/`tasa` vienen del dato — muéstralos tal cual (i18n del label del CONCEPTO "impuesto" si aplica,
  pero el nombre del impuesto es dato).

## Aceptación
- Recibo muestra N renglones de impuesto desde `impuestos[]`; el Total = `impuesto` (sin recomputar).
- Agregar/quitar un impuesto en el BE (config) se refleja sin tocar el FE.
