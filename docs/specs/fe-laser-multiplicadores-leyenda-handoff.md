# Handoff FE — Láser/terapias: días × áreas + leyenda en la factura

**BE listo (PR #95, prod).** Las terapias de láser ya están en el grupo `laser` → capturan `areas`/`dias`.

## Datos (en `GET /facturas/:id`, por ítem)
- `item.cantidad` = base (normalmente 1).
- `item.meta.multiplicadores` = `{ "areas": 2, "dias": 12 }` (claves = columnas del grupo, rol multiplicador).
- **Cantidad efectiva** (lo que se cobra) = `cantidad × Π(multiplicadores)` → ej. 1 × 12 × 2 = **24**.
- `item.total` ya viene con la cantidad efectiva aplicada.

## Qué pintar
1. **Columna cantidad** de una línea de láser = cantidad EFECTIVA (24), no la base (1).
2. **En una sola línea** (usar la pantalla eficiente): `24 ses. (12 días × 2 áreas) × $70.00`.
3. **Leyenda** al pie (una por terapia con multiplicadores), formato legacy:
   `*<descripción> Corresponden a {dias} días de terapia en {areas} área(s)`

## Sin hardcode
- Las claves (`areas`, `dias`, `dosis`, `sesiones`) y sus **labels** salen de `columnas_facturacion`
  (labelKey i18n: `fac.col.areas`, `fac.col.dias`, …). Recorrer `meta.multiplicadores` — NO asumir
  que siempre son 2 ni que se llaman así; el grupo define qué multiplicadores tiene.
- `dosis`/`sesiones` son **informativas** (no multiplican) en los grupos `producto`/`suero`; `areas`/`dias`
  SÍ multiplican en `laser`. El rol viene del esquema del grupo (`GET /facturas/tablero` o el endpoint de columnas).

## Grid del POS (captura)
Al agregar una terapia de láser, la fila muestra las columnas del grupo `laser`: producto · lista ·
**áreas** · **días** · cantidad · precio · descuento · impuesto · subtotal. Todo en una fila (eficiente).

## Aceptación
- Línea de láser muestra cantidad efectiva + "(N días × M áreas)" en una sola línea.
- Leyenda al pie por cada terapia con multiplicadores.
- Cambiar días/áreas recalcula cantidad efectiva y total (el BE ya lo hace al re-agregar/editar).
