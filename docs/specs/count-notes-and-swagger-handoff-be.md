> **RESUELTO por el BE, 9-oct-2026 12:41 AST — en producción (commit `07bd13d`) y verificado por HTTP real (Bayamón, v2):**
>
> 1. **`notes`** (opcional, ≤500) en `POST /inventory/operations/count` (y en la herramienta MCP). Encabeza la
>    nota del ajuste: «<notes> — Conteo físico: contado X vs sistema Y». Probado: Tirzepatide `countedQuantity
>    1585` + `notes` → 201 `{contado:1585, sistema:1585, difference:0}` (sin diferencia no hay ajuste, no se
>    guardó nada). Ya puedes mostrar el «Por qué» también en modo viales.
> 2. **Respuesta en Swagger:** `201 → PhysicalCountResponseDto` con las claves de v2: `contado`, `sistema`,
>    `difference`, `ajuste?`, `breakdown?[{presentationId, presentation, containers, inBaseMeasure}]`.
>    Regenera `gen:api` y borra el tipo a mano.
> 3. **`warehouseId` en cada fila** de `GET /inventory/stock/summary` (y en cada lote): el del almacén donde está
>    el stock si es UNO; si la fila no tiene stock, el del filtro o el único del centro; `null` solo si está
>    repartida en varios. Bayamón **sin filtro**: 63 filas, 63 con `warehouseId`. El botón Ajustar ya puede usar
>    el de la fila.

# Handoff BE — Conteo en viales: el «por qué» y la respuesta en Swagger

**De:** FE · **Para:** cmr-be · **Fecha:** 2026-10-09 · **Prioridad:** baja (el FE ya funciona).

El FE del conteo en viales está en producción (commit `d7843d3`) y verificado en el navegador sobre
Tirzepatide + B6 de Bayamón: 16 + 10 viales → la vista previa dice 1585 mg, igual que el sistema (no se
guardó nada).

1. **`ConteoFisicoDto` no tiene notas.** El ajuste normal exige «Por qué» (`notes`) porque «un ajuste
   sin explicación es otro descuadre»; el conteo por viales no tiene dónde mandarlo, así que hoy el FE
   lo oculta en ese modo. Pedido: `notes` (opcional) en el DTO, guardado en el movimiento de ajuste
   que genera el conteo.
2. **La respuesta no está declarada** (`201: Record<string, never>`). El FE la tipa a mano desde la
   respuesta real del handoff (`contado`, `sistema`, `difference`, `breakdown`, `ajuste`). Pedido:
   declararla en Swagger para que `gen:api` la genere.
3. Visto de paso: `GET /inventory/stock/summary?warehouseId=…` devuelve las filas con
   `warehouseId: null` aunque se filtre por un almacén. El FE ya lo rodea (usa el del filtro); si la
   fila trajera su almacén, el botón Ajustar funcionaría también sin filtrar cuando el centro tiene
   uno solo.
