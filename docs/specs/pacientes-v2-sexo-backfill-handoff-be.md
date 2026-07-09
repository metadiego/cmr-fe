# Handoff BE — `sexo`: backfill v2 NO corrió + `sexoLabel` no resuelve legacy

**Fecha:** 2026-07-09 · **De:** FE (cmr-fe) · **Para:** BE (cmr-be)
**Contexto:** migración FE a Pacientes v2 (`docs/plans/pacientes-v2-migracion-fe.md`). El rename
`numeroHistoria → record` quedó **cerrado y verificado** en el FE. El problema está solo en `sexo`.

## Qué prometía el handoff v2 (y NO se cumple en prod)
> "El backfill del BE ya convirtió los datos viejos (M→masculino, F→femenino). La respuesta trae
> `sexoLabel` ya resuelto."

## Qué encontré dogfoggeando prod (token master + UA navegador, tenant Caguas)
`GET /api/v1/pacientes?limit=40`:
- **`sexo` sigue en códigos legacy**: valores reales `"0"`, `"1"`, `null` — NO `femenino/masculino`.
  Distribución de la muestra: `"0"` ×17, `"1"` ×20, `null` ×3.
- **`sexoLabel` = `null`** para todos esos registros (no resuelve los códigos legacy; solo resolvería
  si `sexo` ya fuera uno de los strings del enum).
- Además `sexoLabel` y `edad` **no están declarados** en el `PacienteEntity` del `docs-json`
  (el `schema.d.ts` regenerado no los trae, aunque la API sí los devuelve). Documentarlos en el DTO.

## Contrato de escritura (verificado con PUT sobre paciente de test `c5f6d3a4…`)
| payload | HTTP |
|---|---|
| `{"sexo":"femenino"}` | **200** ✅ (acepta el enum nuevo) |
| `{"sexo":"0"}` (legacy) | **400** ❌ |
| `{"sexo":"M"}` (viejo) | **400** ❌ |
| `{"sexo":null}` | **200** ✅ |

## Impacto y qué hizo el FE mientras tanto (no destructivo)
- **Riesgo evitado:** editar un paciente legacy (sexo `"0"`/`"1"`) reenviaría ese valor → **400, la
  edición falla**. El FE ahora **coerciona en carga**: si `sexo` ∉ enum, el select queda vacío y en el
  submit se **omite** `sexo` (no se envía) → el BE conserva el valor legacy y el guardado no rompe.
  Al elegir el valor en el select, el registro se migra a un valor limpio de forma incremental.
- **Display:** para registros legacy la vista de detalle muestra "—" en Sexo (igual que antes; no es
  regresión). Se corrige solo cuando el dato quede limpio.

## Pedido al BE (elige una; A es la buena)
- **A (recomendado):** correr el backfill real `0/1/… → masculino/femenino/otro/desconocido` en
  **todos los tenants**. Confirmar el mapeo exacto de códigos (`"0"`=? `"1"`=?) — el FE NO lo asume.
- **B:** que la API **acepte también** los códigos legacy en el enum de escritura (evita 400) **y** que
  `sexoLabel` los resuelva. Menos limpio; deja datos mixtos.
- Independiente de A/B: **declarar `sexoLabel` y `edad`** en el `PacienteEntity` del OpenAPI.

**El FE no bloquea** (ya es robusto), pero el Sexo no se verá correcto en datos existentes hasta A/B.
