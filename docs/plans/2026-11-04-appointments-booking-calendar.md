# Appointments booking calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Medical/Services tabbed month calendars at `/scheduling/appointments` with one availability-first screen (who's calling + what are we booking → free-spots month → day times → book / move / cancel / series), live-updating, fitting the window.

**Architecture:** All decisions that can be pure live in `lib/agenda/booking/*` with `node --test` tests (the only place tests run). Data fetching lives in hooks (`hooks/use-booking-*.ts`) over the existing `lib/api/*` wrappers. UI lives in `components/appointments-booking/*`, each file under 600 lines, composed by `booking-screen.tsx`, rendered by both `(calendars)` routes.

**Tech Stack:** Next.js 16 App Router (client components), React 19, Tailwind v4, shadcn/ui, next-intl, `node --test --experimental-strip-types`.

**Spec:** `docs/specs/2026-11-04-appointments-booking-calendar-design.md` (read it first; the spec wins on any conflict).

## Global Constraints

- Branch `feat/appointments-booking-calendar`. **No PR**: the owner tests locally first. Commit per task.
- Everything committed is English (identifiers, comments, i18n keys); Spanish only as `messages/es.json` values. Every key added to `en.json` and `es.json` in the same commit. New namespace: `appointmentsBooking`.
- No hardcoded user-facing strings in JSX. Dates/times via next-intl formats (`i18n/formats.ts`) and `parseDayUTC` (`lib/format/fecha.ts`); never `toLocale*String()` without a locale (lint error), never `new Date(iso + "T00:00:00")`.
- New files under 600 lines (`npm run lint` enforces). Do not raise any `DEBT` ceiling.
- Tests only in `lib/**/*.test.ts`; imports inside `lib/` use relative paths with `.ts` extensions and type-only imports from `lib/api/*` (see `lib/agenda/recurring-plan.ts:1-4`). The test count never goes down.
- API: only existing endpoints via `lib/api/*` wrappers; no BE changes. `centroId` argument = `X-Tenant-ID`.
- Morning = time < `12:00`; Afternoon = time ≥ `12:00`.
- Free colour buckets: 0 → `full`, 1–3 → `low`, 4–8 → `some`, 9+ → `many`.
- Overbooking stays allowed: full times are visible and clickable, with a warning.
- Gate before every commit of a UI task: `npm run typecheck && npm run lint && npm test`. Final task adds `npm run build`.

## Review Focus

1. **Month request storm:** switching type/month/center quickly must not leave stale responses painting the wrong type (each request keyed; late responses for an old key ignored). Test in Task 5 (`cache ignores results for a stale key`).
2. **Live event without a date** (e.g. `eliminada`): must still refresh the visible month, not nothing. Test in Task 5 (`datesToRefresh returns all visible dates when event has no date`).
3. **Service with no resource configured** (`configured:false`): month shows the "not set up" state, not 0 free / all red. Test in Task 1 (`fromServiceAvailability returns null when not configured`).
4. **Series crossing a holiday or a day the patient already has the service:** that row is blocked and booking is disabled until fixed. Test in Task 4.
5. **Times as "H:mm" vs "HH:mm" vs "HH:mm:ss" from different endpoints:** everything normalises to "HH:mm" before comparing. Test in Task 1 (`normalizeTime`).

---

### Task 1: Availability model (pure)

**Files:**
- Create: `lib/agenda/booking/availability.ts`
- Test: `lib/agenda/booking/availability.test.ts`

**Interfaces:**
- Consumes: types `SlotLibre` (`lib/api/citas.ts:11`), `Availability`, `AvailabilitySlot` (`lib/api/resources.ts:89-100`) — type-only imports.
- Produces:
  - `type TimeWindow = "any" | "morning" | "afternoon"`
  - `type SlotState = "open" | "full" | "unavailable"`
  - `interface BookingSlot { time: string /* HH:mm */; capacity: number; free: number; state: SlotState; reasonKey: string | null }`
  - `interface DaySlots { date: string; slots: BookingSlot[] }`
  - `normalizeTime(t: string): string` ("7:00"/"07:00:00" → "07:00")
  - `fromMedicalBands(date: string, bands: SlotLibre[]): DaySlots`
  - `fromServiceAvailability(date: string, a: Availability): DaySlots | null` (null when `configured === false`)
  - `inWindow(time: string, w: TimeWindow): boolean`
  - `freeIn(day: DaySlots, w: TimeWindow): number`
  - `bookedIn(day: DaySlots): { booked: number; capacity: number }` (open+full slots only)
  - `freeBucket(n: number): "full" | "low" | "some" | "many"`
  - `bookedBucket(booked: number, capacity: number): 0 | 1 | 2 | 3 | 4` (ratio <.25, <.5, <.75, <.95, else 4)
  - `nextFree(days: DaySlots[], w: TimeWindow, n: number, from: { date: string; time?: string }): { date: string; time: string }[]` (days in any order; returns earliest first; on `from.date` only times ≥ `from.time`)

Service mapping (spec): `fits` → `free = freeStations ?? 1`, `state "open"`, `capacity = max(free, 1)`; `reasonKey` `therapies.full` or `therapies.overMaxPerPatient` → `free 0`, `state "full"`, `capacity 1`; any other `fits:false` → `state "unavailable"`, `capacity 0`, `free 0`. Medical: `free = band.free`, `capacity = band.capacity`, state `free > 0 ? "open" : "full"`. Slots sorted by time.

- [ ] **Step 1: Write failing tests** in `availability.test.ts`:
  - `normalizeTime` → `"7:00"→"07:00"`, `"07:30:00"→"07:30"`.
  - `fromMedicalBands maps free/capacity and marks full` → bands `[{time:"08:00",capacity:3,free:2,cappedBy:null},{time:"8:30",capacity:3,free:0,cappedBy:"cupo"}]` → states `["open","full"]`, times `["08:00","08:30"]`.
  - `fromServiceAvailability returns null when not configured`.
  - `fromServiceAvailability maps fits, full and unavailable` → slots `[{time:"07:00",fits:true,freeStations:2},{time:"07:30",fits:false,reasonKey:"therapies.full"},{time:"08:00",fits:false,reasonKey:"therapies.noStaff"}]` → `free [2,0,0]`, states `["open","full","unavailable"]`.
  - `freeIn respects the window` → day with free at 08:00 (2) and 13:00 (3): any 5, morning 2, afternoon 3; boundary `12:00` counts as afternoon.
  - `bookedIn ignores unavailable slots` → capacity/booked from open+full only.
  - `freeBucket thresholds` → 0 full, 1 low, 3 low, 4 some, 8 some, 9 many.
  - `nextFree returns earliest n, skipping past times on the start date` → two days out of order, `from {date:d1,time:"09:00"}` excludes d1 08:00.
- [ ] **Step 2: Run** `npm test` → the new tests FAIL (module not found).
- [ ] **Step 3: Implement** the interfaces above in `availability.ts`.
- [ ] **Step 4: Run** `npm test` → all PASS.
- [ ] **Step 5: Commit** `feat(appointments): availability model for the booking calendar`.

### Task 2: Month grid and URL state (pure)

**Files:**
- Create: `lib/agenda/booking/month.ts`, `lib/agenda/booking/url-state.ts`
- Test: `lib/agenda/booking/month.test.ts`, `lib/agenda/booking/url-state.test.ts`

**Interfaces:**
- Produces (`month.ts`):
  - `monthWeeks(year: number, month0: number): string[][]` — Sunday-first weeks covering the month; only as many weeks as needed (Nov 2026 → 5, Aug 2026 → 6, Feb 2026 → 4).
  - `bookableDays(weeks: string[][], month0: number, todayIso: string, holidays: string[]): string[]` — in-month, ≥ today, not Sunday, not a holiday.
  - `dayKind(date: string, month0: number, todayIso: string, holidays: string[]): "past" | "outside" | "sunday" | "holiday" | "bookable"`
- Produces (`url-state.ts`):
  - `type BookingKind = "medical" | "service"`
  - `interface BookingUrlState { kind?: BookingKind; typeId?: string; date?: string; patientId?: string }`
  - `parseBookingParams(sp: URLSearchParams): BookingUrlState` — `type=medical:<uuid>` / `type=service:<uuid>`, `date=YYYY-MM-DD` (rejects malformed), `patient=<id>`.
  - `toBookingSearch(s: BookingUrlState): string` — `""` when empty, else `"?type=…&date=…&patient=…"` in that order, omitting missing.

- [ ] **Step 1: Failing tests:** `monthWeeks` row counts above and first cell of Nov 2026 = `"2026-11-01"`; `bookableDays` excludes `2026-11-01` (Sunday), `2026-11-03` when today is `2026-11-04`, and `2026-11-11` when in holidays; `dayKind` returns each kind once; `parseBookingParams` round-trips with `toBookingSearch`, ignores `type=foo:1` and `date=2026-13-40`.
- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement** with UTC day arithmetic (reuse `addDays`/`weekdayOf` from `lib/agenda/recurring-plan.ts`).
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(appointments): month grid and URL state helpers`.

### Task 3: A patient's appointments (pure)

**Files:**
- Create: `lib/agenda/booking/patient-appointments.ts`
- Test: `lib/agenda/booking/patient-appointments.test.ts`

**Interfaces:**
- Consumes: types `Cita` (`lib/api/citas.ts:11`), `Sesion` (`lib/api/frontdesk.ts`).
- Produces:
  - `interface PatientAppointment { id: string; kind: "medical" | "service"; typeId: string; date: string; time: string | null /* HH:mm */; status: string; withLabel: string | null; isLive: boolean }`
  - `MEDICAL_LIVE = ["programada","confirmada","presente","triage","en_consulta"]`; `SERVICE_LIVE = ["pendiente","presente","en_terapia"]`
  - `fromCita(c: Cita): PatientAppointment` (typeId = `appointmentTypeId`, withLabel = `doctorName ?? null`)
  - `fromSesion(s: Sesion): PatientAppointment` (typeId = `serviceId`, withLabel = staff/resource name if present else null)
  - `splitUpcomingPast(items: PatientAppointment[], todayIso: string, pastLimit = 5): { upcoming: PatientAppointment[]; past: PatientAppointment[] }` — upcoming = live and date ≥ today, ascending by date then time (null time last); past = everything else with date ≤ today or not live, descending, at most `pastLimit`. `reprogramada` never appears in either (it has a successor).

- [ ] **Step 1: Failing tests:** live future medical + service interleave by date/time; a `cancelada` future item goes to past; `reprogramada` is dropped; past is capped at 5 and newest first; null time sorts after timed items on the same day.
- [ ] **Step 2: Run** `npm test` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(appointments): normalise a patient's medical and service appointments`.

### Task 4: Series rows (pure)

**Files:**
- Create: `lib/agenda/booking/series.ts`
- Test: `lib/agenda/booking/series.test.ts`

**Interfaces:**
- Consumes: `DaySlots`, `normalizeTime` (Task 1); `RecurringPlanItem` (`lib/agenda/recurring-plan.ts:22`, type-only); `addDays`.
- Produces:
  - `seriesDates(start: string, everyWeeks: 1 | 2, count: number): string[]`
  - `type SeriesRowStatus = "free" | "full" | "blocked"`; `type SeriesBlockReason = "closed" | "holiday" | "duplicate"`
  - `interface SeriesRow { index: number; date: string; time: string; status: SeriesRowStatus; reason: SeriesBlockReason | null; suggestion: { date: string; time: string } | null }`
  - `buildSeriesRows(input: { dates: string[]; time: string; overrides: Record<number, string>; days: Record<string, DaySlots | null>; holidays: string[]; existingDates: string[]; plan?: RecurringPlanItem[] }): SeriesRow[]` — per row: holiday → blocked/holiday; `existingDates` contains date → blocked/duplicate; day missing, null or no slot at that time with state ≠ unavailable → blocked/closed; slot `free > 0` → free; else full. `suggestion` = matching `plan[index]` when its status is `adjustedTime`/`adjustedDate` and the row is not free.
  - `canBookSeries(rows: SeriesRow[]): boolean` — false if any row is blocked.

- [ ] **Step 1: Failing tests:** `seriesDates("2026-11-10",1,3)` → `["2026-11-10","2026-11-17","2026-11-24"]`, every 2 → `[...10, 24, 2026-12-08]`; a holiday row is blocked/holiday and `canBookSeries` false; a duplicate row blocked/duplicate; override time used for that row only; full slot → `full` (bookable); plan suggestion attached only to non-free rows.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(appointments): series rows for weekly service bookings`.

### Task 5: Availability data hooks and live refresh

**Files:**
- Create: `lib/agenda/booking/day-cache.ts`, `lib/agenda/booking/day-cache.test.ts`, `hooks/use-booking-availability.ts`
- Modify: `lib/api/frontdesk.ts:157-163` (`reagendarSesion` gains a time)

**Interfaces:**
- Consumes: Task 1 mappers; `getCuposLibres` (`lib/api/citas.ts:325`), `getAvailability` (`lib/api/resources.ts:101`), `useCitaStream` (`hooks/use-cita-stream.ts:14`, `onEvent` gives `CitaStreamEvent` with `status?.date`).
- Produces:
  - `reagendarSesion(sesionId: string, fecha: string, centroId?: string, time?: string): Promise<Sesion>` — body `{ date, time }` when `time` given (existing callers unchanged).
  - `dayKey(center: string, kind: BookingKind, typeId: string, date: string, patientId?: string): string`
  - `datesToRefresh(eventDates: (string | undefined)[], visible: string[]): string[]` — dates ∩ visible; if any event date is undefined, all visible.
  - `runLimited<T>(tasks: (() => Promise<T>)[], limit: number): Promise<PromiseSettledResult<T>[]>`
  - `useMonthAvailability(p: { center: string | undefined; kind: BookingKind | undefined; typeId: string | undefined; dates: string[] }): { days: Record<string, DaySlots | null | "error">; loading: boolean; notConfigured: boolean; refresh: (dates?: string[]) => void }` — concurrency 6, module-level cache by `dayKey` (no patient), ignores results whose key no longer matches the current request generation.
  - `useDayAvailability(p: { center; kind; typeId; date: string | undefined; patientId?: string }): { day: DaySlots | null | "error" | undefined; refresh: () => void }` — services pass `patientId` and `areas: 1`.
  - `useBookingLive(p: { center: string | undefined; visible: string[]; onRefresh: (dates: string[]) => void }): { live: boolean }` — wraps `useCitaStream` (no `entidad` filter, `debounceMs` 400), collects `status?.date` from `onEvent` between invalidations, calls `onRefresh(datesToRefresh(...))`; the 20 s poll (no events collected) refreshes all visible.

- [ ] **Step 1: Failing tests** (`day-cache.test.ts`): `datesToRefresh returns all visible dates when event has no date`; returns only the intersection otherwise; `runLimited never runs more than limit at once` (counter with deferred promises, limit 2, 5 tasks); `dayKey` differs by patient; `cache ignores results for a stale key` — expressed against an exported pure `isCurrent(requestKey: string, currentKey: string): boolean` used by the hook.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `day-cache.ts`, then the hooks and the `reagendarSesion` change. **Step 4: Run** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(appointments): month/day availability hooks with live refresh`.

### Task 6: Screen shell, start panels, routes, i18n

**Files:**
- Create: `components/appointments-booking/booking-screen.tsx`, `components/appointments-booking/whos-calling-panel.tsx`, `components/appointments-booking/type-picker-panel.tsx`
- Modify: `app/(app)/scheduling/appointments/(calendars)/layout.tsx` (becomes a pass-through `<>{children}</>`), `(calendars)/page.tsx` and `(calendars)/services/page.tsx` (render `<BookingScreen />`), `lib/nav/tab-routes.ts:41-45,57` (remove `APPOINTMENTS_TABS`), `lib/nav/tab-routes.test.ts:41,42,61,68` (rewrite those assertions to prove `/scheduling/appointments` and `/services` are NOT tab routes any more — same number of tests), `messages/en.json`, `messages/es.json`.

**Interfaces:**
- Consumes: Task 2 URL helpers; `useCentroPantalla("citas.read","citas.create")`; `listPacientes` (`lib/api/pacientes.ts`), `getTiposCita`, `getServicios(center)`, `getServiciosConSaldo(patientId, center)`, `Paciente` type, `PacienteFormSheet`, `LiveBadge`, `PageContainer`.
- Produces:
  - `BookingScreen()` — owns state `{ kind, typeId, date, patientId, window: TimeWindow, view: "free" | "booked", month: {year, month0}, movingId: string | null }`, syncs `kind/typeId/date/patientId` to the URL with `router.replace` (`toBookingSearch`), renders the four layouts of the spec's state table, header row (center `<select>` via `CentroPantallaSelector`, Live badge, settings button behind `<Can permiso="citas.config">` → `/scheduling/slots`). Full-height layout: put `useFillViewportHeight` (`hooks/use-fill-viewport-height.ts`) on the work area (rail + calendar row) and give that element the returned `height`; inside it, flex/grid children use `min-h-0` so the month and the day panel share the height and only the rail and day panel scroll internally. No hard-coded `calc(100vh - …)`.
  - `WhosCallingPanel({ center, onPick(p: Paciente) })` — 250 ms debounce, `listPacientes({ q, limit: 8 })`, rows: name, record, phone, center; "+ New patient" opens `PacienteFormSheet`, saved → `onPick`.
  - `TypePickerPanel({ title, center, patientId?, onPick(kind: BookingKind, typeId: string) })` — medical group from `getTiposCita()` (active), service group from `getServicios(center)` (active, by `orden`), colour dots, "N sessions left" from `getServiciosConSaldo` when `patientId`.
  - i18n `appointmentsBooking.*` keys for every string in Tasks 6–9 (titles "Who's calling?", "What are we booking?", "Book for {name}: what?", groups, window labels, Free/Booked, Next free, Morning/Afternoon, "{n} left", full/closed/holiday, Open full day, Move here?, reasons, series labels and statuses, toasts, empty states incl. service not set up).

- [ ] **Step 1: Update `tab-routes.test.ts` assertions first** (they now fail against the current code). **Step 2: Run** `npm test` → those FAIL.
- [ ] **Step 3: Implement** the route swap, `tab-routes.ts` change, the three components (Calendar area renders a placeholder until Task 7) and the i18n keys.
- [ ] **Step 4: Run** `npm run typecheck && npm run lint && npm test` → PASS; `npm run dev` already running on 8080: open `/scheduling/appointments` → the two start panels render; search finds a patient; picking one shows "Book for …".
- [ ] **Step 5: Commit** `feat(appointments): booking screen shell with who's calling and type picker`.

### Task 7: Calendar, day panel, medical booking

**Files:**
- Create: `components/appointments-booking/booking-toolbar.tsx`, `components/appointments-booking/availability-month.tsx`, `components/appointments-booking/day-panel.tsx`
- Modify: `components/appointments-booking/booking-screen.tsx`

**Interfaces:**
- Consumes: Tasks 1, 2, 5; `getFestivos({ anio, centroId })` (`lib/api/festivos.ts:42`); `CitaModal` (`components/agenda/cita-modal.tsx`, props `open, fecha, horaInicial, tipoCitaIdInicial, pacienteInicial, centroId, tipos, medicos, canal="callcenter", onOpenChange, onSaved`); `getMedicos(center)` (`lib/api/personal.ts:171`).
- Produces:
  - `BookingToolbar({ label, typeName, color, onClearType, window, onWindow, nextFree: {date,time}[], onPickNext(date,time) })`.
  - `AvailabilityMonth({ weeks, month0, todayIso, holidays, days, view, window, selected, ringDate?, onSelect(date) })` — cells per spec (number, label, bucket colour; booked view only when `kind === "medical"`), rows share height (`grid-auto-rows: minmax(0,1fr)`), errored day shows "—" and retries on click.
  - `DayPanel({ date, kind, typeName, day, window, picked, onPickTime(time), moving?: { fromLabel: string; needsReason: boolean; onConfirm(reason?: string): Promise<void>; onCancel() }, fullDayHref, children? /* service form slot */ })` — Morning/Afternoon 4-column grids; open = green with "{n} left"; full = dashed grey "full", clickable, tooltip; unavailable = dashed, not clickable, tooltip = translated `reasonKey`; scrolls inside itself.
  - Medical time click (not moving) opens `CitaModal` with presets; `onSaved` → refresh day + month dates + patient rail; service time click renders the service form slot (Task 9).
  - "Next free" = `nextFree(loaded days of visible month, window, 4, {date: today, time: now})`; if fewer than 4 and month is current, also load next month's first 14 bookable days.
  - "Open full day ›": medical `/scheduling/appointments/<date>`, service `/scheduling/appointments/services/<date>`.
  - `notConfigured` service → month replaced by an empty state ("This service has no capacity set up").

- [ ] **Step 1: Implement** the three components and wire them in `booking-screen.tsx`.
- [ ] **Step 2: Run** `npm run typecheck && npm run lint && npm test` → PASS.
- [ ] **Step 3: Manual check on :8080** (prod API, read-only checks): Seguimiento → month numbers render, Morning/Afternoon change the numbers, Free/Booked switches (medical only), a day shows its times with "n left" and dashed full ones, Next free buttons jump to their day, Open full day goes to the day screen, page does not scroll at 1440×900. Do NOT save a booking against production from automation; the owner tests booking.
- [ ] **Step 4: Commit** `feat(appointments): free-spots month, day panel and medical booking`.

### Task 8: Patient rail: upcoming/past, cancel, edit, move

**Files:**
- Create: `components/appointments-booking/patient-rail.tsx`, `hooks/use-patient-appointments.ts`
- Modify: `components/appointments-booking/booking-screen.tsx`, `components/appointments-booking/day-panel.tsx` (move confirmation already in its props)

**Interfaces:**
- Consumes: Task 3; `listCitas({ patientId, from, to, limit: 100 }, center)`; `listSesionesRango({ desde, hasta, pacienteId, centroId })`; `cancelarCita(id, motivo, center)`; `cancelarSesion(id, motivo, center)`; `reagendarCita(id, { date, time, reason, centerId })`; `reagendarSesion(id, date, center, time)` (Task 5); `getCita`; `CitaModal` (edit mode: pass `cita`).
- Produces:
  - `usePatientAppointments(patientId: string | undefined, center: string | undefined): { upcoming: PatientAppointment[]; past: PatientAppointment[]; loading: boolean; reload: () => void }` — range today−90 … today+365.
  - `PatientRail({ patient, center, items: {upcoming, past}, typeLookup(kind, typeId) → {name, color}, movingId, onMove(a), onStopMove(), onEdit(a), onCancelled(a), onClose() })` — cards per spec; cancel inline with required free-text reason; Edit only for medical; actions hidden without `citas.create`/`citas.update` / `frontdesk.create`/`frontdesk.update` (`useCan`).
  - Move flow in `BookingScreen`: `onMove(a)` → `movingId = a.id`, kind/typeId from the appointment, `date` = its date, month = its month; day panel gets `moving` (medical `needsReason: true`); confirm → reschedule call → toast old → new → reload rail, refresh both dates → clear moving. `Esc` or Stop clears moving.

- [ ] **Step 1: Implement** hook, rail and move wiring.
- [ ] **Step 2: Run** `npm run typecheck && npm run lint && npm test` → PASS.
- [ ] **Step 3: Manual check on :8080:** pick a patient with appointments → upcoming/past render for both kinds; Move turns the card blue and rings the current day; Stop restores; Cancel shows the reason box and Keep it closes it. (Confirming a move/cancel against production is left to the owner.)
- [ ] **Step 4: Commit** `feat(appointments): patient rail with move, edit and cancel`.

### Task 9: Service booking form with series

**Files:**
- Create: `components/appointments-booking/service-booking-form.tsx`
- Modify: `components/appointments-booking/day-panel.tsx` (form slot), `booking-screen.tsx`

**Interfaces:**
- Consumes: Task 4; `crearSesion({ patientId, serviceId, date, time }, center)`; `agendarMultiple({ patientId, serviceIds: [id], dates, time }, center)` (check the payload field names against `components["schemas"]["AgendarMultipleDto"]`); `buildRecurringPlan` with an `AvailabilityLookup` backed by `getAvailability(..., areas 1)` for suggestions; `listSesionesRango({ pacienteId, desde, hasta, servicioId, centroId })` for `existingDates`; `PacienteSelect` (`components/citas/paciente-select.tsx`) when no patient is selected; `getFestivos`.
- Produces: `ServiceBookingForm({ center, serviceId, serviceName, date, time, patient: Paciente | null, sessionsLeft?: number, onBooked(patientId: string), onBack() })`:
  - warning when the picked time is full (overbook allowed);
  - `Repeat weekly` → every 1|2 weeks, sessions (default `sessionsLeft ?? 4`, 2–20), rows from `buildSeriesRows` (per-row time `<select>` from that day's slots, status chip, "Use … instead" button when `suggestion`), "Fix the red dates" message and disabled Book when `!canBookSeries`;
  - Book: single → `crearSesion`; series → rows grouped by time: one `agendarMultiple` per distinct time; toast with created count; BE `warnings` and skipped dates shown in a toast; then `onBooked`.

- [ ] **Step 1: Implement** the form and wire it into the day panel for service types.
- [ ] **Step 2: Run** `npm run typecheck && npm run lint && npm test` → PASS.
- [ ] **Step 3: Manual check on :8080:** Láser with a patient → time → form; Repeat weekly lists N dates with statuses; a holiday row is red and Book disabled; changing a row's time updates its status. (Saving left to the owner.)
- [ ] **Step 4: Commit** `feat(appointments): service booking with weekly series`.

### Task 10: Cleanup, handoff, full gate

**Files:**
- Delete if no importers remain (check with grep first): `components/agenda/medicas-calendar.tsx`, `components/agenda/servicios-calendar.tsx`. Keep `month-calendar.tsx` (used by `route-skeleton.tsx`).
- Create: `docs/specs/appointments-availability-range-handoff-be.md` (endpoint from the spec's "BE handoff" section: path, params, response, why: ~26 requests per month view today).
- Modify: `components/route-skeleton.tsx:43` only if its month skeleton no longer resembles the screen (optional).

- [ ] **Step 1:** grep importers; delete dead files; write the handoff.
- [ ] **Step 2: Run** `npm run typecheck && npm run lint && npm test && npm run build` → all pass; test count ≥ the count on `feat/fill-viewport-layout` (record both numbers in the commit body).
- [ ] **Step 3: Commit** `chore(appointments): drop the old tabbed calendars; BE range-availability handoff`.
