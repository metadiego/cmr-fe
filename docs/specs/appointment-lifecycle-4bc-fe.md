# Appointment lifecycle, piece 4: frontend hand-off for backend releases 4b and 4c

Continues `appointment-lifecycle-switch-fe.md` (release 4a), whose section 7 described 4b and 4c "as
planned". This document is **as built**: where it differs from that section, this one wins. Backend
branches: `feat/appointment-lifecycle-4b-visits` (4b) and `feat/appointment-lifecycle-4c-end-of-day`
(4c, built on 4b), in `cmr-be`. Backend build log: `cmr-be/docs/plans/appointment-lifecycle-4-switch-progress.md`.

Nothing here exists in production until each release merges. 4b and 4c are deployed in that order, 4c
on a day it is fine for "tomorrow" to be the first night of the new end of day.

## 1. Check-in through the visit (4b)

### `POST /api/v2/visits/check-in` (v1 `visitas/registrar-llegada`)

Replaces, for the new screens, `POST frontdesk/patients/:id/present` plus the extra consultation
`presente` call. The old door stays until the FE has moved (it goes in piece 6).

- **Permission:** the caller needs `appointments.update` or `frontdesk.update` in `centerId`, else
  **403 for the whole call**. Then each row needs **its own kind's** permission in that center
  (consultation: `appointments.update`; therapy: `frontdesk.update`); a row the caller may not move comes
  back in `failed` with code `FORBIDDEN`, the others still arrive.
- **Body:**

  | Field | Type | |
  |---|---|---|
  | `patientId` | uuid | required |
  | `centerId` | uuid | required: the visit's center (send the row's center, not only the active one) |
  | `date` | `YYYY-MM-DD` | optional, default today in the center's time zone. **Only the plain calendar day**: a timestamp (`2026-11-25T00:00:00Z`) or `20261125` is a 400 `VALIDATION_ERROR` ("date must be YYYY-MM-DD"). A day that has not come: 400 `VALIDATION_ERROR`, labelKey `presente.enElFuturo` |
  | `appointmentIds` | uuid[] (1-100) | optional. Without it: every **booked or confirmed** row of the patient that day at that center, both kinds. With it: only those rows; a **no-show or not-served row named here is a same-day recovery** (section 3) |

- **Response (HTTP 200 even when every row failed):**

  ```json
  {
    "visitId": "uuid | null",
    "arrived": [{ "id": "uuid", "kind": "medical | therapy" }],
    "skipped": [{ "id": "uuid", "kind": "medical | therapy" }],
    "failed": [{ "id": "uuid", "kind": "medical | therapy | null", "code": "…", "labelKey": "…?", "message": "…", "missingFields": ["…"] }]
  }
  ```

  - `skipped` = already arrived (a second receptionist, or a double click): **not an error**, show nothing.
    A not-served row is never `skipped`: named in `appointmentIds` it is a same-day recovery (section 3);
    without ids it is left alone and appears nowhere.
  - `failed[].missingFields` (was `faltantes` in the 4a hand-off's plan text) is present when a
    consultation's lock refused for missing patient data (code `PACIENTE_DATOS_REQUERIDOS`, labelKey
    `citas.datos_requeridos_para_presente`): open the same "complete the patient" flow the board uses
    today, then call check-in again with that id.
  - `kind: null` + code `ENTITY_NOT_FOUND` = an id in `appointmentIds` that is not a row of that patient,
    center and day.
  - Other codes are the executors' usual ones (`LIFECYCLE_ACTION_NOT_ALLOWED`, `FORBIDDEN`,
    `SHEET_SLOT_TAKEN`, …) with their labelKeys; show `labelKey` through the catalogue, `message` only as
    a fallback.
  - `visitId` is the patient's visit of that day after the call (null if nothing arrived and none existed).

### `POST /api/v2/visits/:id/undo` (v1 `visitas/:id/deshacer`)

- Same door permission (in the visit's center); a visit the caller has no right to, or a voided one,
  answers **404**.
- **Body:** `{ "appointmentIds"?: uuid[] }`, default every row of the visit.
- Undoes the arrival of rows still **waiting** (consultation) or **waiting / called** (therapy). A row
  further on (triage, in consultation, in therapy, done): **without `appointmentIds` it is in `skipped`**
  (the undo never targets it: not an error, show nothing); **named in `appointmentIds`** it is in `failed`
  with `LIFECYCLE_ACTION_NOT_ALLOWED`. The way back from there is the row's own correction action.
- **Confirmation:** a therapy row may ask `frontdesk.undo_present` (per center policy): the call
  answers **428 `ACTION_REQUIRES_CONFIRMATION`** before anything is written; repeat it with the header
  `X-Confirm-Action: frontdesk.undo_present` (one header covers every row). Use `useConfirm()`.
- **Response (HTTP 200):** `{ "visitId": "uuid | null", "undone": [{ "id", "kind" }], "skipped": [...],
  "failed": [...] }`. **`undone`** lists the rows taken back before arrival (the undo has no `arrived`
  key). `failed` holds only rows it tried and could not move (e.g. per-row `FORBIDDEN`), named rows that
  cannot go back, and ids not in the visit (`ENTITY_NOT_FOUND`). When the visit is left empty it is
  **voided** and `visitId` is `null`. Checking the patient in again opens a new visit.

### MCP

`check_in_patient` and `undo_visit` (with `confirm: true`) do the same; nothing for the FE.

## 2. Visits change under the rows (4b)

- A row that leaves arrival (undo, correction, board move back) is **unlinked** from its visit
  (`visitId` becomes null on the row) and a visit that no longer holds any row is voided. Do not keep a
  visit id from an earlier fetch across an undo: refetch.
- A row moved to another day / patient / center leaves its visit the same way.

## 3. Same-day recoveries (4b)

`check_in` is now also open, **on the row's own day only** (center time zone):

| Kind | From | Result |
|---|---|---|
| Consultation | `no_show` (a patient who came after all) | arrived / waiting; the call-center sheet seat is taken again (409 `SHEET_SLOT_TAKEN` if someone took it) |
| Consultation | arrived / not served (cancelled after arriving) | arrived / waiting, **first arrival time kept**, seat retaken |
| Therapy | arrived / not served | arrived / waiting (call and technician cleared), first arrival kept; runs as the same-day reopen: refused if the package is closed (`FRONTDESK_REOPEN_PACKAGE_CLOSED`) or another live row of that service exists that day (`FRONTDESK_SESSION_SAME_DAY`) |

`allowedActions` lists `check_in` on those rows today only; another day it is not listed, and the
click answers 400 `LIFECYCLE_ACTION_NOT_ALLOWED`. No new label: it is `lifecycle.action.check_in`.

## 4. The Citas day screen menu item (4b)

The backend menu (`GET /me/menu`) gains:

| key | `appointments-day` (the key cmr-fe #155 maps) |
|---|---|
| path | `/scheduling/booked` |
| labelKey | `nav.appointmentsDay` (**new**: add to `messages/es.json` "Citas" and `messages/en.json` "Appointments"; the existing `nav.citas` item becomes "Agendar cita" / "Book appointment" per `citas-day-screen.md`) |
| icon | `list-checks` |
| group / order | `g-agenda`, right after the booking screen |
| permission | `appointments.read` |

Also add `/scheduling/booked` to `lib/nav-manifest.ts`. The item reaches production when the backend's
menu seed runs (operational step on the backend side). A role with a menu whitelist sees it only once
it is added to that role from the roles screen.

## 5. The new end of day (4c)

No screen has to change for it, but staff will see different rows the next morning, and the Citas day
screen should read them right.

- **From the switch date on** (stored as data, `endOfDay.lifecycleFrom` in the system preferences: the
  day after 4c deploys), at each center's cutoff (`endOfDay.cutoff`, its own time zone), as the system:

  | Row at the cutoff | Becomes |
  |---|---|
  | Consultation booked or confirmed (never arrived) | `no_show` |
  | Waiting, triage (consultation) or waiting, called (therapy) | not served (`arrived / not_served`, old status `cancelada`), arrival time kept |
  | **Therapy still pending** | **stays pending** (no therapy no-show in this piece) |
  | In consultation, in therapy, done | untouched |

  Then the day's open visits close. History rows say actor `system`, reason `end_of_day`. **The
  call-center sheet is not touched:** a no-show or not-served row keeps its sheet seat (only a person's
  no-show / not-served frees it, as today).
- **Each day closes once.** A patient checked in after the cutoff (from `no_show` or not served: the
  recoveries of section 3) stays checked in; their visit stays `closed`, which the screen can ignore. A
  patient with no visit that day gets a new one; it stays open the rest of that day and the first run
  of the next day closes it (a visit of today is never closed by a sweep).
- At deploy, a one-off cleanup closes every open visit of a past day before the switch date (never
  one of today) and voids empty ones.
- A day the server missed is closed later (up to a week back): rows of past days can change state the
  next morning.
- A center with `endOfDay.releasePresent: false` keeps its waiting patients as they are.
- The old behaviour ("presente goes back to agendada / pendiente" and the opt-in "confirmed goes back to
  agendada") stops for days from the switch date; the opt-in one is gone altogether.
- The preferences screen: saving the **system** layer keeps `endOfDay.lifecycleFrom` **on the backend**:
  a save that does not name it (the theme Reset sends `{}`) leaves the stored date; only an explicit
  `endOfDay.lifecycleFrom: null` removes it. Never send that null from a screen.

## 6. What changed against section 7 of the 4a hand-off

- `failed[].faltantes` is `missingFields`.
- No caller rights in the center = 403 for the whole call, not per row; a kind the caller may not move
  = per-row `FORBIDDEN`.
- Undo: 404 for a visit the caller cannot see; ids not in the visit come back `ENTITY_NOT_FOUND`;
  confirmation by 428 + `X-Confirm-Action: frontdesk.undo_present`.
- Undo answers `undone` (not `arrived`); rows it never targets are `skipped`, not `failed`.
- Check-in `date` only as `YYYY-MM-DD`.
- Menu key `appointments-day`, label `nav.appointmentsDay` (the backend branch first named it `booked-appointments`; never seeded).
- End of day: each day once, catch-up of missed days, `releasePresent` honoured, sheet seats kept.

## 7. Files to change (live screens only)

- **Citas day screen (new, `/scheduling/booked`)**: register the route in `lib/nav-manifest.ts`; the
  labels `nav.appointmentsDay` in both catalogues; "Llegó" calls `POST visits/check-in` with the
  row's patient and center and `appointmentIds: [id]` (or without ids for "the whole day").
- `components/patient-desk/*` and `hooks/use-patient-day.ts`: patient present → `POST visits/check-in`
  (replaces `frontdesk/patients/:id/present` plus the consultation `presente`), undo present →
  `POST visits/:id/undo` (read `undone`); show `failed` rows with their labelKey, `missingFields` opening
  the patient data form; no toast for `skipped`.
- `lib/api/visits.ts` (new) with the two calls and the response type; `lib/api/schema.d.ts` regenerated
  (`npm run gen:api`) against a backend running the 4b branch.
- The decision of which row in `failed` to show first and how goes to `lib/` with a test (guardrail 5).
- Not to touch: `/boards/frontdesk` and `components/frontdesk/` (deprecated).
