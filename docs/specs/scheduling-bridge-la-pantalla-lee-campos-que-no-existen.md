# El puente dice «Falló» y no falló: la pantalla lee campos que no existen

**De:** cmr-be. **Fecha:** 2026-09-22.

En `/configuration/scheduling-bridge` las dos tarjetas muestran **«Falló»** en rojo y los contadores
vacíos («creadas · actualizadas · canceladas», sin números).

**El motor está bien.** Verificado en producción a la misma hora que la captura: las últimas corridas
de los dos centros traen `errorCount: 0` y `firstError: null`, y una de ellas creó una cita.

## La causa

`lib/api/scheduling-bridge.ts` declara `SyncRun` con `ok`, `created`, `updated`, `cancelled` y
`error`. El BE **nunca** ha servido esos nombres. Lo que sirve `GET /scheduling-bridge/status` (y
`/runs`), en v1 y en v2, es:

```
startedAt, finishedAt,
createdCount, updatedCount, cancelledCount, skippedCount,
errorCount, firstError
```

Como `lastRun.ok` llega `undefined`, es falso → se pinta «Falló»; y `lastRun.created` llega
`undefined` → el contador sale en blanco. Es un desajuste de contrato, no un fallo del puente.

## Qué cambiar en el FE

- `ok` → **`errorCount === 0`**. Y si se quiere enseñar el motivo cuando sí falla, ahí está
  `firstError`.
- `created` → `createdCount`; `updated` → `updatedCount`; `cancelled` → `cancelledCount`.
- Vale la pena enseñar también **`skippedCount`**: en una corrida normal es el número grande (las
  citas que ya estaban), y sin él parece que el puente no hace nada.

El BE no cambia: los nombres actuales son los que describen lo que pasó y los que ya consumen el MCP
y los informes.

## Los ficheros y las líneas exactas (verificado en `main`, 22-sep-2026 13:05)

Tres sitios, ninguno tocado todavía:

1. **`lib/api/scheduling-bridge.ts`** — el tipo `SyncRun`, líneas 36-40: `ok`, `created`, `updated`,
   `cancelled`, `error`. Ninguno de esos nombres existe en la respuesta. Hay un segundo `ok` en la
   línea 48. Cámbialos por `createdCount`, `updatedCount`, `cancelledCount`, `skippedCount`,
   `errorCount`, `firstError`.
2. **`components/configuracion/scheduling-bridge-status-cards.tsx`** — líneas 68-73. Es lo que pinta
   «Falló» en rojo y deja los contadores vacíos, que es lo que el dueño está viendo en pantalla.
3. **`components/configuracion/scheduling-bridge-runs-log.tsx`** — líneas 35, 38 y 40, el mismo
   problema en la tabla de corridas.

`ok` no viene del BE y no va a venir: se deriva con **`errorCount === 0`**.

Comprobado contra producción a las 13:05: las últimas corridas de Bayamón y Caguas tienen
`errorCount: 0`, `firstError: null` y `skippedCount: 151`. La pantalla dice «Falló» igualmente.
