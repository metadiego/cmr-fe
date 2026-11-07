# Seguimiento solo si ya fue atendido en consulta médica (handoff FE → BE)

**Fecha:** 7-nov-2026 · **Reportado por:** Caguas: «Lillian Figueroa Lozada, el 16041, me sale como
seguimiento cuando es consulta nueva». **Regla del dueño (7-nov):** «hay solo una manera de que el
paciente sea de seguimiento».

## La regla

Es la frase de fondo del dueño el 22-sep (`cmr-be/docs/specs/un-paciente-conocido-es-seguimiento.md`):
«si el paciente **ha venido a consulta médica y fue debidamente atendido y asistido**, … es
Seguimiento». **Esa es la única señal.** Tener récord o tener médico asignado ya no prueba que el
paciente haya venido.

## El caso (verificado en producción)

- Paciente `49836da7-2add-428e-a25a-1979bd827c55`, creada el **6-nov a las 12:36:11**, ya con récord
  `16041` y con `doctorId`.
- Cita `e4f53c87-3ebf-450e-9879-1f03231633f3` (Caguas, 7-nov 08:00):
  - creada a las **12:36:18**, siete segundos después de la paciente, por Vanessa Cladio;
  - `channel: webhook`, `legacyOrigin: scheduling-server`;
  - **tipo seguimiento**, `isFirstVisit: false`.
- No hay ninguna cita anterior atendida, ni en Caguas ni en Bayamón. En Bayamón hay otra ficha suya
  sin récord (`2a349fa0-…`, del 19-oct), sin citas.
- Hoy quedó `atendida` y facturada como seguimiento: F001109, $20, ATH. La próxima, el 21-nov, ya es
  seguimiento de verdad.

**Causa (corregida por el BE, 7-nov, contra producción):** la sincronización de la hoja la trajo con
`legacy_id CAGUAS_MEDICA_2026-11-07_8:00_7`. A las 8:00, Caguas tiene 7 cupos NUEVO (índices 0 a 6), así
que el 7 es un cupo **SEGUIMIENTO**. El tipo sale de la columna TIPO de la hoja: **el call center la
agendó en un cupo de seguimiento**. Mi primera hipótesis («la señal de récord la convirtió») era un
supuesto y **no** es la causa.

**Hueco que queda:** el CMR copia el tipo de la hoja sin contrastarlo con los datos. Con la regla del
dueño, una paciente sin ninguna consulta atendida **no puede ser seguimiento**, aunque el call center
la ponga en ese cupo. La hoja es una intención; el hecho lo dan los datos (la misma idea del 22-sep,
aplicada al revés).

## Lo que se pide al BE

1. **Una sola regla, en `create()` y en la sincronización de la hoja:** seguimiento **solo** si el
   paciente tiene una cita médica anterior en estado `atendida` (atendido y asistido), sin contar la
   cita que se está creando o moviendo. Sin ninguna → `nueva`, diga lo que diga la hoja. Quitar las
   señales «récord» y «médico asignado» (decisión del 22-sep). **Antes de cambiarla, el BE la confirma
   con el dueño**, porque reemplaza una decisión documentada.
2. **Reparar la cita de Lillian** (`e4f53c87-…`): tipo `nueva` y `isFirstVisit: true`, por
   `POST /citas/:id/reparar` con motivo. Que la regla nueva no la vuelva a pasar a seguimiento por su
   propia atención.
3. **Revisar los dañados:** citas `seguimiento` o con `isFirstVisit: false` cuyo paciente no tenía
   ninguna cita atendida antes de esa fecha. Pasar la lista al dueño **antes** de repararlas, porque
   mueve el conteo de nuevos y las comisiones de captación.
4. **La factura F001109 no se toca.** El dueño (7-nov): solo cambia el tipo de la cita.

## Verificación

- `GET /appointments/e4f53c87-…`: tipo nueva, `isFirstVisit: true`.
- En el tablero de Atención de Caguas del 7-nov, Lillian sale como **Nueva**.
- Prueba: un paciente nuevo, con récord y médico desde el alta, agendado en el turno de NUEVO sale
  como `nueva`. Con una cita atendida anterior sale como `seguimiento`.
