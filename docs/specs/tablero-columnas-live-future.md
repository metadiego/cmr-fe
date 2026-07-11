# Futuro (BE + FE) — Columnas del tablero en vivo (SSE)

**Estado:** DIFERIDO por el usuario (2026-07-11). No implementar hasta que se pida.

## Qué
Hoy la **definición de columnas** de un tablero se carga UNA vez al abrir (`getDefinicion`, dep `[tablero]`).
El SSE (`useCitaStream`) solo refresca **filas** (`onInvalidate: filasRes.refresh`). Por eso, componer/quitar
una columna vía API **no aparece en vivo** — hay que recargar.

## Para hacerlo live
- **BE:** emitir en `/tablero/stream` un evento de "definición cambió" (p.ej. `definicion_actualizada` con
  `{tablero, centroId}`) cuando cambie la composición/catálogo/estados/transiciones de ese tablero.
- **FE:** en `components/tablero/generic-board.tsx`, que `useCitaStream` (o un handler nuevo) haga
  `defRes.refresh()` al recibir ese evento (además del `filasRes.refresh` actual).

## Nota de diseño
La composición es config de admin que casi no cambia → cargarla una vez es razonable. Esto solo aporta
si se editan columnas con el tablero abierto y se quiere ver el cambio sin recargar.
