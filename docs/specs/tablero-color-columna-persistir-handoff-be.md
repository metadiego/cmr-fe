# RESUELTO — Color por columna del tablero (diagnóstico corregido)

> ⚠️ El diagnóstico original de este handoff era INCORRECTO. Lo dejó claro el dueño (2026-07-29):
> el BE **sí persistía y sí exponía** el color. Se verificó en producción.

## Causa real
El FE escribió el color en el tablero **`servicios`** (el vertical) pero lo leyó en **`vitc`**, que es
**otra composición**. Por eso `GET /tablero/definicion?tablero=vitc` no mostraba el color: no era el mismo
scope donde se escribió. No fue un fallo de persistencia del BE.

## Solución (BE, en rama, sin mezclar — pasa review de gstack antes)
El color ahora se declara **una sola vez en el catálogo de la columna** y lo **heredan los ~20 tableros**,
con posibilidad de **pisarlo por tablero**. Así no hay que repetir el color en cada composición.

## FE (ya listo)
El board pinta con prioridad `columna.color → render.color → color del estado del flujo` (pills + leyenda).
En cuanto la rama del BE se mezcle, **re-verificar** que `GET /tablero/definicion?tablero=vitc` devuelve el
`columna.color` heredado del catálogo, y que los colores del flujo salen de ahí (configurables por API, sin código).
