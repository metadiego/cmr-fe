# Handoff FE → BE — banderas de prioridad de VARIOS pacientes en una llamada

**Fecha:** 2026-10-10 · **De:** cmr-fe · **Para:** cmr-be

## Por qué

En el Escritorio del paciente (`/boards/patient-desk`) el dueño pidió que las banderas de prioridad
(oxígeno, silla de ruedas…) se vean en la LISTA de la izquierda, a la derecha del número de récord, sin
tener que seleccionar al paciente. Hoy solo existe `GET /api/v2/patients/{id}/priority-flags`, así que el
FE hace **una llamada por paciente** del día (≈30 en Caguas/Bayamón). Funciona, pero no es el endpoint
correcto.

## Qué se pide

`GET /api/v2/patients/priority-flags?patientIds=<uuid>,<uuid>,…`

- Respuesta: `{ data: Array<{ patientId: string; flags: PatientPriorityFlag[] }> }`, con
  `PatientPriorityFlag` igual que el endpoint por paciente (`slug, labelKey, icon, color, note, …`).
  Pacientes sin banderas pueden omitirse o venir con `flags: []`.
- Mismo permiso que el de lectura por paciente; respeta `X-Tenant-ID` y el parámetro opcional de
  centros (estatuto de permisos por centro).
- Tope razonable de ids por llamada (p. ej. 200) → 400 con labelKey si se excede.
- Swagger + comentarios, como siempre.

## Lo que hace el FE cuando esté

Solo cambia `hooks/use-patients-priority-flags.ts`: una llamada en vez de N. El resto de la pantalla no
se toca.
