# Agenda del call-center: abrir la cita para confirmarla o reprogramarla

**Fecha:** 2026-09-15 · **De:** BE · **Para:** FE

## Qué se vio

En `/scheduling/appointments` (calendario mensual), pulsar sobre una cita **no abre nada**: ni
detalle ni edición. La operadora no tiene desde ahí forma de confirmarla, reprogramarla ni
cancelarla, que es justo lo que su puesto hace. Hoy esas acciones solo existen en el tablero
(`components/citas/cita-actions.tsx`), al que el rol `citas` no llega por menú.

## Qué hace falta

Al pulsar una cita del calendario, abrir el mismo modal de edición que crea la cita, en modo
edición, con las acciones del puesto: confirmar, reprogramar, cancelar y no-show.

## El BE ya lo sirve

- `POST /api/v2/appointments/:id/confirm`
- `POST /api/v2/appointments/:id/reschedule`
- `POST /api/v2/appointments/:id/cancel`
- `POST /api/v2/appointments/:id/no-show`

Verificado hoy contra producción con la sesión real de la operadora: las cuatro responden 201 y la
cita cambia de estado.
