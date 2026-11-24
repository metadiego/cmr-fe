# Citas: the day screen, and "Agendar cita" (step 2 of 3)

Status: design, 2026-11-23. Depends on `cmr-be/docs/specs/appointment-lifecycle.md` (step 1: one
appointment lifecycle for medical and therapy, visits, confirm for both, booked-by for both, and the
`GET /api/v2/appointments/day` endpoint).

## Why

The Citas menu item opens the booking screen (`/scheduling/appointments`, `BookingScreen`). Staff have no
screen focused on **what is already booked** for a day: to confirm appointments, fix or cancel them, see
their own bookings, and — for today — see who has arrived.

## What changes

1. The current Citas item and screen are renamed **"Agendar cita"** (EN "Book appointment"). Its route
   stays `/scheduling/appointments` so every inbound link (frontdesk, patient desk, calendar) keeps
   working.
2. A new **"Citas"** item opens a new screen at `/scheduling/booked` (my call; any free path works).
   Menu: BE `/me/menu` seed + `lib/nav-manifest.ts`; visible with `citas.read`.

## The screen

```
Citas                                                     [● live]
[◀] [ Mon 24 Nov 2026 ▾ ] [▶]  [Today]    Center [Bayamón ▾]
Type [All | New | Follow-up | Therapies]   Booked by [Me ▾]

Today:  12 arrived · 3 not arrived (late) · 9 upcoming

TIME   PATIENT          TYPE            BOOKED BY   STATUS                 ACTIONS
08:30  Ana Pérez        Follow-up       Carla       ● Arrived · in consult  …
09:00  Luis Rivera      IV therapy      Carla       ○ Late (not arrived)    [Confirmar ✓] …
10:30  María Santos     New patient     María       Confirmed · by Luis     …
11:00  José Díaz        Laser           Carla       Booked                  [Confirmar] …
```

- **Day only.** Date picker plus previous/next/today. The date lives in the URL (`?date=`), like
  `BookingScreen`.
- **Center**: same center selector as the booking screen (`CentroPantallaSelector`), respecting
  multi-center scope.
- **Type filter**: All / New (medical type whose key is `nueva`, `esTipoNueva`) / Follow-up (other
  medical types) / Therapies (any service).
- **Booked by**: staff picker. "Booked by" is who created the appointment (call-center agent or
  reception). Selecting a person shows the rows they created **or** whose patient they own (portfolio
  agent) — Diego, 2026-11-23. Defaults to **Me**; options: Me, All, any staff member. Remembered per
  device. The column shows the creator, and the portfolio agent beneath it when different.
- **Rows**: one per appointment of either kind, ordered by time (no-time rows last): time, patient (links
  to the patient), type label, booked by, status, actions. Cancelled / rescheduled rows hidden by default
  with a "show cancelled" toggle.
- **Status column**: booking stage (Booked / Confirmed · by whom, when), or once arrived the care stage
  (Waiting, Triage, In consultation, Called, In therapy, Done, Not served), or No-show / Cancelled.
- **Actions** (shown only when the row's `allowedActions` include them, and the user has the
  permission):
  - **Confirmar** — booked → confirmed, one click, no dialog; undo via the row menu ("Unconfirm").
  - **Change** — medical rows open the existing `EditAppointmentModal` (its reschedule action makes the
    new row). Therapy rows open a small date/time dialog (`FormDialog`) that calls
    `PATCH sessions/:id/agenda` (moves in place, see BE spec). A different type or service links to
    "Agendar cita" with the patient preselected.
  - **Cancel** ("delete") — asks for a reason, then cancels. The appointment stays in history.
- **Confirmed without a person**: rows that came from the call-center sheet arrive already confirmed
  (the bridge imports only confirmed rows) with no confirmer; show "Confirmed · call-center sheet". So
  Confirmar appears mostly on appointments booked in the app.
- **Permissions**: Confirmar needs the single confirm permission (both kinds); Change and Cancel need
  the kind's own write permission in the row's center. A user without it does not see the action.
- **Today mode** (date = today): the summary line above the table, and rows grouped or tinted into
  **Arrived** (has a visit), **Not arrived** (time passed, still booked/confirmed), **Upcoming** (time
  ahead). A therapy with no time (`time` is nullable on sessions) is never "late": it counts as upcoming
  until it arrives. "Now" is the center's time zone, not the browser's. Updates live through the existing appointment and session streams (`useCitaStream`,
  frontdesk stream) so arrivals appear without reload.

## Data

One call: `GET /api/v2/appointments/day?date&centerIds&kind&appointmentTypeIds&serviceIds&staffIds`
(see BE spec). Actions call `POST …/appointments/:id/confirm|unconfirm|cancel` and
`POST …/sessions/:id/confirm|unconfirm|cancel`, with the row's center as `X-Tenant-ID`.

## Out of scope

Week/month views; booking from this screen (that is "Agendar cita"); replacing the call-center day sheet
(`DiaView`, `/scheduling/appointments/[date]`), which stays as it is in this project.

## Building blocks (rule 10 of this repo's CLAUDE.md)

`PageContainer`/`PageHeader`, `DataTable` for the list, `StatGrid`/`Stat` for the today summary,
`StatusBadge` for every stage (new English stages get their tone once in `kit/status-badge.tsx`),
`EmptyState`/`ErrorState`/skeletons. **Confirmar** is the row's one primary action; Change and Cancel go
in the row's ⋮ menu, Cancel through `useConfirm()` + a reason (`FormDialog`). Filtering logic (type
buckets, today grouping) lives in `lib/` with tests. Must work at 375px and in dark mode.

## Left to the builder

Component structure; exact tints; i18n keys (English, both catalogues).
