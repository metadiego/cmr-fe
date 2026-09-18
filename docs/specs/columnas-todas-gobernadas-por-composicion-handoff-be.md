# Toda columna debe ser gobernada por la composición (add/remove/hide/reusable) — handoff BE

**Regla del dueño (desde el día 1, reiterada 18-sep-2026):** TODAS las columnas de cualquier tablero
deben poder **crearse, agregarse, quitarse y ocultarse fácilmente** desde el editor, y ser
**reusables en cualquier tablero**. Sin columnas "especiales" que el usuario no pueda tocar.

## El defecto (verificado)

En `/boards/atencion` la columna **DiasDeRetraso** (`clave: diasDeRetraso`, `binding:
computed.diasDeRetraso`, `labelKey: tablero.compute.diasDeRetraso`, en `citas.resolvers.ts` /
`CITAS_COMPUTES`) **se pinta en el tablero** (aparece como header) pero **NO es gobernable desde el
editor de composición** (`/configuration/boards/atencion`):

- En el editor, «In this board» (la composición) **no la lista**; aparece solo bajo «Add from
  catalog». Al pulsar «Add» **no queda compuesta** (no entra a la composición). → el usuario **no la
  puede quitar ni ocultar** como al resto.
- Las columnas del tablero salen de `citasService` → `tableroSvc.columnasEfectivas('atencion')` +
  `proyectar(..., CITAS_RESOLVERS)` (`src/modules/citas/citas.service.ts:428,635,720`). Las columnas
  **computadas/derivadas** (diasDeRetraso, duracionMin, cicloMin) entran por el registro de resolvers,
  no por la composición, así que `columnasEfectivas` las devuelve **al margen** de lo que el editor
  compone/oculta.

Resultado: hay columnas que el tablero muestra pero el editor no controla → rompe la regla.

## Pedido al BE

Que **`columnasEfectivas` (y por ende `/board/rows`) arme las columnas SOLO desde la composición
efectiva del tablero**, para TODAS por igual:

1. Las columnas **computadas/derivadas** (diasDeRetraso, duracionMin, cicloMin, …) deben existir como
   **columnas de catálogo normales** (ya casi lo son: `dias_de_retraso` sale en «Add from catalog») y
   **respetar `visible`/`active`/`sortOrder`/`pinned` de la composición**. No deben inyectarse aparte.
2. Que **agregar/quitar/ocultar** cualquier columna desde el editor (`setComposicion`/composición
   efectiva) **afecte de verdad** lo que pinta el tablero — incluidas las computadas. Hoy «Add» de
   DiasDeRetraso no compone nada.
3. Que toda columna sea **reusable en cualquier tablero** (ámbitos), sin lógica especial por columna.

## Inmediato

Ocultar **DiasDeRetraso** del tablero de **atención** (no borrar). Con lo anterior, será cuestión de
dejarla fuera de la composición / `visible:false`. Mientras se arregla el fondo, si el BE la puede
sacar de la composición efectiva de `atencion`, listo.

FE: el editor de composición ya maneja bien las columnas normales (`setComposicionBulk` con
`visible/sortOrder/pinned/active`). El hueco está en que las computadas no pasan por ahí. Cuando el BE
las haga composición-governed, el editor ya las agrega/quita sin más cambios en el FE.
