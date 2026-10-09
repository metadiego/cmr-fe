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
