# Handoff BE — El técnico llega VACÍO en el refresh en vivo del tablero (frontdesk)

> **Fecha:** 2026-07-22 · **Origen:** FE cmr-fe · **Destino:** cmr-be módulo `frontdesk` (+ bus SSE)
> **Status:** SOLICITADO · **Prioridad:** alta (dato operativo que se ve "borrado" en vivo).
> Regla: NUNCA ASUMIR, verificar en profundidad. Abajo, evidencia en código (FE y BE).

## 1. Síntoma (reproducido en prod)

Se asigna un técnico a una sesión (p. ej. "Richard"/"Eduardo"). Se ve por 1-3 s y luego la celda queda
**EN BLANCO**. Si se **recarga la página manualmente, el técnico SÍ aparece**. O sea: **se guarda bien**,
pero el refresh EN VIVO lo devuelve vacío.

## 2. El FE NO es el culpable (verificado)

- El board sale de `getFrontdeskTablero(clave, fecha, centro, rango)` → `GET /api/v1/frontdesk/tablero`.
- El evento en vivo (bus `/tablero/stream`, entidad `sesion`) solo dispara `refetch()` =
  `boardRes.refresh()` (una LLAMADA NUEVA al mismo GET). El FE no transforma ni cachea: pinta lo que
  el GET devuelve. Como el reload manual muestra el técnico, el FE renderiza fielmente ⇒ el GET que
  dispara el evento en vivo está devolviendo `fd_tecnico` vacío.

## 3. Dónde está (evidencia en el BE)

- `frontdesk.resolvers.ts:31` → `'tecnico.nombre': (s, ctx) => s.tecnicoId ? (ctx.personal?.[s.tecnicoId] ?? null) : null`.
  La celda del técnico se resuelve por `s.tecnicoId` + el mapa `ctx.personal`.
- Por tanto, el GET del tablero devuelve vacío si, en ESE instante, o bien
  (a) `s.tecnicoId` **aún no está visible** para la lectura (el evento en vivo se emite/consume ANTES de
     que la escritura del técnico haga COMMIT → read-after-write no consistente), o
  (b) `ctx.personal` **no incluye** el id del técnico recién asignado (el mapa se arma con un set de ids
     que no contempla al nuevo).
- El reload manual ocurre más tarde (ya commiteado / mapa recompuesto) → resuelve el nombre. Eso explica
  por qué en vivo sale vacío y al recargar aparece: es una **carrera de simultaneidad del envío en vivo**.

## 4. Lo que se pide (BE)

1. **Emitir el evento SSE del tablero DESPUÉS del COMMIT** de la asignación de técnico (y de cualquier
   edición que el tablero refleje). El aviso no debe adelantarse a la transacción.
2. Garantizar **read-after-write** en `GET /frontdesk/tablero`: tras asignar `tecnicoId`, un GET inmediato
   debe traer `fd_tecnico` resuelto (revisar que `ctx.personal` se arme con TODOS los `tecnicoId`/
   `enfermeraId` de las sesiones devueltas, incluido el recién asignado; sin cache stale por request).
3. (Si aplica) que el payload del evento no viaje "vacío": el consumidor solo refetotea, pero conviene
   confirmar que el evento corresponde a la sesión correcta y post-commit.

## 5. Criterio de aceptación / TDD (BE)

1. Test de integración: crear sesión → asignar `tecnicoId` → `GET /frontdesk/tablero` **inmediato** →
   `fd_tecnico` = nombre del técnico (no null).
2. E2E en prod: asignar técnico en el frontdesk y que **NO** se borre a los segundos (sin recargar).
3. El evento SSE se emite tras el commit (verificable por orden de logs/timestamps).

## 6. Nota FE

El FE queda en su comportamiento base (revertido el intento de "overlay optimista" que no correspondía).
Cuando el BE confirme el fix, se valida en vivo. Si el negocio lo pide, el FE puede además pintar el
valor de forma optimista, pero la causa raíz es la simultaneidad del envío en vivo (BE).
