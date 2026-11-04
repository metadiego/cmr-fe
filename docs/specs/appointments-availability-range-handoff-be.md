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

## 3. Small related note: v2 key dictionary

`creadas`, `omitidas` and `aviso` (the book-multiple response) are missing from the v2 key dictionary
(`cmr-be/src/core/api-ingles/campos.ts`), so `/api/v2` still returns Spanish keys for them. The FE
wrapper (`lib/frontdesk/book-multiple.ts`) accepts both `creadas`/`omitidas`/`aviso` and
`created`/`skipped`/`notice`, so adding the translation is safe whenever convenient.
