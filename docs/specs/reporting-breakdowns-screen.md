# Handoff FE — Reportes con desglose (ventas y flujo de pacientes)

Estado: listo para construir · 2026-11-10 · BE: `cmr-be` rama `feat/reporting-breakdowns`
(spec `cmr-be/docs/specs/reporting-breakdowns.md`). Ya disponible también para Claude por MCP.

## Qué hay en el API (v2, permiso `estadisticas.read`)

### `GET /api/v2/statistics/sales-breakdown?from&to&by[&contexto][&centerIds]`

`by` = `clinic | day | month | hour | doctor | product`. Respuesta:

```jsonc
{ "from": "2026-11-01", "to": "2026-11-30", "by": "clinic",
  "rows": [ { "key": "<id o fecha o hora>", "label": "CMR Caguas", "invoices": 1, "patients": 1,
              "gross": 200, "refunds": 0, "net": 200 /* , "quantity": 4 en product */ } ],
  "total": { "key": "total", "invoices": 3, "patients": 3, "gross": 350, "refunds": 0, "net": 350 } }
```

- `day` = `YYYY-MM-DD`, `month` = `YYYY-MM`, `hour` = `"00"`…`"23"` (cuándo se COBRÓ, hora de Puerto
  Rico; suma pagos, no facturas). Filas de tiempo en orden; las demás por neto, mayor primero.
- `doctor` puede traer una fila `key: null` (facturas sin médico): mostrarla como «Sin médico».
- Una devolución resta en SU fecha y centro: una fila puede quedar en negativo.

### `GET /api/v2/statistics/patient-flow?from&to[&by][&centerIds]`

`by` = `total` (por defecto) `| clinic | day | month`. Por fila, PERSONAS distintas: `came`, `new`,
`returning`, `bought`, `cameAndBought`, `newAndBought`, `boughtWithoutVisit`.

- Vino = cualquier visita (cita que llegó o sesión de frontdesk). Nuevo = primera visita de su vida
  en el rango (ningún centro antes). Compró = factura emitida en el rango.

## Pantalla sugerida (Estadísticas › Ventas y pacientes)

- Barra: rango de fechas, selector de centros (`centerIds`, como el resto de reportes), y para
  ventas el selector «Ver por» (Centro / Día / Mes / Hora / Médico / Producto) y División
  (Consulta / General / Ambas).
- Ventas: tabla con las columnas de la fila + fila total fija; gráfico de barras para
  `day | month | hour` (serie de tiempo) y de barras horizontales para el resto.
- Pacientes: tarjetas con el total (vinieron, nuevos, recurrentes, compraron, compraron sin
  visita) y, con «Ver por», tabla + barras apiladas nuevos/recurrentes.
- Montos con el formato de dinero de la app; etiquetas por i18n (es/en). Usar toda la pantalla.
- Menú: bajo Estadísticas, visible con `estadisticas.read`.

## No hace falta

- Ningún cálculo en el cliente: los totales y los distintos ya vienen hechos (no sumar filas para
  `patients`/`invoices`: una persona puede estar en varias filas).
