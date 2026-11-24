# Appointments Booking Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Success modal with print, Manual/Semanal service series, move-as-dialog, and paid-only / new-vs-follow-up booking rules on the appointments booking screen.

**Architecture:** Two repos. Part A is a small cmr-be PR adding two reads (visit kind; bookable services across centers), merged and deployed first. Part B is one cmr-fe PR: pure logic in `lib/agenda/booking/*` (tested with `node --test`), thin components in `components/appointments-booking/*`.

**Tech Stack:** cmr-be: NestJS 11, TypeORM 0.3, Jest. cmr-fe: Next.js 16, React 19, next-intl, Tailwind v4, kit components, `node --test --experimental-strip-types`.

**Spec:** `docs/specs/2026-11-23-appointments-booking-upgrades-design.md` (cmr-fe). Read it first.

## Global Constraints

- English for code, identifiers, comments, commit messages, i18n keys; Spanish allowed only in `docs/` and `messages/es.json` values. Every new key lands in BOTH `messages/es.json` and `messages/en.json`.
- cmr-fe: new files < 600 lines (`max-lines` in `eslint.config.mjs`); `components/agenda/cita-modal.tsx` is 599 — it must not grow past its limit.
- cmr-fe tests only run from `lib/**/*.test.ts` (`npm test`). Logic goes in `lib/`.
- cmr-fe forms: `FormDialog` / kit `Field`; `missing` drives disabled; a block always has a `reason`.
- Dates: `useFormatter()` + named formats + `parseDayUTC`; never `toLocale*` without a locale.
- cmr-be: endpoints serve v1 **and** v2 (Spanish + English paths); `@Permissions`/`@AnyPermission` on every route; an MCP tool for each new read; Swagger `@ApiOperation`; `*.spec.ts` beside code; `npm run lint:ceilings` / `lint:limites` pass; spec + plan exist in `cmr-be/docs/specs` and `cmr-be/docs/plans`.
- Medical type slugs are the BE's: `nueva`, `seguimiento`.
- Session states (BE `SESION_ESTADOS`): `pendiente | presente | en_terapia | asistido | cancelada`.
- `MAX_SESSIONS = 20` (existing, `lib/agenda/booking/series-booking.ts`).
- Printout: no prices, no clinical data.
- Merging to cmr-be `main` deploys production: Part A merges only with the owner's go-ahead.

## Review Focus

1. **Patient switched while the form is open** (picked inside `PacienteSelect`): bookable count and cap must recompute for the new patient; expect the cap to follow the new patient, not the old one. → Task B6 test `capFor` with a changed balance.
2. **Old unmarked sessions** (the clinic never marks no-shows): a past `pendiente` session must NOT count as booked, or balances shrink forever. → Task A2 test "past pendiente is not booked".
3. **Semanal started on a day not in the chosen weekdays / near a Sunday / count smaller than days-per-week**: rows must start on the picked day, never on Sunday, and stop exactly at `count`. → Task B2 tests.
4. **Visit-kind read fails or is slow**: both medical types must show (never an empty medical group, never blocked). → Task B4 test `filterMedicalTypes(types, undefined)`.
5. **Partial series failure then success modal**: the modal must list only what was actually created, and skipped dates with reasons. → Task B3 test `buildBookingResult` with skipped + created mismatch.

---

## Part A — cmr-be (worktree off `origin/main`, branch `feat/booking-rules-reads`)

Setup: `cd /Users/diegoolalde/Documents/Dev/cmr/cmr-app/cmr-be && git fetch origin && git worktree add -b feat/booking-rules-reads ../cmr-be-booking-rules origin/main`, then `npm ci` there. (gh account: `GH_TOKEN=$(gh auth token --user metadiego)` for fetch/push.)

### Task A0: BE spec + plan docs

**Files:**
- Create: `docs/specs/2026-11-23-booking-rules-reads.md` (goals, the two endpoints with shapes from cmr-fe spec §4b, the "booked" definition below, non-goals: no write-path enforcement)
- Create: `docs/plans/2026-11-23-booking-rules-reads.md` (Tasks A1–A3 of this plan, with the file paths below)

- [ ] Write both docs (Spanish allowed). Commit: `docs: booking rules reads spec and plan`.

### Task A1: visit kind read

**Files:**
- Modify: `src/modules/citas/citas.service.ts` (make `yaFueAtendido` reachable: add public `visitKind(patientId: string): Promise<{ attendedBefore: boolean; nextVisitType: 'nueva' | 'seguimiento' }>` that calls it; do not add a second query)
- Modify: the citas controller that owns `/citas` routes (find with `git grep -n "Controller({ path: \['citas'" src/modules/citas`) — add `@Get(['pacientes/:pacienteId/tipo-de-visita', 'patients/:pacienteId/visit-kind'])`, `@Permissions('citas.read')` (match the permission key the module's other reads use), `ParseUUIDPipe`, `@ApiOperation`. Mind route order: literal segments before `:id` (`src/core/rutas/la-literal-va-antes-del-comodin.ts`).
- Modify: MCP tools for citas (`src/modules/mcp/tools/citas*.tools.ts`) — tool `patient_visit_kind`, same permission.
- Test: `src/modules/citas/citas.service.spec.ts` (or a new `visit-kind.spec.ts` beside it)

**Interfaces:**
- Produces: `GET /api/v2/appointments/patients/:patientId/visit-kind` → `{ data: { attendedBefore: boolean, nextVisitType: "nueva" | "seguimiento" } }`

- [ ] **Step 1: failing tests** — `visitKind` returns `{attendedBefore:true,nextVisitType:'seguimiento'}` when the repo has an `atendida` appointment for the patient, `{false,'nueva'}` otherwise.
- [ ] **Step 2:** `npm test -- src/modules/citas` → FAIL.
- [ ] **Step 3:** implement service method, route, MCP tool.
- [ ] **Step 4:** `npm test -- src/modules/citas src/modules/mcp src/core` → PASS (includes `route-permissions.spec.ts`, `ruta-en-ingles.spec.ts`, `mcp-parity.spec.ts`).
- [ ] **Step 5:** commit `feat(appointments): visit-kind read for the booking screen`.

### Task A2: bookable services read

**Files:**
- Create: `src/modules/frontdesk/bookable-services.ts` — pure function:
  ```ts
  export interface BookableInput {
    services: { id: string; grupoFacturacionId: string | null; productoId: string | null }[]; // booking center's active catalogue
    packages: { clinicId: string; productoId: string; pendiente: number }[];                  // pendientesEntrega over the read scope
    groupProducts: Map<string, Set<string>>;                                                   // group id → product ids
    booked: { serviceId: string }[];  // upcoming sessions, already filtered (see below), any center, mapped to the BOOKING center's service id
  }
  export interface BookableService {
    serviceId: string; bought: number; booked: number; bookable: number;
    sources: { centerId: string; bookable: number }[];
  }
  export function bookableServices(i: BookableInput): BookableService[]; // only bookable > 0, sorted by bookable desc
  ```
  `bought` = Σ `pendiente` of packages matching the service (by group's products, else by `productoId`; a service with neither matches nothing — strict rule). `bookable = max(0, bought − booked)`. `sources`: per package clinic, its share of `pendiente` (booked subtracted from the booking center first, then others in name order — Claude's call; document it in the code comment).
- Create: `src/modules/frontdesk/bookable-services.service.ts` — gathers inputs:
  - packages: `DisponibilidadDeSesionesService.pendientesEntrega(patientId, clinicWhere(scope))`
  - scope: `CentrosAutorizadosService.readScope(user, 'frontdesk.read', centerIds)` (pattern: `src/modules/facturacion/delivery-pending.controller.ts`)
  - **booked** (Claude's call, spec §4b): `frontdesk_sessions` of the patient with `estado IN ('pendiente','presente','en_terapia')` AND `fecha >= today` (center's local date, use the existing PR-date helper the module already uses), any clinic in scope; each session's `servicioId` mapped to the booking center's service sharing its `grupoFacturacionId` (else `productoId`).
  - center names via `CentrosAutorizadosService.withClinicNames` (or the same lookup it uses) → `sources[].centerName`.
- Modify: `src/modules/frontdesk/frontdesk.controller.ts` — `@Get(['pacientes/:pacienteId/servicios-agendables', 'patients/:pacienteId/bookable-services'])`, query `centerIds?: string[]` (reuse the DTO shape of `DeliveryPendingQueryDto`), `@Permissions('frontdesk.read')`. Booking center = tenant (`X-Tenant-ID`). If the controller is at its ceiling (`scripts/file-ceilings.js`), put the route in a new small controller as `delivery-pending.controller.ts` does.
- Modify: MCP frontdesk tools — `patient_bookable_services`.
- Test: `src/modules/frontdesk/bookable-services.spec.ts`

**Interfaces:**
- Produces: `GET /api/v2/frontdesk/patients/:patientId/bookable-services?centerIds=a&centerIds=b` (header `X-Tenant-ID` = booking center) → `{ data: Array<{ serviceId, bought, booked, bookable, sources: Array<{ centerId, centerName, bookable }> }> }`

- [ ] **Step 1: failing tests** for `bookableServices`:
  - group-linked service: two packages (5 + 3) of products in the group → `bought 8`.
  - product-linked service (no group) → matches by `productoId`.
  - unlinked service → not in result even if a package exists.
  - `booked 6` of `bought 10` → `bookable 4`; `booked ≥ bought` → absent.
  - packages in two clinics → two `sources`, booking clinic consumed first.
  - service-level test: **past `pendiente` session is not booked**; `cancelada` and `asistido` are not booked; a session of another center's service with the same group counts.
- [ ] **Step 2:** `npm test -- src/modules/frontdesk/bookable-services` → FAIL.
- [ ] **Step 3:** implement pure function, service, route, MCP tool, module wiring.
- [ ] **Step 4:** `npm test -- src/modules/frontdesk src/modules/mcp src/core` → PASS; `npm run build && npm run lint:limites && npm run lint:ceilings` → clean.
- [ ] **Step 5:** commit `feat(frontdesk): bookable services across centers for the booking screen`.

### Task A3: open the BE PR

- [ ] `npm run lint` (advisory), `npm test` (full) → green. Push, open PR "Booking rules reads" (Spanish description OK) linking the cmr-fe spec. **Do not merge** without the owner; merging deploys.

---

## Part B — cmr-fe (worktree `cmr-fe-booking-upgrades`, branch `feat/appointments-booking-upgrades`)

Run `npm ci` once. Gate for every task: `npm test && npm run typecheck && npm run lint`.

### Task B1: API clients for the two reads

**Files:**
- Modify: `lib/api/frontdesk.ts` — `export interface BookableService { serviceId: string; bought: number; booked: number; bookable: number; sources: { centerId: string; centerName: string; bookable: number }[] }` and `getBookableServices(patientId: string, bookingCenterId: string, centerIds: string[]): Promise<BookableService[]>` → `apiFetch('/frontdesk/patients/${id}/bookable-services?centerIds=…', {}, bookingCenterId)`.
- Modify: `lib/api/citas.ts` (or wherever `crearCitaAgenda` lives) — `getVisitKind(patientId: string, centerId?: string): Promise<{ attendedBefore: boolean; nextVisitType: "nueva" | "seguimiento" }>` → `/appointments/patients/${id}/visit-kind`.
- Run `npm run gen:api` against a local cmr-be on the Part A branch if `schema.d.ts` types are used; otherwise hand-typed interfaces as above.

- [ ] Implement; `npm run typecheck` → clean. Commit `feat(api): bookable services and visit kind clients`.

### Task B2: weekly pattern generator

**Files:**
- Modify: `lib/agenda/booking/series-edit.ts`, Test: `lib/agenda/booking/series-edit.test.ts`

**Interfaces:**
- Produces:
  - `generateWeeklyPattern(start: string, weekdays: readonly number[], count: number): EditableItem[]` — weekdays 1..6 (Mon..Sat, JS `getUTCDay` numbering); start's weekday is always included even if absent from `weekdays`; walks forward from `start` (inclusive), skips Sunday, stops at `count` rows. Holidays NOT skipped.
  - `toggleWeekday(selected: number[], day: number, startDay: number, perWeek: number): { days: number[]; perWeek: number }` — `startDay` cannot be removed; adding beyond `perWeek` bumps `perWeek`.
  - `setPerWeek(selected: number[], perWeek: number, startDay: number): number[]` — clamps 1..6; lowering below `selected.length` drops the most recently added non-start days.
  - `daysMatch(selected: number[], perWeek: number): boolean`.

- [ ] **Step 1: failing tests:**
  - `generateWeeklyPattern("2026-11-25", [3,5], 4)` → dates `["2026-11-25","2026-11-27","2026-12-02","2026-12-04"]` (Wed start).
  - start Saturday `"2026-11-28"`, `[1,6]`, 3 → `["2026-11-28","2026-11-30","2026-12-05"]` (no Sunday).
  - `count` 1 → only the start.
  - start weekday missing from `weekdays` → still first row.
  - `toggleWeekday([3],3,3,1)` → unchanged (start locked); `toggleWeekday([3],5,3,1)` → `{days:[3,5], perWeek:2}`.
  - `setPerWeek([3,5,1],2,3)` → `[3,5]`; `setPerWeek([3],9,3)` → clamps, returns `[3]` (perWeek 6 is the caller's clamp: test `clampPerWeek(9) === 6` if you add it).
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(booking): weekly pattern generator`.

### Task B3: booking result model + success dialog with print

**Files:**
- Create: `lib/agenda/booking/booking-result.ts`, Test: `lib/agenda/booking/booking-result.test.ts`
- Create: `components/appointments-booking/booking-result-dialog.tsx`
- Modify: `app/globals.css` — `@media print` block for `.appointments-print`, modelled on the `.formato-print` block (hide everything else, neutralise `[role="dialog"]` transform/overflow/max-height, show the block, black on white, Letter).
- Modify: `messages/es.json`, `messages/en.json` — namespace `appointmentsBooking.result`: `bookedTitle` ("Citas agendadas"/"Appointments booked"), `movedTitle` ("Cita movida"/"Appointment moved"), `print` ("Imprimir"/"Print"), `close`, `colDate`, `colTime`, `colService`, `colDoctor`, `skippedTitle`, `warningsTitle`, `printHeading` ("Sus próximas citas"/"Your upcoming appointments"), `printCallUs` ("Si no puede asistir, llame al {phone}."/"If you cannot attend, call {phone}."), `record` ("Récord {n}").

**Interfaces:**
- Produces:
  ```ts
  export interface BookingResultItem { date: string; time: string; typeName: string; kind: "medical" | "service"; doctor?: string | null; from?: { date: string; time: string } }
  export interface BookingResult { mode: "booked" | "moved"; patient: { name: string; record?: string | null }; center: { name: string; phone?: string | null; address?: string | null }; items: BookingResultItem[]; skipped: { date: string; reason: string }[]; warnings: string[] }
  export function buildBookingResult(input: Omit<BookingResult, "items"> & { items: BookingResultItem[] }): BookingResult // sorts items by date+time, dedupes identical date+time+typeName, drops skipped dates that also appear as created
  ```
  `BookingResultDialog({ result, onClose }: { result: BookingResult; onClose: () => void })` — `FormDialog` size `lg`, title by mode, table of items (`tabular-nums`, dates via `useFormatter` `dayWeekdayShort` + `parseDayUTC`), skipped and warnings lists when non-empty, `actions` = Imprimir (`window.print()`, outline) + Cerrar (primary, `onSubmit={onClose}`); a `.appointments-print` block `hidden print:block` with center name/address/phone, patient name + record, the table, `printCallUs` only when phone exists.
- [ ] **Step 1: failing tests:** sort order across dates/times; dedupe; skipped date also created → removed from skipped; moved item keeps `from`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** commit `feat(booking): success dialog with printable appointment list`.

### Task B4: type-list rules (medical by visit kind, services by bookable)

**Files:**
- Modify: `lib/agenda/booking/type-list.ts`, Test: `lib/agenda/booking/type-list.test.ts`
- Create: `hooks/use-patient-booking-rules.ts` — `usePatientBookingRules(patientId: string | undefined, bookingCenter: string | undefined, centerIds: string[]): { visitKind: VisitKind | undefined; bookable: Map<string, BookableService> | undefined; bookableState: "idle" | "loading" | "ok" | "fail"; reloadBookable: () => void }` using `useResource` and the Task B1 clients. Shared by the type list and the booking form (one fetch per patient+center; the screen owns it and passes it down).
- Modify: `components/appointments-booking/type-list-panel.tsx` — replace `getServiciosConSaldo` with the hook's data; with a patient: one services group (`typePicker.patientServices` "Servicios de {name}"), each row's count = `bookable`; empty → `typePicker.noBookable` ("No tiene servicios con sesiones disponibles. Pásalo por facturación para añadirlo." / "No services with sessions left. Send them to billing to add one."); loading → skeleton rows (`kit/skeletons.tsx`); fail → `ErrorState` + retry. Rows whose `sources` include a center ≠ booking center show `typePicker.otherCenter` ("Comprado en {center}").
- Modify: `components/appointments-booking/booking-screen.tsx` — own the hook; pass to `TypeListPanel` and `ServiceBookingForm`; when a patient is set and the URL's service `typeId` is not in `bookable` (state ok), clear the type.
- Modify: `messages/*.json` — keys above.

**Interfaces:**
- Produces (lib):
  ```ts
  export type VisitKind = { attendedBefore: boolean };
  export function filterMedicalTypes<T extends { slug: string }>(types: T[], kind: VisitKind | undefined): T[] // attended → drop 'nueva'; not attended → drop 'seguimiento'; undefined → all
  export function bookableServicesList<T extends { id: string }>(services: T[], bookable: ReadonlyMap<string, { bookable: number }> | undefined): T[] | undefined // undefined while unknown; only bookable > 0, sorted by bookable desc
  ```
  `typeListGroups` gains `patientMode: boolean`: in patient mode, groups are `medical` + `patientServices` (no `packages`/`services`); without a patient, unchanged. Existing tests keep passing (rule 4: none deleted).
- [ ] **Step 1: failing tests:** `filterMedicalTypes` three cases (incl. `undefined` → all, and other slugs untouched); `bookableServicesList` filters 0, sorts, returns `undefined` when map is `undefined`; `typeListGroups` patient mode shape and empty group kept when not searching.
- [ ] **Step 2–4:** FAIL → implement → PASS; then wire components; `npm run typecheck && npm run lint`.
- [ ] **Step 5:** commit `feat(booking): only bookable services and the right first/follow-up type for a patient`.

### Task B5: Manual | Semanal frequency UI

**Files:**
- Create: `components/appointments-booking/series-frequency.tsx` — the controls only: `SegmentedControl` Manual/Semanal; when Semanal: per-week stepper, Mon–Sat weekday chips (`aria-pressed`), total stepper. Props: `{ mode: "manual" | "weekly"; onMode; perWeek; days; startDay; onDays(next: {days:number[]; perWeek:number}); total; maxTotal; onTotal; disabled }`. Weekday labels via `useFormatter` (`weekday: "short"` on `parseDayUTC` of a known week) — no hardcoded names.
- Modify: `components/appointments-booking/service-booking-form.tsx` — replace `repeat`/`everyWeeks`/`countChoice` with `mode` (default `"manual"`), `perWeek`, `days`, `total`. Rows: manual → `[start]` + added rows (existing `addItem`/`nextDate(items, 1, today)`); weekly → `generateWeeklyPattern(date, days, total)`. `genKey` includes mode/days/total. One row → `crearSesion` path; 2+ → existing series path. Submit label: 1 row `series.book`, else `series.bookSeries`.
- Modify: `messages/*.json` under `appointmentsBooking.series`: add `manual` ("Manual"), `weeklyPattern` ("Semanal"/"Weekly"), `timesPerWeek` ("Veces por semana"/"Times per week"), `days` ("Días"/"Days"), `total` ("Citas"/"Appointments"), `pickDaysReason` ("Elige {n, plural, one {# día} other {# días}} de la semana."), `maxPerBooking` ("Hasta {n} por vez."); remove `once`, `weekly`, `biweekly` from both.

- [ ] Implement; `reason` when `!daysMatch(days, perWeek)` → `series.pickDaysReason`; `npm test && npm run typecheck && npm run lint` (line limits) → clean.
- [ ] Commit `feat(booking): manual or weekly-pattern service series`.

### Task B6: cap by bookable balance, other-center warning, in-form patient check

**Files:**
- Create: `lib/agenda/booking/booking-cap.ts`, Test: `lib/agenda/booking/booking-cap.test.ts`
- Modify: `components/appointments-booking/service-booking-form.tsx` (receives `bookable: BookableService | undefined`, `bookableState` from the screen hook; when the patient is picked inside the form, the form calls `usePatientBookingRules` itself for that patient)
- Modify: `messages/*.json`: `series.noBalanceReason` (same text as `typePicker.noBookable`), `series.overBalanceReason` ("Solo le quedan {n, plural, one {# sesión} other {# sesiones}} por agendar."), `series.otherCenterWarning` ("Este paquete se compró en {center}; estás agendando en {here}.")

**Interfaces:**
- Produces:
  ```ts
  export function capFor(bookable: number | undefined): { max: number; defaultTotal: number; limitedBy20: boolean } // max = min(bookable, MAX_SESSIONS); defaultTotal = max; undefined → max MAX_SESSIONS (unknown: rule not applied, form shows reason while loading)
  export function balanceReason(rows: number, bookable: number | undefined): "noBalance" | "overBalance" | null
  export function otherCenters(sources: { centerId: string; centerName: string; bookable: number }[], bookingCenter: string): string[] // names of other centers with bookable > 0
  ```
- [ ] **Step 1: failing tests:** `capFor(10)` → `{max:10,defaultTotal:10,limitedBy20:false}`; `capFor(35)` → `{20,20,true}`; `capFor(0)` → `{0,0,false}`; `balanceReason(3, 2)` → `"overBalance"`; `balanceReason(1, 0)` → `"noBalance"`; `balanceReason(2,2)` → `null`; **patient switch**: `capFor` result changes when called with the new patient's bookable (pure — assert two calls); `otherCenters` excludes the booking center and zero-balance sources.
- [ ] **Step 2–4:** FAIL → implement → PASS; wire: Semanal total stepper max = `cap.max`; Manual "+ Añadir fecha" disabled at `cap.max`; `reason` from `balanceReason`; `bookableState === "loading"` → reason `series.checking`; warning line under the patient when `otherCenters` non-empty.
- [ ] **Step 5:** commit `feat(booking): cap bookings by the patient's bookable balance`.

### Task B7: results wired into every booking path

**Files:**
- Modify: `components/appointments-booking/service-booking-form.tsx` — `ServiceBooked` gains `result: BookingResult`; build it with `buildBookingResult` from created sessions, skipped dates (reason: `toasts.skipped` text per date) and translated warnings; drop the success and warning toasts (error toasts stay).
- Create: `components/appointments-booking/booking-result-provider.tsx` — `BookingResultProvider` (holds `BookingResult | null`, renders `BookingResultDialog`) and `useBookingResult(): { show: (r: BookingResult) => void }`. Mount once in `components/app-shell.tsx` (inside the intl/Me providers).
- Modify: `components/agenda/cita-modal.tsx` — **no prop, for every caller** (owner): on **create**, drop `toast.success`, `mostrarAvisos`, `avisarReagendo`; instead build a `BookingResult` (mode `"moved"` with `from` = the previous appointment's date/time via `getCita` when `rescheduledFromId` is set, else `"booked"`; warnings translated; patient, type name, doctor, center from the modal's own state/centros) and call `useBookingResult().show(…)`, then `onSaved` as today. **Edit** keeps `toast.success(t("updated"))`. To keep ≤ its limit, move the warnings-to-strings mapping and the result building into `lib/agenda/appointment-result.ts` (+ test) and the `getCita` lookup into a small hook.
- Modify: `components/appointments-booking/booking-screen.tsx` and `service-booking-form.tsx` — the service path calls `useBookingResult().show(result)` on booking (no screen-level state). Center info from the loaded centers list (`name`, `phone`, `address`); patient name + `record` from `patient`.

- [ ] Implement; tests for any mapping moved to `lib/`; gate clean.
- [ ] Commit `feat(booking): show the success dialog after every booking`.

### Task B8: move as a dialog

**Files:**
- Create: `components/appointments-booking/move-appointment-dialog.tsx` — `MoveAppointmentDialog({ moving, typeName, toLabel, full, onClose }: { moving: DayPanelMoving; typeName: string; toLabel: string; full: boolean; onClose: () => void })`: `FormDialog` size `md`, title `move.dialogTitle` ("Mover cita"/"Move appointment"), `typeName`, `move.fromTo`, `move.fullWarning` when full, reason `Field` (required when `moving.needsReason`, `useDialogForm` keyed by `toLabel`), `missing` via `missingFields`, submit `move.confirm`, cancel = `onClose`. Moving is outward → `onSubmit={() => {}}` + `actions` (rule 8: Enter must not fire it).
- Modify: `components/appointments-booking/day-panel.tsx` — delete `MoveBox`; when `picked && moving`, render `MoveAppointmentDialog`; `onClose` un-picks the time only (move mode stays).
- Modify: `components/appointments-booking/booking-screen.tsx` — `moving.onConfirm`: on success replace `toast.success(moved)` with `show(buildBookingResult({ mode: "moved", … items: [{ …to, from }] }))` (`useBookingResult`).
- Modify: `messages/*.json` — `move.dialogTitle`; remove `move.title` and `move.notThis` if unused, and `toasts.moved` if unused (grep first).

- [ ] Implement; gate clean. Commit `feat(booking): move an appointment in a dialog`.

### Task B9: create a patient from the booking forms

**Files:**
- Create: `components/citas/patient-picker-with-create.tsx` — `PatientPickerWithCreate({ id, value, onChange, centerIds }: { id?: string; value: Paciente | null; onChange: (p: Paciente | null) => void; centerIds?: string[] })`: `PacienteSelect` + `<Can permiso="pacientes.create">` button `«+ Nuevo paciente»` (reuse the key the who's-calling panel uses for `newPatient`, or add `appointmentsBooking.newPatient` to both catalogues) + `PacienteFormSheet` (`onSaved` → close sheet, `onChange(saved)`). Pattern: `components/appointments-booking/whos-calling-panel.tsx:58-131`.
- Modify: `components/agenda/cita-modal.tsx:485` — swap `PacienteSelect` for `PatientPickerWithCreate` (net line count must not grow; the patient-change handler that auto-selects «Nueva»/«Seguimiento» must run for the new patient too).
- Modify: `components/appointments-booking/service-booking-form.tsx:296` — same swap.

- [ ] Implement; check the sheet stacks above the dialog (focus trap, Esc closes only the sheet) in the browser; gate clean.
- [ ] Commit `feat(booking): create a new patient from the appointment dialogs`.

### Task B10: browser QA and PR

- [ ] Run cmr-be Part A branch locally (`npm run start:dev`, port 3000) and `npm run dev` (8080). QA, light + dark, desktop + 375px:
  - service: Manual 1 row, Manual 3 rows, Semanal 2×/week with total from balance; result dialog; Imprimir → print preview shows only the sheet.
  - patient with no bookable services → empty message; patient with a package from the other center → "Comprado en …" + form warning; over-balance blocked with reason.
  - attended patient sees Seguimiento only; never-attended sees Nueva only; visit-kind failure (stop BE briefly) → both.
  - medical booking from the booking screen, the agenda day view and the patient record → result dialog on each; booking that the BE turns into a move → "Cita movida"; editing an appointment still shows the "Cita actualizada" toast.
  - move medical (reason required) and service; cancel keeps move mode; success → result dialog.
  - «Nueva cita» with no patient → «+ Nuevo paciente» → save → back in the dialog with the slot kept and type «Nueva» → Guardar → result dialog. Without `pacientes.create` the button is hidden.
- [ ] `npm test && npm run typecheck && npm run lint && npm run build` → green.
- [ ] Push; open PR (Spanish description OK) with before/after screenshots, linking the spec and the cmr-be PR; note "merge after cmr-be PR is deployed".

### Task B11: boards open the Citas form

**Files:**
- Modify: `components/patient-desk/patient-desk.tsx` (~L38, ~L530) and `components/tablero/generic-board.tsx` (~L37, ~L356): replace `AgregarCitaModal` with `CitaModal` (`fecha = todayPR()`, `horaInicial` = next full hour in PR time via a lib helper with a test, initial status `confirmada`, `pacienteInicial` from `lockedPatient` (load with `getPaciente`), `centroId`, `canal="frontdesk"`, `tipos` from `getTiposCita`, `medicos` as the board loads them; `onSaved` → the board's existing refresh).
- Modify: `components/agenda/cita-modal.tsx`: optional `estadoInicial?: string` (preselects the status on create) and an optional `onPatientDataClosed?(p)` hook for the board's "filter on that patient" step — **must stay ≤ 600 lines** (extract first).
- Delete: `components/tablero/agregar-cita-modal.tsx`, and `lib/board/add-appointment-missing.ts` + test only if nothing else uses them (name removed tests in the commit). Remove i18n keys left unused (`agregarCita.*`) after grepping.

- [ ] Implement; gate `npm test && npm run typecheck && npm run lint`; commit `feat(boards): add appointments with the Citas form`.

## Follow-up (next PR, not this branch)

Citas gets an «Agenda del día» tab: the redesigned day sheet (today's `/scheduling/appointments/[date]`)
next to «Agendar» (owner, 2026-11-23). Draft design and open questions:
`docs/specs/2026-11-23-citas-day-sheet-tab-design.md`. Starts after this PR merges.
