# Vacaciones y permisos del calendario → personal disponible — handoff BE → FE

**Pedido del dueño (11-nov-2026):** que las vacaciones y los permisos que se anotan en el calendario
saquen a la persona del personal disponible, **sin fricción**. El personal sigue escribiendo en el
calendario como siempre; la pantalla solo ofrece un chip prellenado que se acepta con un clic.

BE: PR «feat(calendar): calendar vacations and leave take the person out of available staff».
Spec: `cmr-be/docs/specs/ausencias-del-calendario.md`.

> Los nombres de campo de v2 se comprueban contra la respuesta real en cuanto se despliega; si alguno
> cambia, se corrige aquí con la fecha.

## 1. El chip bajo el evento (crear / editar)

`POST /v2/calendar/events` y `PUT /v2/calendar/events/:id` responden como hasta ahora, más dos
campos:

- `absence`: la ausencia ya ligada, o `null`:
  `{ id, staffId, staffName, kind: 'vacation'|'leave', startDate, endDate, startTime|null, endTime|null }`
- `absenceSuggestion`: lo que el título parece decir, o `null`:
  `{ staffId|null, staffName|null, candidates: [{id,name}], kind, startDate, endDate, startTime, endTime, confidence: 'high'|'low', reasonKey|null }`

Cómo se pinta:
- Con `absence`: un chip fijo, por ejemplo «Ausencia · Irvin Santana · 12 nov» o «· llega 11:00»,
  con una ✕ para quitarlo (`DELETE`, ver abajo).
- Con `absenceSuggestion`: un chip suave, «¿Ausencia de Irvin Santana · 12 nov?», con dos botones:
  - **Aceptar** → `PUT /v2/calendar/events/:id/absence` con `{ staffId, kind, startTime?, endTime? }`
    tomados de la sugerencia;
  - **No es ausencia** → `DELETE /v2/calendar/events/:id/absence`.
- Si `staffId` es null pero hay `candidates` (dos «Yashira»): el chip deja elegir entre ellas y nada
  más.
- **Nunca bloquea guardar el evento.** Si se ignora el chip, el evento queda en la lista de revisión.

Mientras se escribe el título (opcional, con debounce):
`GET /v2/calendar/absences/suggestion?titulo=…&dia=…[&diaFin&hora&horaFin&centroId]`
devuelve la misma sugerencia, o `null`. No escribe nada.

`GET /v2/calendar/events` trae `absence` en los eventos ligados. Esas ausencias ya **no** salen
repetidas como evento proyectado (`origin: 'staff_absence'`); las registradas en Disponibilidad sí,
como antes.

Permiso para Aceptar y para quitar: `calendario.absences` en el centro del evento (si falta, 403).
Enseñar los botones solo si `/me` tiene ese permiso; sin él, el chip es solo informativo.

## 2. Lista de revisión — `/calendario/ausencias`

Ya existe la fila de menú `calendar-absence-review` (labelKey `nav.calendarAbsenceReview`, permiso
`calendario.absences`, en Agenda). Si no aparece en `/me/menu`, hay que crearla con `POST /menu`;
nunca con `seed:menu`.

`GET /v2/calendar/absences/review?desde=YYYY-MM-DD[&hasta][&centerIds]` → filas
`{ id, clinicId, clinicName, day, endDay, time, endTime, title, absenceDismissed, suggestion }` (nombres v2 comprobados en producción el 11-nov).

- Tabla por fecha, con el título, la persona sugerida (o el selector de candidatos), el tipo, las
  horas y la confianza.
- Las filas `high` llevan «Aceptar» directo, y hay «Aceptar todas las de confianza alta». Las `low`
  muestran el porqué (`reasonKey`).
- Por fila: Aceptar (`PUT`) / No es ausencia (`DELETE`). La fila desaparece al resolverse.

## 3. Ausencias en el selector de personal

- `GET /frontdesk/free-staff`, las rejillas de terapias, el tren y las series ya descuentan solos a
  quien está ausente a esa hora. No hay nada que hacer.
- Opcional: en el selector manual, mostrar «ausente hasta 11:00» o «de vacaciones» junto al nombre,
  si viene en la respuesta.
- En **Disponibilidad → ausencias**, el formulario acepta ahora `startTime` / `endTime` (HH:mm) para
  las ausencias de parte del día. Hay que añadir esos dos campos opcionales.

## 4. i18n (es / en)

- `nav.calendarAbsenceReview`: «Ausencias por revisar» / «Absences to review»
- `calendar.absence.ambiguousStaff`: «Hay varias personas con ese nombre» / «More than one person has that name»
- `calendar.absence.noStaff`: «No encontré a esa persona en el centro» / «No one by that name in this center»
- `calendar.absence.unclear`: «Es un cambio de día o falta confirmar» / «A day swap or still to be confirmed»
- `calendar.absence.unclearHours`: «Falta la hora» / «The hour is missing»
- `calendar.absence.staffNotInCenter`: «Esa persona no trabaja en el centro del evento» / «That person does not work in this event's center»
- `calendar.absence.globalEvent`: «Un evento de toda la empresa no es la ausencia de una persona» / «A company-wide event is not one person's absence»
- `disponibilidad.ausencia.horas_invalidas`: «La hora de fin debe ser posterior a la de inicio» / «The end time must be after the start time»
- Registro de cambios (`changeLog.action.*`): `absence_create`, `absence_link`, `absence_cancel`, `absence_restore`, `absence_edit`, `absence_delete`.

## Verificación esperada

En producción, en Caguas, con una sesión que tenga `calendario.absences`:
1. Abrir el calendario de noviembre. El evento «IRVIN DE VACACIONES…» del 12 lleva su chip de
   ausencia ligada (se convirtió por la API).
2. `/calendario/ausencias` lista lo dudoso, por ejemplo «Yashira ausente» con sus dos candidatas.
3. El 12-nov, en la rejilla de láser, Irvin no cuenta como técnico de turno.
