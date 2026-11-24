# Patient Center: book therapies with the Citas form — design

Status: draft for approval (2026-11-24). Preview approved by the owner:
https://claude.ai/artifact/PgdBvikkQkdmEovbvWPV6e (version 2).

## Why

Patient Center › «Citar» › «Cita de servicio» opens «Programar citas» (`TherapyDayScheduler`): a
two-panel window with an hour grid, drag-and-drop, «Agendar y seguir» and two separate series windows.
Citas books a service with a plain form (`ServiceBookingForm`): patient, Frecuencia Manual | Semanal, one
row per date with its time and status, «+ Añadir fecha», Cancelar / Agendar, then the success dialog.
The owner wants **one way of booking**: Patient Center should look and behave like the Citas form. Unlike
Citas, though, it must book **several therapies for one visit** (the "train").

## Goals

1. Patient Center's «Cita de servicio» opens a new form with the structure, wording, components and
   principles of the Citas service form, plus a **Terapias** field where several are ticked.
2. It books today's visit (one row) or a series of visits (Manual rows or Semanal), each visit being the
   whole train at one entry time.
3. It ends in the same success dialog as Citas (`useBookingResult`, printable).

## Non-goals

- **No change to the Citas window** (`ServiceBookingForm`, the booking screen). The owner's instruction.
- No BE change: the endpoints below already exist.
- The other three users of `TherapyDayScheduler` (the `/scheduling/therapy-day` page, the frontdesk
  board, the service board viewer) **keep it for now**. The owner asked for the patient desk; moving them
  is a follow-up once this one is in use.

## Anti-goals

- A second look: no colored therapy dots, no emoji, no new visual patterns. Everything uses the pieces the
  Citas form uses (FormDialog, Field, divided bordered lists, ghost selects, dot + text status,
  SegmentedControl, the success pill). Owner, 24-nov: "remove the extra colors and emojis, make it match
  the style principles of Citas".
- Computing train times in the FE. The BE plans the train (order, legs, fits); the FE only shows it.

## Constraints (cmr-fe `CLAUDE.md`)

- Rule 8: `FormDialog` + kit `Field`; `missing` drives disabled, `reason` explains a block; `useSubmit`;
  a failed save never closes the dialog.
- Rule 9/10: reuse the Citas pieces themselves (`SeriesFrequency`, the date-row component, the
  success dialog), never a copy. Where `SeriesRows` is typed to one service, widen its row type rather
  than fork it, without changing what Citas renders.
- New files under 600 lines; logic in `lib/` with `node --test` tests; code, comments and i18n keys in
  English, copy in both `es.json` and `en.json`; dates through `useFormatter`.
- Done means seen: light and dark, desktop and 375px, loading/empty/error states.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (picked)** | The Citas form with a «Terapias» field added | Same shape everywhere; one new field. Drops the hour grid and «Agendar y seguir». |
| B | Two steps: a small therapies + hours picker, then the form | Closest to the Citas flow, but an extra click and window at the desk. |
| C | Restyle the current window | Cheapest, but still two ways of booking: no consolidation. |

The owner picked A after a clickable preview.

## Design

### The form (`components/patient-desk/therapy-booking-form.tsx`, new)

A `FormDialog` (size `xl`), top to bottom, as in the preview:

- **Title**: `<therapies in train order, joined by " + "> · <first row's day> · <entry time>`; with
  nothing ticked: «Programar terapias · <day>».
- **Paciente \***: the desk's patient, read-only (the desk always has one: «Citar» comes from a row).
- **Terapias \***: one bordered, divided list (the Citas list shape), one row per therapy the patient
  **has sessions left for** in this center: checkbox, name, minutes (laser: "N min por área"), the green
  «quedan N» pill. A ticked row shows, when it applies, the **areas stepper** (− n +, only for per-area
  services, the existing `areaServiceIds` rule) and, with 2+ ticked, its **turn** (1º, 2º…) from the BE's
  train order. Under the list: «Láser → EMTT · 25 min en la clínica» and, with 2+ ticked, the
  «Mantener mi orden» switch. The desk's `defaultServiceId` starts ticked when it is in the list.
- **Frecuencia**: the Citas `SeriesFrequency` (Manual | Semanal, days, Citas stepper), unchanged.
- **Rows**: the Citas date-row shape (number, ghost date button, ghost time select, status, remove).
  The time select lists the train's **entry hours** for that date as «9:00 – 9:25» (start – `endsAt`),
  with «lleno» / the reason on hours that do not fit. Status: libre / lleno · sobrecupo / cerrado /
  sin personal (the BE's `reasonKeys`, translated as today).
- **Footer**: «* Campos obligatorios», the missing/reason line, Cancelar, «Agendar» or «Agendar N visitas».

### Data

| Need | Source (existing) |
|---|---|
| Therapies + sessions left | `usePatientBookingRules` (bookable services, `GET /frontdesk/patients/:id/bookable-services`), the same strict rule as Citas |
| Service names, per-area services | `getServicios`, `listResources` (as `TherapyDayScheduler` does) |
| Entry hours of a date | `planPatientTrain({ date, serviceIds, areas, patientId, keepOrder })`, one call per row date, re-asked when therapies, areas or keep-order change |
| Book one visit | `bookTrain` (`POST /frontdesk/sessions/book-train`) |
| Book several visits | `bookTrainSeries` (`POST /frontdesk/sessions/book-train-series`) with explicit `days: [{ date, time, serviceIds }]` |
| Success dialog | `useBookingResult().show(...)`, with a new `trainBookingResult` builder in `lib/agenda/booking/booking-result.ts`: one item per leg (date, leg time, service name) |

Weekly dates are generated client-side with the Citas helpers (`generateWeeklyPattern`, `nextDate`,
`addItem`, `dropRow`, `replaceDate`); rows are edited the same way as in Citas.

### Rules

- **Cap**: the number of visits is capped by the ticked therapy with the **fewest sessions left** (and by
  the Citas 20 limit). Past the cap, «Agendar» is grey with «Solo le quedan N sesiones de <therapy> por
  agendar.» *(Claude's call, shown in the preview; the owner did not object.)*
- **Overbook**: an hour the BE marks `selectable` but not `fits` can be booked, with the Citas warning
  «Esta hora está llena: agendarla es un sobrecupo.» An hour that is not `selectable` is disabled.
- **Blocked rows** (Sunday, holiday, closed): must be fixed or removed before booking, as in Citas.
- **Errors**: `THERAPY_TRAIN_DOES_NOT_FIT` and `THERAPY_TRAIN_ROLLBACK_INCOMPLETE` keep today's messages
  and re-ask the hours. A train series is **all or nothing** in the BE (`book-train-series`, verified
  in cmr-be `train-booking.controller.ts`): a failing day books nothing, so the form stays open with
  every row and the toast names the day (`THERAPY_SERIES_DAY_DOES_NOT_FIT`).
- **Same day**: a row date where the patient already has a live (not cancelled) session of a ticked
  therapy is blocked up front («ya tiene este servicio ese día»); the BE would answer
  `FRONTDESK_SESSION_SAME_DAY`.
- **Permissions**: book needs `frontdesk.create`; without `frontdesk.read` the balance cannot be read and
  the form says so (Citas wording).

### What goes away in Patient Center

The hour grid with drag-and-drop, «Agendar y seguir» (book one group, then another, without closing),
«Agendar una serie» per card and «Programar una serie del tren». Their jobs are the rows and Semanal.
*(Owner approved the preview, which listed these as removed.)*

### Behavior change to flag

Today the Patient Center window can add **any** therapy («Agregar terapia»), with or without sessions
left. With the Citas rule, only therapies with sessions left are listed: a therapy not yet paid for must go
through billing first, as in Citas since 23-nov. *(Claude's call from "same principles as Citas".)*

### Wiring

`components/patient-desk/patient-desk.tsx`: the `schedule` dialog renders the new form instead of
`<Dialog><TherapyDayScheduler/></Dialog>`; `onBooked` refreshes the desk (`data.refresh()`) and closes.

### Testing

- `lib/` logic as pure functions with `node --test` (the repo's pattern): train rows → statuses, the cap,
  the result builder, the title.
- `npm run typecheck`, `npm run lint`, files under 600 lines.
- By hand in the app: one therapy, two therapies with keep-order, laser areas, Semanal, a full hour,
  a closed day, partial failure, the success dialog.

## Left to the builder

- Whether the row-date availability is a new hook (`useTrainSeriesAvailability`) or a mode of
  `useSeriesAvailability`; pick whichever keeps `ServiceBookingForm` untouched.
- Exact i18n keys (es + en), reusing `appointmentsBooking.series.*` and `therapyPlanner.*` where the text
  is the same.
