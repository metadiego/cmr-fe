# Appointments booking upgrades — design

Date: 2026-11-23 · Screen: `/scheduling/appointments` booking screen (`components/appointments-booking/*`)
Owner decisions taken in conversation on 2026-11-23. One cmr-fe PR for all four parts, plus one small
cmr-be PR (the "attended before" read) that merges first.

## Why

Reception books series of service sessions and medical visits from this screen. Today:

- a booking ends in a toast; the patient leaves with nothing in hand and reception cannot re-read what was
  just created;
- the series form only knows "once / every week / every 2 weeks", which does not match how packages are
  sold (e.g. 2–3 sessions a week on fixed weekdays);
- moving an appointment shows a box at the bottom of the hour grid that is easy to miss and scrolls away;
- the type list lets anyone book anything: a «Nueva» for a patient who was already seen (the BE silently
  turns it into «Seguimiento», so the screen showed something other than what got saved), and any service,
  paid or not.

Success: reception books a package in one pass with dates filled from what was bought, hands the patient a
printed list, and cannot book what the patient has not paid for.

## Goals

1. **Success modal** after every booking (medical, service single, service series) and after every move:
   the list of what was created, what was skipped and why, an **Imprimir** button, **Cerrar**.
2. **Service series form**: Frecuencia = **Manual** (default) | **Semanal**.
3. **Move as a dialog** instead of the box under the grid.
4. **Booking rules** on the type list when a patient is chosen: medical «Nueva» vs «Seguimiento» follow
   "attended before"; services list only those with sessions left.

## Non-goals

- No change to medical booking's own form (`CitaModal`): no recurrence for medical appointments.
- No BE enforcement of "only paid services": the call-center bridge, the legacy import (clinic Mac) and
  other paths create sessions without packages. This is a screen rule.
- No "every 2 weeks", "monthly" or "every N days" frequencies (owner: Manual or Semanal only).
- No changes to the deprecated `/boards/frontdesk` screen.

## Anti-goals

- The printout must not show prices or clinical data (it goes home with the patient).
- Reception must never be left with a grey button and no reason (forms-kit rule 8).
- The type list must never be empty without saying why and what to do (go to billing).

## Constraints

- cmr-fe `CLAUDE.md`: kit dialogs (`FormDialog`, `Field`, `missing`/`reason`), English code + i18n keys in
  both `messages/es.json` and `messages/en.json`, dates via `useFormatter` + `parseDayUTC`, new logic in
  `lib/` with `node --test` tests, files under 600 lines (`service-booking-form.tsx` is 439 today; the new
  frequency UI goes in its own component).
- cmr-be: new endpoint = API-first + Swagger + MCP tool + permission + TDD (cmr-be `CLAUDE.md`).
- Sundays are closed; holidays come from `getBookingHolidays`.

## Approaches considered

| Decision | Options | Picked | Why |
| --- | --- | --- | --- |
| "Attended before" signal | (a) BE read endpoint reusing `CitasService.yaFueAtendido`; (b) FE derives it from the patient's appointment history | **(a)** | One definition of "attended". (b) would duplicate the owner's 2026-11-07 rule and drift. |
| Printing | (a) print-only section inside the success dialog + `window.print()`, like `components/frontdesk/formato-generico.tsx` (`.formato-print` rules in `app/globals.css`); (b) a dedicated `/print/appointments` page like the invoice receipt; (c) a PDF library (jspdf) | **(a)** | The data is already in memory in the modal; (b) needs to pass it to another tab or refetch by ids; (c) adds a dependency and a second print path. "PDF" = the browser dialog's *Save as PDF*. |
| Series generation | (a) extend `generateItems` with a weekly-pattern generator in `lib/agenda/booking/series-edit.ts`; (b) a new form | **(a)** | The row machinery (per-row availability, suggestions, edits, drop, add date, bulk booking by time) stays as is; only how rows are generated changes. |

## Design

### 1. Success modal (`BookingResultDialog`, new component)

Shown by the booking screen instead of the success toast (error toasts stay). Input:

```ts
interface BookingResult {
  title: "booked" | "moved";
  patient: { name: string; record?: string | null };
  center: { name: string; phone?: string | null; address?: string | null };
  items: { date: string; time: string; typeName: string; kind: "medical" | "service"; doctor?: string | null }[];
  skipped: { date: string; reason: string }[]; // already-translated reasons
  warnings: string[];                          // already-translated BE warnings
}
```

- Callers: `ServiceBookingForm` (single + series; built from `creadas` / `omitidas` / `advertencias`),
  the medical `CitaModal` create path in `booking-calendar.tsx` (`onSaved(cita)`), and the move confirm in
  `booking-screen.tsx` (one item: the new date/time; plus the old one shown as "from").
- **Medical, every screen (owner, 2026-11-23: no switch, the success modal is the only behaviour):**
  on **create**, `CitaModal` no longer shows its success toast, warnings toast or "rescheduled" notice;
  it hands the result to the app-wide result dialog instead. This applies wherever `CitaModal` creates
  (booking screen, agenda day view, patient record actions). **Edits** keep the "Cita actualizada" toast
  (an edit is not a booking — Claude's call). `CitaModal` is 599 lines: extract a piece (its
  toasts/notice helpers) so it stays under its limit.
- **App-wide dialog (Claude's call):** a `BookingResultProvider` mounted once in `components/app-shell.tsx`
  renders `BookingResultDialog`; callers use `useBookingResult().show(result)`. So the dialog outlives the
  form that produced it (callers unmount `CitaModal` on save) and no screen wires it by hand.
- When the BE moved an existing live appointment instead of creating one (`rescheduledFromId` set: one
  live medical appointment per patient), the modal and the printout say "Cita movida" with old → new date.
- Rows sorted by date then time; `tabular-nums`; dates via `useFormatter` + `parseDayUTC`.
- **Imprimir**: `window.print()`. The dialog contains a `.appointments-print` block (hidden on screen,
  shown in print) with: center name, address, phone; patient name + record; a table Date · Time · Service
  (and doctor for medical); a short footer line ("Si no puede asistir, llame al {phone}"). No prices.
  Print CSS: a new `@media print` block in `app/globals.css` modelled on `.formato-print` (neutralise the
  Radix dialog transform/overflow so it prints from the page origin). Language = app language.
- **Cerrar** closes; the booking form behind it is already closed (or cleared) when the modal opens.
- Partial failure in a series: the form stays open with the rows left (as today) and the result modal is
  NOT shown until the user closes or finishes; then it shows what was created. (Builder may instead show it
  immediately on top — see "Left to the builder".)
- Center name/phone/address source: the centers list the screen already loads (`patientCenters` /
  `getMyCentros`); a missing field is omitted, never invented.

### 2. Service series form: Manual | Semanal

Replaces the `once / weekly / biweekly` segmented control in `service-booking-form.tsx`.

```
Frecuencia   [ Manual | Semanal ]
— Semanal only —
Veces/semana [ − 2 + ]     Días  (Lu)(Ma)[Mi](Ju)[Vi](Sá)
Citas        [ − 10 + ]    ← 10 left on the package
────────────────────────────────────────────
rows (date · time · status · suggestion · ✕)   as today
[+ Añadir fecha]
```

- **Manual (default)**: one row = the picked date and time. "+ Añadir fecha" adds a row (next free date
  after the last, as `nextDate` does, every 1 week); each row keeps its date/time picker, status, suggestion,
  drop. One row books exactly like today's "Una vez" (`crearSesion`); 2+ rows book like today's series
  (`agendarVariosServicios`, one request per distinct time).
- **Semanal**:
  - *Veces por semana* `1..6`; default 1 (or the count of days already chosen).
  - *Días*: Mon–Sat chips; the picked date's weekday is pre-selected and cannot be unselected (it is the
    first session). Selecting more chips than "veces" bumps "veces"; lowering "veces" below the selected
    count deselects the last-added day. Book is blocked with a reason until selected days = veces.
  - *Citas* (total): defaults to the service's **bookable** sessions (part 4, from the new BE read).
    Stepper bounded by 1 and `min(bookable, MAX_SESSIONS = 20)`; if more than 20 are bookable, default 20
    and say "Hasta 20 por vez".
  - Generation (`generateWeeklyPattern(start, weekdays, count)` in `lib/agenda/booking/series-edit.ts`,
    tested): walk days from the picked date, take each day whose weekday is selected, skip Sundays, stop at
    `count`. Holidays are not skipped by the generator: they show as blocked rows with the planner's
    suggestion, as today.
  - Changing veces/días/total regenerates the rows and drops manual edits (existing "resetsEdits" note).
- Switching Manual ↔ Semanal regenerates rows from the picked date.
- i18n: new keys under `appointmentsBooking.series` (`manual`, `weeklyPattern`, `timesPerWeek`, `days`,
  `weekdayShort.*`, `total`, `pickDaysReason`, `maxPerBooking`); `once`/`weekly`/`biweekly` removed from
  both catalogues.

### 3. Move as a dialog

- `MoveBox` (in `day-panel.tsx`) becomes `MoveAppointmentDialog` (new file, `FormDialog` size `md`):
  title "Mover cita", line `{from} → {to}` (type name above), overbook warning when the target hour is
  full, "Motivo del cambio" required for medical (as today), buttons **Mover** / **Cancelar**.
- Opens when an hour is picked while moving. Closing it (Cancelar/Esc/×) keeps move mode on so another
  hour can be picked; the patient-rail "Mover" toggle and Esc on the grid still end move mode (as today).
- On success: move mode ends, the result modal (part 1) opens with the one moved appointment.
- `useDialogForm` resets the reason per target hour, as today.

### 4. Booking rules on the type list

With a patient chosen:

- **Medical**: a new BE read tells whether the patient was attended before.
  - attended → hide `nueva`; not attended → hide `seguimiento`. Other medical types are untouched.
  - While loading or on failure: show both (the BE still corrects on save) — never block booking on it.
  - Slugs `nueva` / `seguimiento` are the BE's (`un-paciente-conocido-es-seguimiento.ts`); the FE matches by
    `slug` in one helper in `lib/agenda/booking/type-list.ts`, tested.
- **Services**: only services with **bookable > 0**, where (owner, 2026-11-23):
  `bookable = bought − attended − already booked (upcoming, not cancelled, not yet attended)`.
  Today's `pending` (`GET /frontdesk/patients/:id/availability`) is bought − attended only, so a patient
  with 10 bought and 6 booked shows 10; the new BE read (4b) returns `bookable`.
  - **Strict (owner, 2026-11-23, option A)**: a service not linked to billing (no `grupoFacturacionId`,
    no `productoId`) always has 0 and is never listed for a patient. A missing service means its settings
    must be linked to billing; that is the fix, not a bypass.
  - **Packages from any center count** (owner). When the bookable sessions come from a package bought in
    another center than the booking center, the row and the booking form show a warning: "Este paquete se
    compró en {center}; estás agendando en {bookingCenter}."
  - The current "packages" and "services" groups collapse to one group "Servicios de {name}" with the
    bookable count per row. Empty → "No tiene servicios con sesiones disponibles. Pásalo por facturación
    para añadirlo." Loading: skeleton rows; failure: error + retry (never fall back to all services).
  - **Cap**: the booking form cannot book more rows than `bookable` (Semanal total defaults to and is
    capped at `min(bookable, 20)`; Manual's "+ Añadir fecha" stops at `bookable`). Booking over the
    balance is blocked with a reason (owner, 2026-11-23).
- Without a patient: the list is unchanged (all medical types, all services). **Claude's call:** the
  booking form then applies the same rule when the patient is picked inside it (`PacienteSelect`): with no
  bookable sessions for that service it shows the billing message as a `reason` and will not book; the cap
  above applies.
- The URL can still carry a service `typeId` the patient has no balance for (deep link, patient changed):
  the screen clears the type and shows the list.

### 4b. cmr-be: two reads (separate PR, merged and deployed first)

1. **Attended before**: `GET /api/v2/appointments/patients/:patientId/visit-kind` (v1 Spanish twin per
   the router) → `{ attendedBefore: boolean, nextVisitType: "nueva" | "seguimiento" }`. Reuses
   `CitasService.yaFueAtendido` (one source; no second query). Permission: `citas.read`.
2. **Bookable services**: `GET /api/v2/frontdesk/patients/:patientId/bookable-services?centerId=<booking
   center>` → per service of the booking center's catalogue with bookable > 0:
   `{ serviceId, bought, attended, booked, bookable, sources: [{ centerId, centerName, bookable }] }`.
   - Packages are read across **all** centers the caller may read (per-center permission rule: accept the
     centers array), matched to the booking center's service by its billing group / product
     (`lo-que-le-queda-al-paciente.ts`). The builder must verify a group/product is shared across centers'
     catalogues; if not, stop and come back.
   - `booked` = the patient's upcoming sessions of that service (same group/product), not cancelled and not
     attended, in any center.
   - Reuses the existing pending computation (`pendientesEntrega*`); no second definition of "pending".
   - Permission: `frontdesk.read`. The existing `/availability` endpoint stays as is (other callers).
- Both: Swagger, MCP tools (`patient_visit_kind`, `patient_bookable_services`), unit tests, no schema change.

## Left to the builder

- Exact endpoint path naming within cmr-be routing conventions (`ruta-en-ingles`), keeping the response shape.
- Whether a partially failed series shows the result modal immediately or after the form is resolved.
- Visual details of the print sheet within the kit tokens (Letter size, black on white).
- Splitting `service-booking-form.tsx` (frequency controls into `series-frequency.tsx`) to stay under 600.

## Testing

- `lib/` tests: `generateWeeklyPattern` (weekday sets, Sundays, start mid-week, count), weekday-chip
  rules (veces ↔ días), medical type filter by attended flag, service filter by balance, result-items
  builder (sort, skipped/warnings mapping).
- BE: service + controller specs for the endpoint.
- Browser QA (localhost:8080): each booking path → result modal → print preview; move → dialog → result;
  type list with an attended patient, a never-attended patient, a patient with no balance; light/dark,
  desktop/375px.
