# HANDOFF BE — Persistir y exponer el COLOR por columna del tablero

> Competencia BE. El FE ya lo consume (pinta `columna.color` en pills y leyenda del flujo). Falta que el
> BE lo guarde y lo devuelva en la definición.

## Síntoma (verificado en prod)
- `POST /api/v1/tablero/composicion` con `{ tablero:"servicios", columnaId, color:"#3b82f6" }` responde **ok**,
  pero `GET /api/v1/tablero/definicion?tablero=vitc` devuelve la columna con `color: null` (no persistió),
  y tampoco aparece en `render.color`.
- Por eso el color del flujo hoy se resuelve en el FE desde la paleta de estados (no configurable por columna).

## Pedido
1. **Persistir** el `color` por columna del tablero (composición por tablero y/o por servicio) cuando llega en
   `POST /tablero/composicion` (y en la composición por servicio `POST /servicios/:id/columnas` si aplica).
   `null` = limpiar (heredar). Multi-tenant / por centro como el resto de la composición.
2. **Exponer** ese `color` en `GET /tablero/definicion` (y en `GET /servicios/:id/columnas`) como campo de la
   columna (`columna.color`) — no solo aceptarlo.
3. Idempotente; no romper composición existente (orden/visible/render intactos).

## FE (ya listo)
El FE pinta con prioridad `columna.color` → `render.color` → color del estado del flujo. En cuanto el BE
persista y devuelva `columna.color`, los colores del flujo pasan a ser **configurables por API por columna**
(pills + leyenda), sin tocar código. Commit FE que lo consume: board `frontdesk-board.tsx`.
