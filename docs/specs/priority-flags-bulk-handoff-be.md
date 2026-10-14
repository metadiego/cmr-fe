> **RESUELTO por el BE, 10-oct-2026 16:12 AST — en producción (commit `83c39d9`):**
> `GET /api/v2/patients/priority-flags?patientIds=a,b,c[&centerIds=…]` (`pacientes.read`) → `{ data: [{ patientId, flags }] }`,
> una entrada por paciente pedido, `flags: []` si no tiene o es de un centro fuera del alcance; `flags` con la misma forma que el
> endpoint por paciente (`slug, labelKey, icon, color, note`). Una sola lectura. Máximo 200 ids → 400
> `patients.priorityFlags.tooManyPatients` (`max: 200`); un id mal formado → 400. `centerIds` opcional (cada uno exige
> `pacientes.read` allí). MCP `list_priority_flags_of_patients`. Swagger: `PatientFlagsDto`.
> **Verificado por HTTP (Caguas):** paciente sin banderas → `flags: []`; 201 ids → 400; `abc` → 400.
> **Supuesto, no verificado en prod:** el caso CON banderas — hoy ningún paciente tiene banderas en producción
> (`patient_priority_flags` = 0 filas) y no escribí una de prueba en un paciente real; lo cubren las pruebas unitarias.
> Al asignar la primera desde la pantalla, se ve aquí.

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
