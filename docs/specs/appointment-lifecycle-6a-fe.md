# Ciclo de vida de citas, pieza 6a — hand-off al frontend

Backend: cmr-be, rama `feat/appointment-lifecycle-6-contract` (release 6a; plan
`cmr-be/docs/plans/appointment-lifecycle-6-contract.md`). 6a no rompe nada del FE: todo lo que el FE lee hoy
sigue llegando igual. Lo nuevo es **aditivo**, y hay **una clave de error nueva** que traducir.

## Lo que hay que hacer (FE)

1. **Traducir la clave nueva `lifecycle.repair.stagesInvalid`** en `messages/es.json` y `messages/en.json`
   (namespace `lifecycle`, objeto nuevo `repair`):
   - es: «Ese estado no cuadra con las horas que tiene la fila (por ejemplo, «agendada» con hora de confirmación). Corrige las horas primero.»
   - en: "That status does not match the row's times (for example, "booked" with a confirmation time). Fix the times first."
   La devuelve un **400** con `code: LIFECYCLE_REPAIR_STAGES_INVALID` cuando una reparación (cita o sesión)
   manda `bookingStatus`/`careStatus` que contradicen las horas de la fila. Hoy el FE repara con `estado`, así
   que solo aparece ante un `estado` desconocido (antes se guardaba basura en silencio). Se muestra como
   cualquier error con `labelKey` (el toast de error ya traduce `labelKey`).

## Lo que cambia y no exige nada (para saberlo)

- **Filas de tablero, eventos en vivo (SSE) y certificados de guardado** traen además `bookingStatus` y
  `careStatus` junto a `estado`. `estado` sigue siendo la palabra de siempre y sigue siendo la **primera**
  clave de `persistencia.campos` (el toast de «guardado» la muestra igual que antes).
  - Ojo para 6b: en las filas de tablero esas dos columnas vienen **tal como están guardadas**; una fila que
    el Mac de la clínica acaba de tocar puede traerlas atrasadas (o `null`) hasta un minuto. No usarlas como
    verdad hasta que 6b lo resuelva en el backend.
- **409 `LIFECYCLE_STALE`** gana `expectedStages` / `currentStages` (se mantienen `expectedStatus` /
  `currentStatus`). Ahora salta también en reagendar, reparar sesión y fusionar la cita del día si otra persona
  movió la fila entre medias; el FE ya refresca la fila ante este código (`refusalRefreshesRow`).
- **Reparaciones**: `RepararCitaDto` / `RepararSesionDto` aceptan `bookingStatus` / `careStatus`; `estado`
  sigue aceptado (deprecado). No hace falta cambiar el FE en 6a.

## Orden

Mezclar 6a (backend) → desplegar → traducir la clave (puede ir antes; una clave sin uso no molesta).
