# Comparación de catálogo y precios — legacy (MSSQL) vs cmr-be — 2026-10-02

Investigación de solo lectura (SELECT contra el MSSQL del legado + GET contra la API de
producción). No se modificó ningún dato en ningún sistema.

## Metodología (verificado)

- Precio legacy = tabla `MPrecios` con `codtipre='00'` (lista "Detal"), cruzada con
  `MInventario` por `coditems` — la única autoridad de precios según el propio equipo de
  `cmr-be` (`docs/specs/precios-legacy-faltantes.md`, `src/scripts/migrate-legacy-catalogo.ts`).
- Conexión real a ambos SQL Server (Bayamón y Caguas, son físicamente distintos) con las
  credenciales ya presentes en `cmr/app/Config/config.php`.
- Precio nuevo = `GET /api/v1/precios/catalogo` en producción, por centro. **Ese endpoint solo
  devuelve `activo=true`** (`precios.service.ts:109`) — los inactivos no se pudieron comparar.
- Match por SKU (`coditems`).

## Lo más grave — acción recomendada

1. **GELWH01 "Gelatina de Wharton": legacy $2,000 vs nuevo $100 (diferencia $1,900).**
   Hay un respaldo (`bkp_MPrecios_GELWH01_20260917`) que prueba que el legado subió el precio
   el 17-sep-2026 y el sistema nuevo nunca se sincronizó. No es un bug viejo: es un precio que
   cambió y quedó desfasado.

2. **Protocolo articular "FULL" ($10,020) — 4 SKUs completos faltan o están mal.**
   - `RODILLA223` existe en el nuevo sistema pero cobra **$4,000** (el precio de la variante
     BASE), cuando ese código en el legado vale **$10,020** (variante FULL).
   - `HIP223` / `ELBOW223` / `SHLDR223` (las otras 3 variantes FULL, $10,020 cada una) **no
     existen bajo ningún código** en el sistema nuevo.
   - Las 4 variantes BASE ($4,000) sí sobrevivieron, correctas, con otros nombres
     (`PROTCADERA01`, `PROTCODO01`, `PROTHOMBRO01`, y `RODILLA223` que debería ser la FULL).

3. **EXOS01 "Amnisoma": Bayamón cobra $40 de menos.** Legacy Bayamón $2,040, legacy Caguas
   $2,000, nuevo (mismo precio en ambos centros) $2,000 — coincide con Caguas, no con Bayamón.

4. **LI002 "Láser Intravenoso": sin precio en Bayamón.** Legacy $180 en ambos centros, nuevo
   tiene $180 en Caguas pero ningún precio en Bayamón.

## Productos sin precio en el sistema nuevo (existen en ambos lados, precio solo en legacy)

| SKU | Nombre | Precio legacy |
|---|---|---|
| 100GST / 80GST / 85GST / 90GST / 95GST | Suero/Vitamina C (dosis altas) | $160–$240 |
| MOTS-C | MOTS-C Acetate | $370 |
| SEMOR300 | Sermorelin 300mcg | $300 |
| TDTCLLLTP1 | Transcranial... Therapy Package | $700 |
| TIRZPATIDE | Tirzepatide | $2,000 |
| 7938698750 | Immune X (solo Bayamón) | $50 |

Las dosis de Vitamina C más chicas (10g–75g) sí están correctas — el hueco es solo en el rango alto.

## Falsos positivos descartados (coinciden, solo cambió el código)

- Legacy `0000000000`/`01` → nuevo `CONSULTA`/`SEGUIMIENTO`: precios iguales ($20/$10).
- Legacy `HIP224`/`ELBOW224`/`SHLDR224` → `PROTCADERA01`/`PROTCODO01`/`PROTHOMBRO01`: iguales ($4,000).
- `cmbimunx`/`pck1aid1`: exclusivos de Caguas en el legado también; correcto que no tengan
  precio en Bayamón.
- Las 9 diferencias Bayamón-vs-Caguas dentro del propio cmr-be (`ULTRA223`, `PCK2AA`, `APEXPCK`,
  etc.) coinciden exactas con el precio real de cada oficina en su propio legado — el sistema de
  listas por centro está funcionando bien ahí.

## Calidad general

- Bayamón: 128 SKUs en común, 101 coinciden exacto, 6 sin precio en ambos lados (consistente),
  3 difieren de verdad.
- Caguas: 131 SKUs en común, 129 coinciden, 2 difieren (los mismos globales: GELWH01, RODILLA223).

## Lo supuesto (no verificado, requiere acceso a Postgres de producción)

- Los 217 SKUs inactivos en el legado: no se pudo confirmar si existen en la base nueva como
  `activo=false` o si nunca se migraron (el endpoint usado filtra siempre por `activo=true`).
- No se comparó kits (legado solo tiene 1 kit cargado en Bayamón, dato insuficiente).
- Solo se comparó la lista "regular" (`codtipre='00'`); no mayorista/empleados/promoción.

## Fuentes

`cmr/app/Config/config.php` · `cmr-be/src/modules/precios/precios.controller.ts:32` ·
`cmr-be/src/modules/precios/precios.service.ts:88-115` ·
`cmr-be/src/scripts/migrate-legacy-catalogo.ts` ·
`cmr-be/docs/specs/precios-legacy-faltantes.md` · `cmr-be/docs/specs/migracion-legacy.md` ·
tabla legacy `bkp_MPrecios_GELWH01_20260917`
