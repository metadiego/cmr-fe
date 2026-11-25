# Appointment lifecycle, piece 4 ("Switch"): frontend hand-off for backend release 4a

**From:** `cmr-be` branch `feat/appointment-lifecycle-4-switch` (release 4a = Tasks 1-5 of
`cmr-be/docs/plans/appointment-lifecycle-4-switch.md`; not merged yet, base `main` + piece 3).
**For:** the frontend of piece 4. Follows `appointment-actions-board.md` (piece 3: action catalogue,
`lifecycle.action.<key>` labels, error codes). The Citas day screen is specified in
`citas-day-screen.md` (`cmr-fe-citas-day-screen` worktree); this document gives it the exact API.
Everything below was read from the code of 4a, not from the plan. Where they differ, the code wins and
the line says so.

## 1. What 4a ships

Backend only, no schema change, no behaviour change for existing screens:

| # | Piece | Section |
|---|---|---|
| 1 | `allowedActions` on every row of four board reads | 2 |
| 2 | Confirm / unconfirm doors for therapy sessions, unconfirm door for appointments | 3 |
| 3 | `confirmed: boolean` on every creation path | 4 |
| 4 | `GET appointments/day`: one list of both kinds | 5 |

**Nothing breaks on current screens.** Every new field is additive, every old route, slug and body key
still works, `estado: 'confirmada'` is still accepted. The boards keep working unchanged until the FE
chooses to switch. The FE can adopt each piece independently.

## 2. `allowedActions` on board rows

Present on every row (`filas[]`) of:

| Read | Row id | Kind |
|---|---|---|
| `GET board/rows?tablero=appointments&fecha=` (and `GET board/rows` for the sessions board, `tablero=frontdesk_sessions&subTipo=<service>`) | row `id` | medical / therapy |
| `GET appointments/board` | appointment id | medical |
| `GET frontdesk/board` | session id | therapy |
| `GET appointments/day` (section 5) | row `id` | both |

Other boards (any other `tablero` key) get no `allowedActions`. A row with no stored stage gets `[]`.

| Fact | Detail |
|---|---|
| Type | `allowedActions: string[]`, catalogue action keys in catalogue order. Labels: `lifecycle.action.<key>` (already in `messages/{es,en}.json`). |
| Computed | Per row, in the **row's own center**, for the **calling user**: the action is open from the row's stored stage (`booking_status` / `care_status`) AND the user holds the action's permission in that center. A cross-center board therefore shows `confirm` only on the rows of the center where the user holds `appointments.confirm`. |
| Lag | Computed from the stored stages, which the reconciler can lag by up to about 1 minute. It is a convenience, not the gate: the backend re-checks on the click and answers `LIFECYCLE_ACTION_NOT_ALLOWED` (400) or `LIFECYCLE_STALE` (409). Handle both as in `appointment-actions-board.md` (toast, refetch the row). |
| Never listed | `repair` and `remove_entry_error` (admin and delete paths keep their own doors). |
| Dates are not applied | The list ignores the date rules of `check_in` (not future) and `no_show` (today or past). `no_show` is listed on a future row and the backend then refuses it (`VALIDATION_ERROR`, labelKey `lifecycle.action.futureDate`). **The screen must still hide No-show for a future date, and Check-in for a future date.** |
| API keys | A non-admin API key gets `[]` on every row (it has no working centers; same answer as the click check). Admin keys get everything except the two above. Screens are people, so this only matters for tooling. |
| Realtime | SSE payloads do **not** carry `allowedActions` (they are broadcast per center). Refetch the row on an event. |

Entity responses (`GET appointments`, `GET frontdesk/sessions`, ...) also expose the stored
`bookingStatus`, `careStatus`, `visitId`, `confirmedByStaffId`, `createdByStaffId` (v1 and v2).

### Which FE code it replaces

| Today | After |
|---|---|
| `components/tablero/tablero-acciones.tsx`: filters `definicion.transiciones` by `fromStatuses` and `permissionSlug` (`can(...)`) | Draw buttons from `row.allowedActions`; keep the form fields / confirmations / reasons the transition declares, keyed by action key. |
| `lib/lifecycle/board-action-rules.ts` (`cancelMeaning`, `noShowAllowed`; exists on branch `feat/lifecycle-actions-screens` of `cmr-fe`, not on `main`) | Delete. `cancel` vs `not_serve` is already two different keys in `allowedActions`. Keep only the future-date check on `no_show` / `check_in`. |
| `can("appointments.confirm")` gates on confirm / unconfirm buttons | Not needed for drawing; the list already holds the per-center permission. Keep `can()` only for non-row UI. |

### Action key to door (what each button calls today)

Medical rows (`appointments`), v2 English paths; body `reason` is the cancel / not-serve reason:

| Action key | Door today | Notes |
|---|---|---|
| `confirm` | `POST appointments/:id/confirm` | answers `{ data, persistencia }` |
| `unconfirm` | `POST appointments/:id/unconfirm` (new, section 3) | bare entity |
| `check_in` | `POST appointments/:id/present` | |
| `start_triage` | `POST appointments/:id/triage` | needs `nurseId` |
| `start_consultation` | `POST appointments/:id/consultation` | needs `doctorId` |
| `finish` | `POST appointments/:id/attend` | needs `doctorId` |
| `no_show` | `POST appointments/:id/no-show` | |
| `cancel`, `not_serve` | `POST appointments/:id/cancel` | the backend picks `cancel` or `not_serve` by the row's stage; reason required |
| `reschedule` | `POST appointments/:id/reschedule` | |
| `undo_check_in`, `undo_check_in_clear_vitals`, `undo_check_in_keep_vitals`, `back_to_consultation`, `back_to_triage`, `back_to_waiting` | `POST board/action` only | no REST door; send `action: <action key>` (the board door accepts keys and the old slugs) |

Therapy rows (`frontdesk_sessions`):

| Action key | Door today | Notes |
|---|---|---|
| `confirm` | `POST frontdesk/sessions/:id/confirm` (new) | bare entity |
| `unconfirm` | `POST frontdesk/sessions/:id/unconfirm` (new) | bare entity |
| `check_in` | `POST frontdesk/sessions/:id/present` | |
| `call` / `uncall` | `POST frontdesk/sessions/:id/call` / `.../uncall` | `call` again reassigns the technician |
| `start_therapy` | `POST frontdesk/sessions/:id/therapy-at` | |
| `finish` | `POST frontdesk/sessions/:id/attended` | |
| `cancel`, `not_serve` | `POST frontdesk/sessions/:id/cancel` | reason required |
| `move` | `PATCH frontdesk/sessions/:id/agenda` | moves in place |
| `undo_check_in`, `unattend`, `undo_attendance`, `back_to_waiting`, `reopen`, `reactivate` | `POST board/action` only | send the action key |

`POST board/action` body: the existing `{ board, entityId, action, payload }` of
`lib/api/tablero.ts` (`ejecutarAccion`). Permission is now checked in the row's center (403 `FORBIDDEN`).

## 3. Confirm and unconfirm doors

| Door | Method and path (v2) | Permission | Response |
|---|---|---|---|
| Confirm a medical appointment (existing) | `POST appointments/:id/confirm` | `appointments.confirm` | `{ data, persistencia }` |
| **Unconfirm a medical appointment (new)** | `POST appointments/:id/unconfirm` | `appointments.confirm` | bare entity (the appointment) |
| **Confirm a therapy session (new)** | `POST frontdesk/sessions/:id/confirm` | `appointments.confirm` | bare entity (the session) |
| **Unconfirm a therapy session (new)** | `POST frontdesk/sessions/:id/unconfirm` | `appointments.confirm` | bare entity (the session) |

Spanish v1 twins: `citas/:id/desconfirmar`, `frontdesk/sesiones/:id/confirmar|desconfirmar`.
No body.

- **One permission for both kinds:** `appointments.confirm` (not `frontdesk.update`).
- **Center:** the row's own. The backend finds the record inside the caller's read scope (404 outside),
  and resolves the permission in the record's center (403 `FORBIDDEN` when the user lacks it there).
  `X-Tenant-ID` is not needed to pick the center; `lib/api/citas.ts` already sends the row's center and
  that stays harmless.
- **Response shape differs:** the new doors return the bare entity, the older
  `appointments/:id/confirm` returns `{ data, persistencia }` (the usual `{ data, meta }` envelope wraps
  both). `confirmarCita` in `lib/api/citas.ts` keeps its type; type the new calls separately.
- **Stages:** `confirm` only from booked; `unconfirm` only from confirmed. Unconfirm clears the
  confirmation stamp. Once the patient has arrived, both answer `LIFECYCLE_ACTION_NOT_ALLOWED` (400).
- **Errors:** `LIFECYCLE_ACTION_NOT_ALLOWED` 400, `LIFECYCLE_STALE` 409, `FORBIDDEN` 403, 404 outside the
  user's scope. Same toasts as `appointment-actions-board.md`.
- Therapy confirm used to have no door: the confirm button on the Patient desk therapy rows can now call
  it.

## 4. Creating with `confirmed`

`confirmed?: boolean` (optional, default not confirmed) on every creation body:

| Door (v2) | Behaviour |
|---|---|
| `POST appointments` | `confirmed: true` is born `confirmada`. `estado` / `status: 'confirmada'` still accepted. |
| `POST frontdesk/sessions` | `confirmed: true` is born pending with the confirmation stamp (booked and confirmed). |
| `POST frontdesk/sessions/book-multiple` | applies to every session created. |
| `POST frontdesk/sessions/book-train` (`BookTrainDto`; `book-train-series` takes no `confirmed`) | applies to every leg. |

Rules:

- Medical: `confirmed` and the old status are read as one statement. `confirmed: true` with a status
  other than `confirmada`, or `confirmed: false` with `confirmada`, is **400 `VALIDATION_ERROR`**.
  Sending only one of them is fine.
- A row born **present** (walk-in: "bring to today" on a same-day booking, or a center with auto-present
  for same-day booking) is **never confirmed**: for a session `confirmed` is ignored when it is born
  present. Do not show "Confirmed" for a walk-in.
- The scheduling bridge and the call-center repair job use the same path; their rows carry
  `confirmedVia: 'bridge'` (section 5).

**FE change:** the add-appointment modals send `confirmed` instead of a status:
`components/tablero/nueva-cita-modal.tsx` (today `status: "confirmada"`), `components/agenda/cita-modal.tsx`
(`estadoCrear`, `estadoInicial`), and the therapy booking form / book-multiple / train calls
(`components/patient-desk/therapy-booking-form.tsx`, `lib/api/book-multiple.ts`). The confirm toggle in
the modal maps to the boolean. Legacy status editing in the edit modal is unchanged.

## 5. `GET appointments/day`

`GET /api/v2/appointments/day` (Spanish v1: `GET /api/v1/citas/dia`). Permission: either
`appointments.read` or `frontdesk.read`. MCP twin tool: `list_day_appointments`.

### Query

| Param | Type | Default | Meaning |
|---|---|---|---|
| `date` | `YYYY-MM-DD` | required | The day. |
| `centerIds` | comma-separated uuids | every center where the kind is readable | Narrow to these centers. |
| `kind` | `medical` or `service` | both | One kind only. `service` = therapy sessions. |
| `appointmentTypeIds` | comma-separated uuids | none | Keep only these medical types. |
| `serviceIds` | comma-separated uuids | none | Keep only these services (sessions). |
| `staffIds` | comma-separated uuids | none | "Booked by": rows **created by** any of them **or** whose **portfolio owner** (`booked_by_staff_id`) is any of them. Staff ids, not profile ids. |
| `includeCancelled` | boolean | `false` | `true` also returns `cancelled` and `rescheduled` rows. No-show and not-served rows are always returned. |

**Types and services are one picker.** Sending `appointmentTypeIds` or `serviceIds` drops every kind that
has no list of its own: type ids alone return medical rows only, service ids alone return sessions only,
both return both.

Mapping the screen's buckets:

| Bucket | Params |
|---|---|
| All | none (add `kind` only if the screen needs it) |
| New | `kind=medical`, keep rows with `isNewPatientType` (or `appointmentTypeIds=<ids of the type with slug nueva>`) |
| Follow-up | `kind=medical`, keep rows with `isNewPatientType === false` (or the other medical type ids) |
| Therapies | `kind=service` (plus `serviceIds=...` if a service is picked) |

"Me" in Booked by is the user's own staff id in `staffIds`; "All" sends no `staffIds`.

### Response: `data` is an array of rows

| Field | Type | Meaning |
|---|---|---|
| `id` | uuid | Appointment id (`kind: medical`) or session id (`kind: service`). Use it with the doors of section 2. |
| `kind` | `"medical"` or `"service"` | |
| `patient` | `{ id: uuid, name: string or null }` | |
| `time` | `"HH:mm"` or `null` | Always zero padded. `null` = no time (sessions can lack one). |
| `typeLabel` | string or `null` | Appointment type name (medical); `null` for a session. |
| `isNewPatientType` | boolean | The type's slug is `nueva`. Written in code, not configurable (a renamed slug hides the badge). |
| `serviceName` | string or `null` | Service name (session); `null` for medical. |
| `bookingStatus` | `booked`, `confirmed`, `arrived`, `cancelled`, `no_show`, `rescheduled` or `null` | |
| `careStatus` | medical: `waiting`, `triage`, `in_consultation`, `done`, `not_served`; therapy: `waiting`, `called`, `in_therapy`, `done`, `not_served`; or `null` | Set once arrived. A patient who left without being served is `arrived` + `not_served`. |
| `createdBy` | `{ id, name: string or null } or null` | Who created the row. `name` is `null` when the id is not a staff row (old rows holding a profile id). |
| `confirmedAt` | ISO timestamp or `null` | |
| `confirmedBy` | `{ id, name } or null` | The person who confirmed. |
| `confirmedVia` | `"person"`, `"bridge"`, `"import"` or `null` | See below. |
| `visit` | `{ id: uuid, arrivedAt: ISO timestamp or null } or null` | The visit the row arrived through. |
| `centerId` | uuid | The row's center. Send it as `X-Tenant-ID` for the row's actions, as today. |
| `portfolioOwner` | `{ id, name } or null` | The patient's portfolio owner stamped on the row (`booked_by_staff_id`). Show under Booked by when different from `createdBy`. |
| `allowedActions` | action keys | Section 2. |

`confirmedVia` (only for a row that was confirmed: `bookingStatus = confirmed` or a confirmation stamp
exists; else `null`):

| Value | Meaning |
|---|---|
| `person` | A staff member is stamped as the confirmer (`confirmedBy` is set). |
| `bridge` | **Created by the scheduling bridge** (call-center sheet), with no staff confirmer. It means "the row came from the sheet", not proof of who confirmed: a bridge row later confirmed by an API key or the system also reads `bridge`. Show "Confirmed · call-center sheet". |
| `import` | Came from the legacy import (legacy origin or an import history row). |
| `null` | Confirmed by an API key or the system, which cannot be told apart. |

**Order:** by `time` ascending (rows with no time last), then patient name (Spanish collation, accents
and case ignored), then id. Both kinds are merged into one list. No pagination.

**Scope and permissions:** each kind is read only in the centers where **its own** read permission is
held: `appointments.read` for medical, `frontdesk.read` for sessions. A user with only one of them gets
that kind and the other is silently left out (no error). `403 FORBIDDEN` only when every requested kind
is refused (for example `centerIds` names a center where the user reads neither). If `centerIds` narrows
to nothing the user may read in a kind that is otherwise permitted, that kind just returns no rows (200,
`[]`); only the all-refused case is 403. A center-limited API key reads in its own center, each kind
only if the key holds that kind's permission.

MCP `list_day_appointments`: same service and same filters; a caller with no clinic chosen must name one
through `centerIds`.

## 6. Coming next, not in 4a

None of this exists in 4a. Do not build against it yet; it lands with releases 4b and 4c.

### 4b: check-in through the visit (not yet available)

From Task 7 of the plan (interfaces as planned, to be confirmed when 4b merges):

| | |
|---|---|
| `POST visits/check-in` (v1 `visitas/registrar-llegada`) | Permission `appointments.update` or `frontdesk.update`. Body `{ patientId, centerId, date?, appointmentIds?: string[] }`. `date` defaults to today in the center's time zone; a future date is 400 `VALIDATION_ERROR`. Without `appointmentIds`, every booked or confirmed row of the patient at that center that day, both kinds. |
| Response (HTTP 200 even if all fail) | `{ visitId, arrived: Row[], skipped: Row[], failed: (Row & { code, labelKey?, message, faltantes? })[] }`, `Row = { id, kind }`. A row already arrived is `skipped`. A consultation missing patient data is `failed` with `faltantes`, the others still arrive. |
| `POST visits/:id/undo` (v1 `visitas/:id/deshacer`) | Same permissions. Body `{ appointmentIds?: string[] }`. Undoes arrival of rows still waiting (called, for therapy); others are `failed` with `LIFECYCLE_ACTION_NOT_ALLOWED`. |
| Old door | `POST frontdesk/patients/:id/present` stays until the FE moves; it is removed in piece 6. |

4b also changes behaviour: leaving arrival unlinks the row from its visit and voids a visit that holds
nothing, and `check_in` becomes possible from no-show and not-served rows today only.

### 4c: the new end of day (not yet available)

From Task 8: from a switch date stored as data (`endOfDay.lifecycleFrom`, the day after deploy), one job
per center at its cutoff and time zone: medical booked or confirmed becomes no-show; waiting, called or
triage becomes not-served (arrival kept); open visits close. **Pending therapies stay pending** (decision
E1: therapy has no no-show status in this piece). The old end-of-day jobs act only on days before the
switch date. Screens need no change, but a "late" therapy row never turns into a no-show.

## Files to change (live screens only)

- **Citas day screen (new)**: the screen of `citas-day-screen.md`. One call to `GET appointments/day`
  (new `lib/api/appointments-day.ts` or in `lib/api/citas.ts`), bucket mapping from section 5 in `lib/`
  with tests, actions through the doors of sections 2 and 3, Confirmar = `confirm` door.
- `components/patient-desk/*` (`consultation-rows.tsx`, `service-sessions-table.tsx`,
  `patient-detail.tsx`, `therapy-booking-form.tsx`) and `hooks/use-patient-day.ts`: draw row buttons from
  `allowedActions`; therapy confirm / unconfirm button; send `confirmed` when booking.
- `components/tablero/*`: `tablero-acciones.tsx` (draw `allowedActions`, drop the `fromStatuses` /
  `permissionSlug` filter), `generic-board.tsx`, `nueva-cita-modal.tsx` (send `confirmed`).
- `components/citas/cita-actions.tsx`: the per-status action table (line ~68, e.g.
  `confirmada: ["presente", "reagendar", "noShow", "cancelar"]`) becomes `allowedActions`.
- Add-appointment modals: `components/agenda/cita-modal.tsx` and `components/tablero/nueva-cita-modal.tsx`
  send `confirmed: boolean` instead of a status; `lib/api/book-multiple.ts` and the train booking call
  take `confirmed`.
- `lib/api/*`: `citas.ts` (`unconfirm`, `confirmed` on create), `frontdesk.ts` (session confirm /
  unconfirm), `tablero.ts` (`allowedActions` type), the day list call.
- `lib/api/schema.d.ts`: regenerate with `npm run gen:api` against a backend running the 4a branch
  (`CMR_OPENAPI_URL` if not on `localhost:3001`).
- Delete `lib/lifecycle/board-action-rules.ts` and its test once the boards draw `allowedActions`
  (only exists if `feat/lifecycle-actions-screens` is merged).
- Not to touch: `/boards/frontdesk` and `components/frontdesk/` (deprecated screen).

## Out of scope here

Check-in through the visit and the new end of day (sections 6); removing the board status / transition
editors and the old doors (piece 6); the history reader on `status_changes` (piece 5).
