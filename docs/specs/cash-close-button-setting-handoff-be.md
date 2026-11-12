# Handoff BE — interruptor por centro: «Procesar cierre» del cuadre de caja

Fecha: 2026-11-12 · Pedido del dueño: ocultar el botón «Procesar cierre», **por endpoint** (no a mano
en el FE).

## Verificado (cmr-be origin/main)

- Cerrar (`caja.service.ts` `cerrar`) congela `totalesPorMetodo`, `efectivoEsperado`, `diferencia` y,
  en la hoja del día, el `countMode`. Reabrir (`reabrir`) limpia esos valores.
- La firma (`cash-sign-off.service.ts`) ya está pensada para días que **no** se cierran: cada firma
  guarda sus cifras.
- Sin cierre, `invoice-reopening.service.ts` `cashClosed` nunca avisa «la caja de ese día ya se cerró».
- Un día abierto sigue el modo de conteo actual del centro; uno cerrado guarda el modo con el que se
  cerró.

## Pedido

Un ajuste por centro, junto al modo de conteo (`/cash/count-mode`, BE #566), o en su propio recurso
si lo prefieres:

- `closeEnabled: boolean`. Por defecto `true`, para no cambiar nada a quien no lo toque.
- GET con `caja.read`; PUT con la misma concesión explícita que el modo (`caja.count_mode`).
- Con `closeEnabled = false`, `POST /cash/reconciliations/:id/close` y
  `POST /cash/total-reconciliation/:id/close` responden **409** con un `labelKey` (por ejemplo
  `caja.error.closeDisabled`). Así la API, el MCP y la pantalla dicen lo mismo.
- Los cuadres que ya están cerrados no cambian; «Reabrir» sigue igual.
- Swagger, MCP, comentarios en la base de datos y tests.

## FE (cuando esté publicado)

- `ResumenPagos` no pinta «Procesar cierre» si `closeEnabled` es `false`, ni en el cuadre del cajero ni
  en el cuadre total.
- Interruptor «Mostrar Procesar cierre» en Configuración → Modo de conteo.
- Claves i18n en es y en.
