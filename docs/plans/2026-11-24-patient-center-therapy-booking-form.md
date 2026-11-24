# Patient Center therapy booking form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patient Center › «Citar» › «Cita de servicio» opens a Citas-style form that books one or several therapies (a train) for one or many dates, replacing `TherapyDayScheduler` on the patient desk only.

**Architecture:** Convert each date's `PatientTrain` (BE plan) into the `DaySlots` shape the Citas series already understands, so the Citas row logic (`buildSeriesRows`, `rowTimeOptions`, `fitLoadedTimes`, `SeriesRows`, `SeriesFrequency`) is reused unchanged. A new hook loads one train plan per row date plus the patient's live sessions and holidays. A new form component composes the therapy list, the Citas frequency control and the Citas rows, and books with `bookTrain` (one row) or `bookTrainSeries` (2+ rows, all or nothing).

**Tech Stack:** Next.js 16, React 19, next-intl, shadcn/ui + the repo kit (`FormDialog`, `Field`, `useSubmit`), `node --test --experimental-strip-types` for `lib/`.

**Spec:** `docs/specs/2026-11-24-patient-center-therapy-booking-form-design.md`

## Global Constraints

- Do not change what the Citas service form renders or does (`components/appointments-booking/service-booking-form.tsx` untouched; shared pieces only widened with optional props whose default keeps today's output).
- `TherapyDayScheduler` stays in its three other users (`app/(app)/scheduling/therapy-day/page.tsx`, `components/frontdesk/frontdesk-board.tsx`, `components/frontdesk/service-board-viewer.tsx`).
- No colored therapy dots, no emoji, no hex/rgba: theme tokens only (cmr-fe `CLAUDE.md` rule 10).
- Every new file < 600 lines; logic in `lib/` with a `*.test.ts` next to it (only `lib/**/*.test.ts` runs).
- Code, comments, i18n keys in English; every new key in both `messages/es.json` and `messages/en.json`; Spanish copy below is the `es` value.
- Dates via `useFormatter` / the existing `useDayLabel()` (`components/appointments-booking/series-rows.tsx`), never `toLocale*` without a locale.
- Kit rules (rule 8): `missing` drives disabled, `reason` + `blocked` explain any other block; `useSubmit` or an in-flight ref guards double submit; a failed booking never closes the dialog.
- Cap: `min(bookable of each ticked therapy, MAX_SESSIONS = 20)`.
- Only therapies with `bookable > 0` from `usePatientBookingRules` are listed (strict Citas rule).
- An hour with `fits: false, selectable: true` is bookable as overbook with the Citas warning; `selectable` false/absent and not fitting = not offered.
- Commit messages in English, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Verified BE facts this plan relies on (cmr-be origin/main 70af8b98)

- `POST /frontdesk/sessions/book-train-series` re-plans each day at its time and is **all or nothing**; a failing day → 409 `THERAPY_SERIES_DAY_DOES_NOT_FIT` (`date`, `reasonKey`, `serviceId`) or another code with `date`; at most 36 days (`MAX_SERIES_DAYS`). (`src/modules/frontdesk/train-booking.controller.ts:79`, `train-series-booking.service.ts`)
- A slot that does not fit is booked with a `THERAPY_TRAIN_OVERBOOKED` warning in `meta.advertencias` when `rules.selectable(reasons)`. (`src/modules/frontdesk/a-full-train-warns.ts`)
- One live row per patient + service + day; `cancelada` rows do not count → 409 `FRONTDESK_SESSION_SAME_DAY`. (`src/modules/frontdesk/one-live-row-a-day.ts`)

## Review Focus

1. **Ticking or unticking a therapy while rows are edited** — rows keep their dates; times re-fit to the new train once each date reloads; the cap shrinks and extra rows produce the over-balance reason, never a silent drop. (Task 1 `trainCap` tests, Task 4 manual check.)
2. **A row date where the patient already has one of the ticked therapies** — the row is blocked "ya tiene este servicio ese día", not a 409 after clicking. (Task 1 `liveSessionDates` test.)
3. **Every hour of a date is unselectable (Sunday, holiday, full staff block)** — the row shows blocked/closed and «Agendar» is grey with "Corrige o quita las fechas en rojo", not a disabled select with no reason. (Task 1 `trainDaySlots` test: all-unselectable day → every slot `unavailable`.)
4. **A series fails on one day** — nothing is booked (all or nothing), the form stays open with every row, the toast names the day, and the hours are re-asked. (Task 4 step, manual check in Task 6.)
5. **Patient with no bookable therapies, or balance read failed / not permitted** — the list says so with the Citas wording and retry; never an empty list that looks like "nothing configured". (Task 3 render branches, Task 6 manual check.)

---

### Task 1: Train → Citas row shapes (pure `lib/`)

**Files:**
- Create: `lib/agenda/booking/train-rows.ts`
- Test: `lib/agenda/booking/train-rows.test.ts`

**Interfaces:**
- Consumes: `PatientTrain`, `TrainSlot` (`lib/api/resources.ts`), `DaySlots`, `normalizeTime` (`lib/agenda/booking/availability.ts`), `MAX_SESSIONS` (`series-booking.ts`), `BookableService` (`lib/api/frontdesk.ts`).
- Produces:
  - `trainDaySlots(train: PatientTrain): DaySlots`
  - `trainEndsAt(train: PatientTrain | null | undefined, time: string): string | null` (HH:mm or null)
  - `trainCap(bookable: ReadonlyMap<string, BookableService> | undefined, serviceIds: readonly string[]): { max: number; limitedBy: string | null; left: number | undefined }` — `left` = smallest bookable among ticked (undefined while unknown or nothing ticked), `limitedBy` = that therapy's id (null when the 20 cap or unknown applies), `max = min(left ?? 20, 20)`.
  - `liveSessionDates(sessions: ReadonlyArray<{ serviceId: string; date: string; status: string }>, serviceIds: readonly string[]): string[]` — sorted unique `date.slice(0,10)` of non-`cancelada` sessions of any ticked service.
  - `trainOrder(train: PatientTrain | null | undefined, ticked: readonly string[]): string[]` — `train.legs[].serviceId` order when present, else `ticked`.

- [ ] **Step 1: Write the failing tests** (`node:test` + `assert/strict`, style of `booking-cap.test.ts`):
  - `trainDaySlots maps fits to open with one free place`: slot `{time:"09:00", fits:true, endsAt:"09:25", legs:[], staffBlocks:[]}` → `{time:"09:00", capacity:1, free:1, state:"open", reasonKey:null}`; result `date` = train.date.
  - `trainDaySlots maps a selectable misfit to full`: `{fits:false, selectable:true, reasonKey:"therapies.full"}` → `state:"full", free:0, reasonKey:"therapies.full"`.
  - `trainDaySlots drops nothing but marks an unselectable misfit unavailable`: `{fits:false}` and `{fits:false, selectable:false}` → `state:"unavailable"`.
  - `trainDaySlots normalizes "9:00:00" to "09:00"`.
  - `trainEndsAt returns the slot's endsAt as HH:mm, null for an unknown time or no train`.
  - `trainCap takes the smallest balance among ticked`: map laser=3, emtt=1; `["laser","emtt"]` → `{max:1, limitedBy:"emtt", left:1}`.
  - `trainCap treats a ticked therapy missing from the map as 0`: → `{max:0, limitedBy:<id>, left:0}`.
  - `trainCap caps at 20`: laser=35 → `{max:20, limitedBy:null, left:35}`.
  - `trainCap unknown`: map undefined or `[]` ticked → `{max:20, limitedBy:null, left:undefined}`.
  - `liveSessionDates ignores cancelled and other services`: sessions laser 2026-11-26 pendiente (counts), emtt 2026-11-27 cancelada (ignored), pemf 2026-11-28 pendiente (not ticked) with ticked `["laser","emtt"]` → `["2026-11-26"]`; a `date` of `"2026-11-26T00:00:00"` dedupes to the same day.
  - `trainOrder uses the BE legs order, falls back to ticked`.

- [ ] **Step 2: Run to verify they fail**
  Run: `npm test -- --test-name-pattern="train"` (or `node --test --experimental-strip-types lib/agenda/booking/train-rows.test.ts`)
  Expected: FAIL, cannot find module `./train-rows.ts`.

- [ ] **Step 3: Implement the five functions in `lib/agenda/booking/train-rows.ts`** with a short English header comment saying why the train is mapped onto `DaySlots` (so the Citas row logic applies unchanged).

- [ ] **Step 4: Run to verify they pass**, then `npm test` (whole suite) — all pass, count went up by the new tests.

- [ ] **Step 5: Commit** `feat(patient-desk): map the therapy train onto the Citas row shapes`

---

### Task 2: Train booking result for the success dialog

**Files:**
- Modify: `lib/agenda/booking/booking-result.ts` (add one export after `serviceBookingResult`)
- Test: `lib/agenda/booking/booking-result.test.ts` (append)

**Interfaces:**
- Produces: `trainBookingResult(input: { patient: BookingResult["patient"]; center: BookingResult["center"]; sessions: ReadonlyArray<{ serviceId: string; date: string; time: string | null }>; serviceName: (id: string) => string; fallbackTime: (date: string) => string; warnings: string[] }): BookingResult` — one `kind: "service"` item per session (`time` = session time, else `fallbackTime(date)`, through `resultTime`), `skipped: []`, via `buildBookingResult`.

- [ ] **Step 1: Write the failing tests**
  - `trainBookingResult lists one row per leg in time order`: sessions laser 2026-11-24 "09:00:00", emtt 2026-11-24 "09:10" → items `[{date:"2026-11-24", time:"09:00", typeName:"Láser", kind:"service"}, {… "09:10", "EMTT" …}]`, `mode:"booked"`.
  - `trainBookingResult uses the day's entry time when a session has none`: time null, `fallbackTime` → "10:00".
  - `trainBookingResult keeps warnings deduped`.
- [ ] **Step 2: Run, expect FAIL** (`trainBookingResult` not exported).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `npm test`, expect PASS.**
- [ ] **Step 5: Commit** `feat(booking): success-dialog result for a therapy train`

---

### Task 3: Availability hook + SeriesRows hint + therapy list

**Files:**
- Create: `hooks/use-train-series-availability.ts`
- Create: `components/patient-desk/therapy-picker-list.tsx`
- Modify: `components/appointments-booking/series-rows.tsx` (one optional prop)
- Modify: `messages/es.json`, `messages/en.json` (new namespace `therapyBooking`)

**Interfaces:**
- Consumes: Task 1 (`trainDaySlots`, `liveSessionDates`), `planPatientTrain`, `listSesionesRango`, `getBookingHolidays`, `runLimited` (`lib/agenda/booking/day-cache.ts`), `SeriesDay` (`hooks/use-series-availability.ts`).
- Produces:
  - `useTrainSeriesAvailability(p: { center: string | undefined; patientId: string | undefined; serviceIds: string[]; areas: Record<string, number>; keepOrder: boolean; dates: string[] }): { days: Record<string, SeriesDay>; trains: Record<string, PatientTrain>; existingDates: string[]; holidays: string[]; ready: boolean; failed: boolean; retry: () => void }`
    - one `planPatientTrain` per date, at most 4 at a time (`runLimited`), cache keyed by `center|patientId|serviceIds(sorted)|areas json|keepOrder|date`; changing any part but `date` drops the cache.
    - `days[date]` = `trainDaySlots(train)` or `"error"`; `trains[date]` = the raw plan (for `endsAt`, legs order, minutes).
    - existing sessions: `listSesionesRango({ desde: min(dates), hasta: max(dates), pacienteId, centroId: center })` → `liveSessionDates(…, serviceIds)`; holidays: `getBookingHolidays(years of dates, center)`; `ready` when both answered (failed counts as answered with `failed: true`).
    - nothing is fetched while `serviceIds` or `dates` is empty or `patientId`/`center` is missing.
  - `SeriesRows` new optional prop `optionHint?: (date: string, time: string) => string | null`. When given, each `SelectItem` shows `shortTime(o.time)` then the hint (muted; warning color when `o.full`) instead of `tDay("left", …)`. Absent = exactly today's output (Citas unchanged).
  - `TherapyPickerList(p: { services: { id: string; name: string; bookable: number; perArea: boolean; minutes: number | null }[]; selected: readonly string[]; order: readonly string[]; areas: Record<string, number>; disabled: boolean; onToggle: (id: string) => void; onAreas: (id: string, n: number) => void })`
    - one `<ul className="divide-y rounded-xl border bg-card">`, one `<li>` per service: a shadcn `Checkbox` with a `<label htmlFor>`, name (`font-medium`), meta `text-xs text-muted-foreground tabular-nums` (minutes when known: `"{n} min"`, per-area `"{n} min por área"`), the Citas success pill `rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success-foreground` with `quedan {n}` (reuse `appointmentsBooking.typePicker.sessionsLeft`), when ticked and `perArea` an areas stepper (reuse the `Stepper` from `components/appointments-booking/series-frequency.tsx` — export it if it is not; 1..6), and with `order.length > 1` the turn `{n}º` in muted tabular text. Ticked row: `bg-accent/50`. No color dots.
- i18n `therapyBooking.*` (es / en): `title` «Programar terapias» / "Book therapies"; `therapies` «Terapias» / "Therapies"; `pickHint` «Marca una o varias.» / "Tick one or more."; `noneBookable` «No tiene terapias con sesiones disponibles. Pásalo por facturación para añadirlo.» / "No therapies with sessions left. Send them to billing to add one."; `minutes` «{n} min»; `minutesPerArea` «{n} min por área» / "{n} min per area"; `areas` «Áreas» / "Areas"; `turn` «{n}º» / "#{n}"; `clinicTime` «{n} min en la clínica» / "{n} min at the clinic"; `endsAt` «– {time}» / "– {time}"; `bookVisits` «Agendar {n, plural, one {# visita} other {# visitas}}» / "Book {n, plural, one {# visit} other {# visits}}"; `overCap` «Solo le quedan {n, plural, one {# sesión} other {# sesiones}} de {therapy} por agendar.» / "Only {n, plural, one {# session} other {# sessions}} of {therapy} left to book."; `seriesDayFailed` «El {date} ya no cabe: no se agendó nada de la serie.» / "{date} no longer fits: nothing in the series was booked.".

- [ ] **Step 1: Add the `optionHint` prop to `SeriesRows`** with a one-line English comment; run `npm run typecheck` — PASS; confirm `service-booking-form.tsx` is unchanged (`git diff --stat` lists only `series-rows.tsx`).
- [ ] **Step 2: Write `hooks/use-train-series-availability.ts`** per the interface (model the cache/limit/scope-reset pattern on `hooks/use-series-availability.ts` lines 60-140; no suggestions).
- [ ] **Step 3: Write `components/patient-desk/therapy-picker-list.tsx`** per the interface.
- [ ] **Step 4: Add the i18n keys to both catalogues.**
- [ ] **Step 5: Verify** `npm run typecheck && npm run lint && npm test` — all PASS.
- [ ] **Step 6: Commit** `feat(patient-desk): train availability per date and the therapy list`

---

### Task 4: The form

**Files:**
- Create: `components/patient-desk/therapy-booking-form.tsx`
- Create (if the form passes ~450 lines): `lib/agenda/booking/train-form.ts` + test, for the reason/missing/title selection logic.

**Interfaces:**
- Consumes: Tasks 1–3, `SeriesFrequency` + `SeriesMode`, `SeriesRows`, `useDayLabel`, `generateWeeklyPattern`, `fitLoadedTimes`, `addItem`, `nextDate`, `replaceDate`, `dropRow`, `setRowTime`, `overridesOf`, `buildSeriesRows`, `canBookSeries`, `seriesHealth`, `seriesSpan`, `weekdayOf`, `usePatientBookingRules`, `getServicios`, `listResources` (per-area ids, as in `therapy-day-scheduler.tsx:94-110`), `getCentrosDondePuedo("pacientes.read")` (patient centers for the balance, as `booking-screen.tsx` does), `bookTrain`, `bookTrainSeries`, `trainBookingResult`, `useBookingResult`, `mostrarAvisos`, `FormDialog`, `Field`.
- Produces: `TherapyBookingForm(p: { patient: { id: string; name: string; record?: string | null }; center: string | undefined; defaultDate: string; defaultServiceId?: string; onClose: () => void; onBooked: () => void })`

Behavior (decided; the implementer writes it):
- State: `selected: string[]` (starts `[defaultServiceId]` when it is bookable), `areas`, `keepOrder` (false), `mode` (manual), `days`, `totalChoice`, `edits` — the same edit/regenerate model as `service-booking-form.tsx` lines 128-160 with `genKey` also including the ticked ids.
- Rows: `buildSeriesRows({ dates, time: rows[0] entry time, overrides, days: loaded trainDaySlots, holidays, existingDates })` — duplicate dates come out `blocked/duplicate`, holidays `blocked/holiday`. Initial time: first `fits` hour of `defaultDate`'s train (via `fitLoadedTimes` with `fitTime: true` on the first item).
- `SeriesRows` gets `optionHint={(date, time) => endsAt ? t("endsAt", { time: shortTime(endsAt) }) + (full ? " · " + tSeries("fullShort") : "") : null}` from `trainEndsAt(trains[date], time)`; `onSuggestion` is a no-op (no suggestions for the train; rows have none).
- List meta minutes: from `trains[rows[0].date].legs` (`TrainLegInfo.minutes`, per area for per-area legs = `minutes / areas`); `null` for unticked therapies (the BE gives no duration without a plan).
- Cap: `trainCap(rules.bookable, selected)` → `SeriesFrequency maxTotal`, «+ Añadir fecha» disabled at `max`.
- Title: `${order names joined " + "} · ${dayLabel(rows[0].date)} · ${shortTime(rows[0].time)}`; nothing ticked → `t("title") · dayLabel(defaultDate)`.
- Under the list (≥1 ticked): `{order joined " → " when ≥2} · t("clinicTime", { n: train.patientMinutes })` and, with ≥2, the «Mantener mi orden» `Switch` (reuse `therapyPlanner.keepOrder`).
- `missing` = `missingFields([[t("therapies"), selected.length > 0]])`; `reason` in this order: permissions loading → no `frontdesk.create` (`appointmentsBooking.series.noPermission`) → balance hidden/failed/checking (Citas keys) → `rows.length > max` (`overCap` with `limitedBy` name) → rows still checking/failed/blocked (Citas `checking`/`checkFailed`/`fixRed`) → null. `blocked = !!reason`.
- Submit: one row → `bookTrain({ patientId, date, time, serviceIds: order, areas, keepOrder }, center)`; 2+ → `bookTrainSeries({ patientId, areas, keepOrder, days: rows.map(r => ({ date: r.date, time: r.time, serviceIds: order })) }, center)`. On success: `mostrarAvisos(warnings)`, `mostrarAvisos(advertencias)`, `showResult(trainBookingResult(…))`, `onBooked()`. On error: `THERAPY_TRAIN_DOES_NOT_FIT` / `THERAPY_SERIES_DAY_DOES_NOT_FIT` → toast (`seriesDayFailed` with the formatted `date` when present, else the reason text as `therapy-day-scheduler.tsx:192-205` builds it) and `retry()` the availability; `THERAPY_TRAIN_ROLLBACK_INCOMPLETE` → the existing persistent toast (`therapy-day-scheduler.tsx:207-215`); anything else → `useSubmit`'s generic toast. The dialog stays open with every row on any error.
- Footer submit label: one row `appointmentsBooking.series.book`, else `bookVisits`.
- Full-row warning line `appointmentsBooking.series.fullWarning` when any row is `full`, as Citas.

- [ ] **Step 1: If the selection logic is extracted, write its failing tests first** in `lib/agenda/booking/train-form.test.ts` (reason order: over-cap beats fixRed; nothing ticked → missing only, reason null), run, expect FAIL, implement, PASS.
- [ ] **Step 2: Write the component.** File < 600 lines (`npm run lint` enforces).
- [ ] **Step 3: Verify** `npm run typecheck && npm run lint && npm test` — PASS.
- [ ] **Step 4: Commit** `feat(patient-desk): book therapies with the Citas form`

---

### Task 5: Wire it into the patient desk

**Files:**
- Modify: `components/patient-desk/patient-desk.tsx:517-545` (the `schedule` `<Dialog>`), and its imports.

- [ ] **Step 1:** Replace the `<Dialog>…<TherapyDayScheduler/>…</Dialog>` block with `{schedule.open && schedule.pacienteId && <TherapyBookingForm patient={{ id: schedule.pacienteId, name: schedule.pacienteNombre ?? "" }} center={gate.centro} defaultDate={date} defaultServiceId={schedule.servicioId} onClose={() => setSchedule({ open: false })} onBooked={() => { data.refresh(); setSchedule({ open: false }); }} />}`. Remove now-unused imports (`TherapyDayScheduler`, `Dialog*` if unused). If «Citar» can open without a patient, keep the old dialog for that case only and say so in the commit — check `onSchedule` callers first.
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm test && npm run build` — PASS. `git grep -n TherapyDayScheduler` still lists the three other users.
- [ ] **Step 3: Commit** `feat(patient-desk): «Cita de servicio» opens the new therapy form`

---

### Task 6: See it working (rule 10 "done means seen")

- [ ] **Step 1:** `npm run dev` (port 8080) against a local or prod-pointed BE with a test login; open `/boards/patient-desk`, «Citar» › «Cita de servicio» on a patient with ≥2 bookable therapies.
- [ ] **Step 2: Walk the Review Focus list** plus: one therapy today; two with keep-order on/off (turns flip); laser areas 1→3 (hours re-asked, end time grows); Semanal 3 days × total; «+ Añadir fecha» to the cap; a full hour (warning, books with an advertencia toast); the success dialog lists one row per leg; Citas service form looks exactly as before.
- [ ] **Step 3:** Screenshots: light + dark, desktop + 375px, loading / empty (no bookable therapies) / error (balance failed). Keep them for the PR.
- [ ] **Step 4:** Fix what the walk finds, re-run `npm run typecheck && npm run lint && npm test`, commit `fix(patient-desk): …` per fix.

Do not book against production data without the owner's OK; prefer a local BE or a test patient.
