# BE handoff: availability by day over a range, and the cancelled-day dedupe

For the backend team (`cmr-be`). Raised by the availability-first appointments booking screen
(`docs/specs/2026-11-04-appointments-booking-calendar-design.md`). Neither item blocks the FE: the FE
works around both today.

## 1. Range availability endpoint

### Why

The month view colours every open day by how many places are free. With only per-day endpoints the FE
makes one request per open day, about 26 requests per month view, every time the month or the
appointment type / service changes. The two per-day calls are:

- Medical appointment types: `GET /appointments/available-slots` (one call per day).
- Services: `GET /resources/availability` (one call per day).

A single range call would replace those ~26 requests with one.

### Proposal

`GET /api/v2/appointments/availability-by-day`

| Param | Notes |
|---|---|
| `from` | `YYYY-MM-DD`, first day (inclusive) |
| `to` | `YYYY-MM-DD`, last day (inclusive); cap the range (for example 62 days) |
| `appointmentTypeId` or `serviceId` | exactly one: a medical appointment type, or a service |
| `centerId` | optional; defaults to the active tenant (`X-Tenant-ID`), same as the per-day calls |
| `patientId` | optional, services only: same patient-aware limits as `/resources/availability` |

Response, in the usual `{ data, meta }` envelope, one entry per day of the range (closed days included,
with `capacity: 0`):

```json
{
  "data": [
    { "date": "2026-11-10", "capacity": 12, "free": 5, "freeMorning": 3, "freeAfternoon": 2 }
  ]
}
```

Each number must come from the same computation as the per-day endpoint for that day (holidays, no
staff, cut-off times, overbooking rules), so the month colour never disagrees with the day's time list.
`freeMorning` / `freeAfternoon` split at 12:00.

## 2. Cancelled days: bulk booking disagrees with the single create

`POST /frontdesk/sessions/book-multiple` dedupes against ANY existing session of the patient, service
and date, cancelled ones included: `cmr-be/src/modules/frontdesk/frontdesk.service.ts` (about lines
1097-1103), a `findOne` on `{ pacienteId, servicioId, fecha }` with no status filter. The single create
and the database unique index only reject live rows. So a day where the patient's session was cancelled
can be rebooked one by one but never through a series: the bulk call silently counts it in `omitidas`.

The FE now marks such a row as blocked ("cancelled session that day: book it on its own") so the user
is not surprised. Proposal: filter the bulk dedupe like the single create, with `estado: Not('cancelada')`
in that `where`. Once it ships, the FE can drop the `cancelled` block reason
(`lib/agenda/booking/series.ts`).

## 3. A single `centerIds` query value is rejected

`CentersScopeQueryDto` (`cmr-be/src/modules/resources/dto/resource.dto.ts:19-23`) declares
`centerIds?: string[]` with `@IsArray()` and no transform. A request with one value
(`?centerIds=<uuid>`) reaches validation as a string, so every `/resources/*` call that passes exactly
one center fails validation. The booking calendar sent one and every service day came back as an error;
the FE now sends the center only as `X-Tenant-ID`. The FE-wide rule is "every endpoint may take the
array of centers", so this DTO should accept a single value too, e.g.
`@Transform(({ value }) => (value == null ? value : Array.isArray(value) ? value : [value]))` (the same
fix is worth checking in every DTO that declares `centerIds` with `@IsArray()`).

## 4. Small related note: v2 key dictionary

`creadas`, `omitidas` and `aviso` (the book-multiple response) are missing from the v2 key dictionary
(`cmr-be/src/core/api-ingles/campos.ts`), so `/api/v2` still returns Spanish keys for them. The FE
wrapper (`lib/frontdesk/book-multiple.ts`) accepts both `creadas`/`omitidas`/`aviso` and
`created`/`skipped`/`notice`, so adding the translation is safe whenever convenient.

## 5. `/resources/availability`: una sesión ocupa solo su franja de INICIO

`porFranja` (`cmr-be/src/modules/resources/resources.service.ts:735`) suma cada sesión únicamente en
`slotTaken(...)` = su hora de inicio (`the-slot-a-session-takes.ts:12`). Una sesión de 60 min a las 09:00
no ocupa 09:30, así que `freeStations` de 09:30 la ignora y sumar `freeStations` del día cuenta cada
puesto una vez por cada inicio posible: un día vacío de Láser (5 rooms, 60 min, 21 franjas
07:00–17:00 de `las-horas-del-dia.ts:11`) da 105 en vez de ~50. Además, `slots` (`resources.service.ts:512`)
ofrece inicios cuya sesión acaba después del cierre (17:00 + 60 min).

Propuesta: en `porFranja`, una sesión ocupa `ceil(minutes / 30)` franjas desde su inicio (con los
minutos de SU servicio/áreas), y en `availability` un inicio con `inicio + minutes > última franja + 30`
sale `fits: false` con una clave propia (p. ej. `therapies.endsAfterClosing`).

Mientras tanto el FE (`lib/agenda/booking/availability.ts`): `sessionCount` = floor(Σfree × 30 /
max(minutes, 30)) para día/ventana/semana, y marca "termina después del cierre" los inicios que no
caben. Cuando el BE lo haga, se quita `sessionCount` (los números por hora ya serán reales).

## 6. `therapies.noStaff` frente a `therapies.full`

`cabeEnEstaHora` (`cmr-be/src/modules/resources/cabe-en-esta-hora.ts:59`) devuelve `noStaff` siempre
que `techo < capacity` y no quedan libres, aunque haya personal de turno (>0) y simplemente esté todo
ocupado: eso es "lleno", no "sin personal". Y ninguno de los dos bloquea la reserva (solo avisos).
Propuesta: `noStaff` solo cuando `personalDeTurno === 0`; con personal de turno > 0 y sin libres,
`full`. El FE ya trata `noStaff` como "lleno, se puede sobreagendar con aviso".

## 7. Horas fuera de la franja (citas médicas y sesiones)

- Citas médicas: `losCuposLibresDeUnTipo` (`cmr-be/src/modules/citas/los-cupos-libres-de-un-tipo.ts:37-39`)
  compara `horaDeLaFranja(c.hora) === hora`, pero `horaDeLaFranja` (`la-hora-de-la-franja.ts:15-21`)
  solo rellena ceros: `09:15` queda `09:15`, nunca `09:00`. El comentario dice "una cita a las 09:15
  ocupa un hueco de las 09:00", y no ocurre: esa cita no descuenta la franja de las 09:00.
- Las claves de cupo `${hora}|${tipo}` (`cupos.service.ts:14`, usada en `:181`) tampoco se normalizan:
  un cupo guardado como `9:00` o `09:00:00` no casa con las citas `09:00`.
- Sesiones de servicio: `hora` se valida `HH:mm` (`frontdesk/dto/sesion.dto.ts:141`) pero no se
  normaliza ni se redondea a :00/:30, así que una sesión a las 09:15 cae en la clave `09:15` de
  `porFranja`, que no es ninguna franja, y no ocupa nada.

Propuesta: una función de franja que redondee hacia abajo a la banda (hora entera para médicas, 30 min
para servicios) y se use para citas, sesiones y claves de cupo.

## 8. available-slots médicas ignora festivos y horarios/ausencias del médico

`GET /appointments/available-slots` (`citas.controller.ts:220` → `cupos-libres.service.ts:47-73`) solo
cruza cupos y citas: un festivo que bloquea la agenda devuelve bandas libres, y tampoco mira horarios
ni ausencias de los médicos. El FE ahora trata un fallo al leer festivos como error (no como "sin
festivos") para no pintar un festivo como reservable. Propuesta: devolver `[]` (o bandas `blocked` con
motivo) en un día con festivo bloqueante (`festivosDelDia`, `disponibilidad.service.ts:300`) y, cuando
el tipo requiere médico, acotar por horarios/ausencias.

## 9. Permiso de la puerta en cancelar / reagendar

El guard deriva el permiso "de puerta" del verbo (`cmr-be/src/core/auth/guards/permiso-del-endpoint.ts:15-22`,
POST → `.create`). `POST /appointments/:id/cancel` y `/:id/reschedule` (`citas.controller.ts:416` y
`:572`) no declaran `@Permissions`, así que piden `citas.create` en la puerta y luego `citas.update`
dentro (`inClinicOf(..., { write: 'citas.update' })`). Igual `POST /frontdesk/sessions/:id/cancel`
(`frontdesk.controller.ts:785`): `frontdesk.create` + `frontdesk.update`. Un rol que solo edita
(`.update`) recibe 403. Propuesta: `@Permissions('citas.update')` / `@Permissions('frontdesk.update')`
explícito en esos handlers. Mientras, el FE exige ambos permisos para mostrar esas acciones
(`railActions`, `lib/agenda/booking/patient-appointments.ts`).

## 10. `GET /holidays` ignora `X-Tenant-ID`

`FestivosController.list` (`cmr-be/src/modules/disponibilidad/disponibilidad.controller.ts:198-227`) →
`listFestivos` (`disponibilidad.service.ts:274-292`) filtra por TODOS los centros legibles
(`readScope`), no por el centro de la cabecera: un admin recibe los festivos de todos los centros, y
un usuario de varios centros no recibe los globales (`clinicId = null`) salvo con `scope=global`.
El FE ahora pide el centro y `scope=global`, los une y filtra `clinicId === centro || null` con la
precedencia centro > global (`lib/agenda/booking/holidays.ts`, `lib/api/festivos.ts` `getBookingHolidays`).
Propuesta: respetar `centerIds`/`X-Tenant-ID` y devolver los del centro MÁS los globales en una sola
lectura (como `festivosDelDia`).
