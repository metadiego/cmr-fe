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
