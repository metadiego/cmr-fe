# Próxima cita desde el tablero: siempre SEGUIMIENTO — handoff FE → BE

**Fecha:** 2026-11-04 · **FE:** `47c865c` y siguiente (en producción)

## Qué hay ya

En el tablero de Atención, la celda «Próxima cita» (columna `prox_cita`, `render.kind = "nextAppointment"`)
se abre en un panel. Ese panel muestra la próxima cita del paciente y permite cambiarla con atajos
(1 semana, 2 semanas, 1 mes, 3 meses) o con el calendario.

- Si el paciente **no tiene** próxima cita, se crea con `POST /appointments`, tipo `seguimiento` y
  estado `confirmada`.
- Si **ya tiene** una, se mueve con `POST /appointments/:id/reschedule`.

## Regla del dueño (04-nov-2026)

**Toda cita que se da o se modifica desde ahí es de tipo SEGUIMIENTO.** El dueño la marcó como muy
importante.

## El hueco

`ReagendarCitaDto` (`date`, `time`, `reason`, `centerId`, `doctorId`, `actorId`) **no admite el tipo**.
El BE copia `tipoCitaId` de la original (`citas.service.ts`, `reagendar`), y `UpdateCitaDto` tampoco
tiene `appointmentTypeId`. Desde el FE no hay forma de dejar como seguimiento una cita movida que era de
otro tipo.

Mientras tanto, el FE **solo deja mover las citas que ya son de seguimiento**. Si la cita es de otro
tipo, el panel lo explica y no ofrece moverla.

## Lo que se pide

`appointmentTypeId?: uuid` opcional en `ReagendarCitaDto`:
- si viene, la cita nueva lleva ese tipo;
- si se omite, se mantiene el comportamiento actual, que copia el tipo de la original;
- el evento `reprogramada` debería registrar el tipo antes y después, para que quede en la traza.

Cuando esté en producción, el FE enviará siempre el id de `seguimiento` al mover y quitará el bloqueo.
