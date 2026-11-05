# Citar para hoy a un paciente con otra cita viva: nace «programada» y no se ve — handoff FE → BE

**Fecha:** 2026-11-05 · **Urgente.** Lo reportó Laesi, de Caguas: «para citar a un paciente hay que
hacerlo dos veces para que aparezca en la tabla». El dueño: «desde donde sea NO debería insistir».

## Evidencia (prod, Caguas, 05-nov)

Cinco citas creadas DOS veces por Laesi, con 15 a 34 s de diferencia: 055b23db, 77284443,
f0a7ecb6, 6bf39271 y a7b4013a. Historial de 055b23db:

- 12:05:14 `creada`, payload `{ reprogramadaDeId: 37c31f14… }`. **Es un reagendamiento.**
- 12:05:36 `corregida`, el segundo POST.
- 12:05:44 `consulta`.

## Causa (BE)

`CitasService.create` → `laCitaQueLlegaContraLaViva`: si el paciente ya tiene una cita viva en
**otra fecha**, no crea una cita, la **reagenda**. `reagendar()` crea la copia con
`estado: 'programada'` (citas.service.ts ~l.1104) e **ignora el `estadoInicial`** que pidió el alta
(`confirmada`, o `presente` en un seguimiento de mostrador).

El tablero de Atención **no muestra las programadas**. Hoy hay 7 programadas fuera del tablero y
0 dentro. Al segundo POST, la cita viva ya es de hoy y se «corrige» con el estado pedido, y entonces
aparece.

## Lo que se pide

Cuando el alta termina en reagendamiento, la cita nueva debe nacer con el **mismo estado inicial
que habría tenido un alta normal** (`elEstadoInicial`: confirmada, o presente por mostrador), con
su estampa y su candado.

## FE mientras tanto (commit de este handoff)

`createCita` (`lib/api/citas.ts`): si pidió `confirmada` y vuelve `programada`, ejecuta la acción
`confirmar` del tablero en el acto. Es lógica pura y probada en `lib/citas/requested-status.ts`. Se
quita cuando el BE respete el estado.
