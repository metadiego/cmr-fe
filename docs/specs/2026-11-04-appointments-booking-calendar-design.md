# Appointments: availability-first booking calendar

Date: 2026-11-04 · Status: approved prototype, spec for implementation · Repo: cmr-fe only

Prototype the owner approved (throwaway, made-up data): `flow-prototype-v3.html` from the
brainstorming session. This spec is the source of truth; where they differ, the spec wins.

## Why

The appointment team works the phone. A call goes: *what does the patient need* (a medical
appointment: new or follow-up; or a service such as Láser) → *which dates have room* → the patient
picks a date → *which times are free that day* → book. Variant: "next free in the morning /
afternoon". Other calls are about an existing appointment: find the patient by name or phone, then
move or cancel it.

Today `/scheduling/appointments` shows two month calendars (Medical / Services tabs) that count what
is already **booked**, not what is **free**, and the services month lists patient names that overflow.
Nothing answers "when can this patient come?" at a glance.

## Goals

1. One screen, no Medical/Services tabs. The first decision is **what is being booked**: a medical
   appointment type or a service, picked from one grouped list.
2. A month calendar whose number per day is **free spots for the chosen type** (optionally only
   morning or afternoon), coloured by how open the day is. A **Free / Booked** switch shows the same
   month as booked spots instead.
3. A day panel with that day's times, split Morning / Afternoon, each showing spots left. Full times
   stay visible and clickable (booking never blocks — owner decision 02-oct-2026, enforced by the BE).
4. A **Next free** strip: the next four openings for the type (respecting the morning/afternoon
   filter), each one click away.
5. **Who's calling?**: patient search (name, phone, record) as an equal starting point. Picking a
   patient shows, on the left, their upcoming appointments of both kinds (and recent past ones), each
   with Move / Edit / Cancel, and books on the right are for that patient.
6. **Move** happens on the same calendar: the appointment's card turns blue ("Pick the new time on
   the calendar"), the calendar switches to its type, its current day is ringed, a time click opens a
   small "Move here?" confirmation.
7. **Series** for services: "Repeat weekly" in the booking form, every 1 or 2 weeks, N sessions
   (default = sessions left on the patient's package for that service, else 4); a per-date list with
   status (free / full-will-overbook / blocked) and a per-date time override; one click books all.
8. **Live**: the calendar updates by itself when anyone books, moves or cancels (existing stream).
9. **Center** selectable at the top (dropdown), defaulting to the session's center.
10. **Open full day ›** links to the existing day screens, which stay as they are.
11. Everything fits the window on desktop: the page never scrolls; the rail and the day panel scroll
    inside themselves if their content is long.

## Non-goals (this PR)

- Patient notifications (WhatsApp/SMS) on book/move/cancel.
- A whole-day "how busy" KPI card (owner: "leave it out for now").
- Doctor filter on availability: the BE availability endpoint has no doctor parameter. The doctor is
  still chosen in the medical booking form.
- Any BE change. A month-range availability endpoint is recommended (handoff below) but not built.
- Changing overbooking rules.
- Mobile layout beyond "stacks and scrolls" (< 1024px).

## Anti-goals

- A second date/time picker (popup with a mini calendar) for moving. Rejected in review as confusing.
- A page-level "mode" banner. The only sign of moving is the appointment's own card.
- Duplicating business rules that already live in shared components (medical booking validation,
  EHR readiness gate, auto appointment type).

## The screen

### States

| Patient chosen | Type chosen | Left | Right |
|---|---|---|---|
| no | no | "Who's calling?" panel | "What are we booking?" panel (same row, two equal panels) |
| no | yes | "Who's calling?" panel (narrow) | calendar + day panel |
| yes | no | patient rail | "Book for <first name>: what?" type picker |
| yes | yes | patient rail | calendar + day panel |

Header row: page title (from the shell), center dropdown, Live pill.

### Who's calling?

- Search box: debounced 250 ms; `GET /patients?q&limit=8` across the centers the user may read
  (same as `PacienteSelect`). Each result shows name, record, phone, center and the patient's **next
  upcoming appointment** (either kind) when the BE gives it cheaply; if not available per result, show
  name/record/phone/center only. *(Builder call: next-appointment per result costs one request per
  row; acceptable only if done lazily for the visible results.)*
- "+ New patient" opens the existing `PacienteFormSheet`; the saved patient becomes the selected one.
- No "recent" list in v1 (no BE source). *(Builder call.)*

### What are we booking?

Two groups: **Medical appointment** (appointment types from `GET /appointments/types`, with colour)
and **Service** (services from `GET /services`, active only, with colour, in their configured order).
With a patient selected, a service shows "N sessions left" from
`GET /frontdesk/patients/:id/availability` when N > 0. After a choice, the type sits in the toolbar as
a chip with ✕ to change it.

### Toolbar (type chosen)

`Booking` (or `Book for Ana`) + type chip · `Any time | Morning | Afternoon` · Next free strip below.
Morning = before 12:00, Afternoon = 12:00 and later.

### Month

- Only the weeks the month needs (5 or 6 rows); rows share the remaining height.
- Day cell: day number, big number, small label (`free` / `full` / `closed` / `holiday`).
- **Free** mode number = sum of free spots in the window; colour: 0 → red, 1–3 → amber, 4–8 → light
  green, 9+ → green. *(Builder call: thresholds; keep them in one helper.)*
- **Booked** mode number = booked spots (capacity − free) of the type; colour scale by booked/capacity.
- Days before today and days with no capacity (Sunday, holiday, nothing configured) are grey and not
  clickable. Holidays from `getFestivos`.
- Selected day: outline. Moving: the appointment's current day has an orange ring.
- ‹ › Today navigation. Changing month loads that month.

### Day panel

Header: long date · type name · "Open full day ›" (medical →
`/scheduling/appointments/<date>`, service → `/scheduling/appointments/services/<date>`).
Morning and Afternoon groups of time buttons in a 4-column grid: `8:00 / 2 left`, full ones dashed
grey `full` with a tooltip "Full — you can still book (overbook)". Clicking a time:

- not moving → booking form (below);
- moving → "Move here?" box: old → new, a warning when the time is full, `Move` / `Not this one`.
  Medical moves also ask for a **reason** (free text, required by
  `POST /appointments/:id/reschedule`, same as `CitaActions` today). Service moves ask for none:
  `PATCH /frontdesk/sessions/:id/agenda` takes only `{date, time}`.

### Booking form

- **Medical type**: opens the existing `CitaModal` with `fecha`, `horaInicial`, `tipoCitaIdInicial`,
  `pacienteInicial` (the selected patient, if any) and `centroId` preset. It already does patient
  search, doctor, validation (`POST /appointments/validate`), the overlap warning, the EHR readiness
  gate, and the BE's "one live appointment per patient" behaviour (the BE may reschedule the
  patient's existing live appointment instead of creating a new one; `CitaModal` already toasts it).
  *(Builder call: reuse over an inline form — the anti-goal above forbids duplicating these rules.)*
- **Service**: inline form in the day panel: patient (selected patient, or a search field), notes,
  `Repeat weekly` checkbox → every [1|2] weeks, [N] sessions, date list. Single →
  `POST /frontdesk/sessions` `{patientId, serviceId, date, time}`. Series →
  `POST /frontdesk/sessions/book-multiple` `{patientId, serviceIds:[id], dates[], time}`; a date with
  a per-date time override different from the first is booked with its own `POST /frontdesk/sessions`
  call. Dates are generated by the existing `lib/agenda/recurring-plan.ts` where it fits.
  Per-date status: `free`, `full · will overbook` (allowed), blocked (`closed`, `holiday`,
  `already has this service that day`) — blocked dates must be changed or dropped before booking.
  Each date keeps the chosen time (the approved prototype). When it is full or blocked, the form also
  offers the existing planner's suggestion (`buildRecurringPlan`'s `adjustedTime`/`adjustedDate`, the
  owner's Sep request "suggest another date or time") as a one-click "Use 10:00 instead" / "Use Thu 13
  instead". The patient's existing sessions for the series range come from one
  `GET /frontdesk/sessions?patientId&from&to` call. `RecurringBookingModal` is not used on this screen
  (it stays where it is used today); the date/plan logic is shared through `lib/agenda/recurring-plan.ts`.
  Service availability is always asked for `areas: 1` (as the service day screen does); area-based
  multi-area sessions keep being booked from the patient desk scheduler.
  BE warnings (`meta.warnings`) are shown as a toast after booking; BE skipped dates (`omitidas`) are
  listed.

### Patient rail

Name, record, phone, center, ✕ (back to start), link to the record. **Upcoming** (today on, both
kinds, by date then time) and **Past** (last 5, greyed, no actions).

- Medical: `GET /appointments?patientId&from=<today-90d>&to=<today+365d>&centerIds` (live statuses
  for upcoming; attended / no-show / cancelled shown in past).
- Service: `GET /frontdesk/sessions?patientId&from&to` in the screen's center (the BE scopes sessions
  to the active center).
- Card actions: **Move** (both kinds), **Edit** (medical only → `CitaModal` in edit mode, which hosts
  `CitaActions`), **Cancel** (both kinds; inline **free-text reason**, required, as in today's screens → medical
  `POST /appointments/:id/cancel {reason}`, service `POST /frontdesk/sessions/:id/cancel {reason}`).
- Move commits: medical `POST /appointments/:id/reschedule {date, time, reason, centerId}`; service
  `PATCH /frontdesk/sessions/:id/agenda {date, time}`.

## Data and API (all existing; FE wrappers in `lib/api/*`)

| Need | Medical | Service |
|---|---|---|
| Free per day | `GET /appointments/available-slots?date&appointmentTypeId&centerId` → bands `{time, capacity, free}` (`getCuposLibres`) | `GET /resources/availability?date&serviceId&patientId?&centerIds` → slots `{time, fits, freeStations, reasonKey}` (`getAvailability`); `configured:false` = "This service has no capacity set up" empty state |
| Month | one call per open day of the visible month (Sundays/holidays/past skipped), concurrency-limited, cached per (center, type, date) | same |
| Live | `useCitaStream` (`/tablero/stream`), events for `cita` and `sesion` → invalidate cached days for the event's date (or all visible days if unknown), debounced | same |

Normalised model (pure, in `lib/agenda/`): `DaySlots = { date, slots: {time, capacity, free}[] }`
for both kinds. Service mapping:
- `fits` → `free = freeStations ?? 1`.
- `reasonKey = therapies.full` or `therapies.overMaxPerPatient` → `free = 0`, shown **full** (clickable,
  overbook).
- `therapies.noStaff`, `therapies.holiday`, cut-off reasons → the time is **unavailable**: not counted,
  shown dashed with the translated reason as tooltip, not clickable.
- The **month** asks without `patientId` (general capacity, cache shared across patients); the **day
  panel** asks with `patientId` when a patient is selected, so per-patient limits show there.
- Service capacity is not real (freeStations is the bottleneck resource), so the **Booked** mode is
  only offered for medical types. Helpers: free
count in a window, booked count, colour bucket, next-free scan, series plan with statuses. All tested
with `node --test` in `lib/`.

## Routing

- `/scheduling/appointments` renders the new screen. `/scheduling/appointments/services` (old tab
  route) renders the same screen; inbound links keep working. The Medical/Services tab layout and its
  `APPOINTMENTS_TABS` entry are removed; their tests are updated, not deleted silently.
- `/scheduling/appointments/<date>` and `/scheduling/appointments/services/<date>` (day screens)
  stay unchanged.
- The settings button (→ `/scheduling/slots`, `citas.config`) stays in the header.
- URL keeps `?type=<kind>:<id>&date=YYYY-MM-DD&patient=<id>` so reload and links restore the state.
  *(Builder call.)*

## Permissions and center

- Center dropdown: `useCentroPantalla("citas.read", "citas.create")`; all calls pass the chosen
  center (`centerId`/`centerIds`, and as `X-Tenant-ID` for frontdesk endpoints that only use the
  active center).
- Booking/moving/cancelling medical needs `citas.create`/`citas.update`; services `frontdesk.create`/
  `frontdesk.update`. Actions the user lacks are hidden (`useCan`).

## i18n

New namespace `appointmentsBooking` in `messages/en.json` and `messages/es.json`, keys in English,
both catalogues in the same commit. Dates and times through next-intl formats (`i18n/formats.ts`),
calendar days via `parseDayUTC`.

## Errors and edge cases

- Availability call fails for a day → that day shows "—" and a retry on click; the rest of the month
  still renders.
- Live stream down → `useCitaStream` already polls; the Live pill shows its state.
- A time taken by someone else after it was picked → the BE does not block, so the booking goes
  through as an overbook; the day refreshes and shows it.
- Patient from another center: their appointments list in the screen's center for services (BE
  limitation); medical appointments list across readable centers.
- Medical booking for a patient who already has a live appointment on another date: `CitaModal`'s
  validation + BE reschedule behaviour; the rail refreshes after save.

## BE handoff (not in this PR)

`GET /appointments/availability-by-day?from&to&appointmentTypeId|serviceId&centerId` returning
`[{date, capacity, free, freeMorning, freeAfternoon}]` would replace ~26 requests per month view with
one. Written as `docs/specs/appointments-availability-range-handoff-be.md`.

## Calls made without asking (owner can overturn)

1. FE-only; month built from per-day calls; BE range endpoint as a handoff.
2. Medical booking/editing reuses `CitaModal` (a dialog) instead of an inline form.
3. No doctor filter on the calendar (BE has no doctor parameter for availability).
4. No "recent patients" list; next appointment per search result only if cheap.
5. Colour thresholds 0 / 1–3 / 4–8 / 9+.
6. State in the URL.
7. Free/Booked switch kept (the owner removed only the KPI card), for medical types only.
8. Reasons are free text (as today), not a fixed list; service moves take no reason.
9. Series keep each date's time and mark full/blocked dates, and also offer the planner's suggested
   alternative per date (merges the approved prototype with the Sep "suggest another date/time" ask).
10. Services always use `areas: 1` here.
11. "no staff" / holiday / cut-off service times are unavailable (not clickable); only "full" and
    "over the patient's limit" are overbookable.
