# Appointment actions on the boards: hand-off from the backend (piece 3 to piece 4)

**From:** `cmr-be` branch `feat/appointment-lifecycle-3-decide` (PRs 3a, 3b, 3c).
**For:** the frontend work of piece 4 ("Switch") of the appointment-lifecycle program
(`cmr-be/docs/plans/appointment-lifecycle-program.md`; design `cmr-be/docs/specs/appointment-lifecycle.md`,
section "As built in piece 3"). The Citas screen itself is specified in `citas-day-screen` / the
`2026-11-23-citas-day-sheet-tab-design.md` spec; this document only covers the board actions and modals.

## What changed in the backend

One action catalogue in the backend (`src/modules/appointment-lifecycle/actions/catalogue.ts`) now decides
every move of a medical appointment or a therapy session: from which stage, which permission, which form,
whether a reason or a confirmation is needed. The old slugs your boards send keep working
(`POST /board/action` with `action: <slug>`, the REST transition endpoints, MCP). **Nothing breaks on the
current screens.** A few moves are now refused or mean something stricter, listed below, so the screens
should stop offering them.

`allowedActions` per row (the list of actions valid now and permitted to this user in that row's center)
**arrives with piece 4, not before.** Until then the boards keep drawing buttons from
`definicion.transiciones` (`components/tablero/tablero-acciones.tsx`: `TableroAcciones`). The backend check
is the gate; the button list is a convenience.

## Action keys and labels

Every action has the label key `lifecycle.action.<key>`. Add one ES and one EN string per key to
`messages/es.json` and `messages/en.json` (parity is enforced by `lib/i18n/messages-parity.test.ts`).

Medical (`appointments`): `confirm`, `unconfirm`, `check_in`, `undo_check_in`,
`undo_check_in_clear_vitals`, `undo_check_in_keep_vitals`, `start_triage`, `start_consultation`, `finish`,
`back_to_consultation`, `back_to_triage`, `back_to_waiting`, `not_serve`, `cancel`, `no_show`,
`reschedule`, `repair`.

Therapy (`frontdesk_sessions`): `confirm`, `unconfirm`, `check_in`, `undo_check_in`, `call`, `uncall`,
`start_therapy`, `finish`, `unattend`, `undo_attendance`, `back_to_waiting`, `not_serve`, `cancel`, `move`,
`reopen`, `reactivate`, `repair`, `remove_entry_error` (the last one arrives with PR 3c: deleting a session
becomes a cancel marked as an entry error).

Suggested wording for the one that needs care: `not_serve` = "Patient left (not served)" / "El paciente se
fue (no atendido)". `undo_attendance` = "Undo attendance" / "Deshacer atencion". `reactivate` = "Reactivate".

## Old slug to action

`cancelar` resolves by the row's stage; every other slug is fixed.

| Slug (board / REST) | Medical action | Therapy action |
|---|---|---|
| `confirmar` | `confirm` | (no door yet: therapy confirm arrives in piece 4) |
| `volver_programada` | `unconfirm` | |
| `presente` | `check_in` | `check_in` |
| `triage` | `start_triage` | |
| `consulta` | `start_consultation` | `start_therapy` |
| `atender` | `finish` | `finish` |
| `en_terapia` | | `start_therapy` |
| `asistido` | | `finish` |
| `desasistir` | | `unattend` |
| `desatender` | | `undo_attendance` |
| `volver_confirmada` | `undo_check_in` | |
| `quitar_presente` | `undo_check_in_clear_vitals` | |
| `quitar_presente_conservar_vitales` | `undo_check_in_keep_vitals` | |
| `volver_en_consulta` | `back_to_consultation` | |
| `volver_triage` | `back_to_triage` | |
| `volver_presente` | `back_to_waiting` | `back_to_waiting` |
| `volver_pendiente` | | `undo_check_in` |
| `reactivar` | | `reactivate` |
| `no_show` | `no_show` | |
| `reagendar` | `reschedule` | |
| `cancelar`, stage booked or confirmed | `cancel` | `cancel` |
| `cancelar`, arrived and waiting / triage (medical) or waiting / called (therapy) | `not_serve` | `not_serve` |
| `cancelar`, any other stage (in consultation, in therapy, done, already cancelled) | refused | refused |

Piece 4 should send the action key itself instead of a slug (the backend accepts both).

## Behaviour the screens must follow

1. **"Cancel" on an arrived row means "patient left (not served)" and needs a reason.** When the
   patient has checked in and is still waiting (called or in triage included), the Cancel button performs
   `not_serve`: relabel it (`lifecycle.action.not_serve`) and make the reason field required (it already is
   in the production `cancelar` rows: `formFields: ["motivo"]`). The stored status is still `cancelada`
   and the arrival stays, so counts and colors do not move; the row's care stage becomes "not served".
   On a row that has not arrived, Cancel stays "Cancel" (reason required).
2. **Hide these buttons** (the backend now refuses them with `LIFECYCLE_ACTION_NOT_ALLOWED`):
   - Cancel while the patient is in consultation, in therapy, or already done. The way back is a
     correction button (back to waiting / unattend) and then not-served, or an admin repair.
   - No-show once the patient has arrived (any care stage).
   - No-show on a future date (see errors).
3. **Confirm / unconfirm need the permission `appointments.confirm`** (both kinds). It was granted to
   everyone who held `appointments.update`, so nobody lost it today. Replace the `appointments.update`
   gate on confirm and unconfirm buttons by `can("appointments.confirm")`. Check `lib/rbac/permission-aliases.ts`
   and any menu or role editor that lists permission keys.
4. **A board action now answers 403 when the user lacks the permission in the appointment's own center.**
   Before, the board door only looked at the user's flat permission list. The board must not assume a
   permitted button works in every center: show the 403 (message below) and refresh the row.
5. **`desatender` ("undo attendance") now needs `frontdesk.update`** and asks the `frontdesk.unattend`
   confirmation. **`reactivar` needs `frontdesk.repair`**, works only the same day, and fails if the package
   is gone or the seat is taken.
6. **Therapy `call` also works on a row already called** (it reassigns the technician): a "call again" /
   "change technician" button is valid.
7. **Walk-ins are born booked, not confirmed.** A patient added at the desk has no confirmation stamp, so
   a "Confirmed" badge must not be inferred from "arrived".

## Errors and what to show

The backend answers `{ error: { code, message, details } }` plus `labelKey` and the error's own values on
the same object. `lib/api/errors.ts` (`apiErrorLabel`, used by `toastError` inside `useSubmit`) already
translates the `labelKey`, then falls back to `errores.<CODE>`, then the message. So adding strings is
enough for a toast; the table says what each means and what the screen should also do.

| Code | HTTP | labelKey | Meaning | Show / do |
|---|---|---|---|---|
| `LIFECYCLE_ACTION_NOT_ALLOWED` | 400 | `lifecycle.action.notAllowed` | The action is not valid from the row's current stage (an old screen, or the row changed) | Toast "This action is no longer available for this record"; refetch the row so the buttons redraw. Payload carries `from` (the stages) |
| `LIFECYCLE_STALE` | 409 | `lifecycle.action.stale` | Someone else moved the record a moment ago (carries `expectedStatus`, `currentStatus`) | Toast "Someone else just changed this record"; refetch; do not retry automatically |
| `LIFECYCLE_REASON_REQUIRED` | 400 | `lifecycle.action.reasonRequired` | The action needs a reason and none was sent | Keep the dialog open, mark the reason field invalid. Normally prevented by the required field |
| `LIFECYCLE_UNKNOWN_ACTION` | 400 | `lifecycle.action.unknown` | The slug or key is not an action of this kind | A bug on the client; generic toast, log it |
| `VALIDATION_ERROR` | 400 | `lifecycle.action.futureDate` | No-show for a date that has not come (value in `fecha`) | Toast "A no-show can only be recorded for today or a past date". Hide the button for future dates |
| `FORBIDDEN` (403) | 403 | (none) | The user lacks the action's permission in the record's center | Toast "You do not have permission for this action in this center"; do not retry |

Other existing errors still apply and are unchanged: for example `TRANSICION_REQUISITO` when a required field
(nurse, technician) is missing. A missing doctor on consult or attend answers `CITA_MEDICO_REQUERIDO` with
labelKey `citas.medico_requerido_en_consulta`, the same error the consult lock already gave.

**Timing:** these strings must ship before or together with backend PR 3b. If 3b reaches production first,
staff see the backend's English message in the toast.

New label keys to translate, in total: `lifecycle.action.<key>` (one per action above),
`lifecycle.action.notAllowed`, `lifecycle.action.unknown`, `lifecycle.action.reasonRequired`,
`lifecycle.action.stale`, `lifecycle.action.futureDate`. Add `errores.LIFECYCLE_*` as the fallback by code.

## After 3c: deleted sessions stay

Backend PR 3c changes what deleting a therapy session does:

- **A deleted session stays, as a cancelled row.** `DELETE sesiones/:id` no longer removes the row: it is
  cancelled (status `cancelada`, no arrival, call or therapy stamp) and its history row carries
  `details.entryError = true` (action `remove_entry_error`). The row, its events and its forms are kept,
  and undoing the deletion from the change log brings it back where it was.
- **The Patient desk shows it as cancelled.** The day's sessions include it, so
  `components/patient-desk/service-sessions-table.tsx` draws it with the "cancelled only" mark
  (`cancelledOnly`, from `serviceCancelledOnly` in `lib/frontdesk/patient-day.ts`) when every row of that service that day is cancelled.
- **It counts as a cancellation** in every count and list until pieces 4/5 hide entry errors. Nothing in
  the frontend should try to hide it before the backend exposes the mark.
- **Train-booking rollback legs stay too.** When booking a train fails half way, the legs already created
  are now cancelled rows (entry errors), not removed; they show as cancelled on the desk.
- **MCP `appointment_transition` no longer accepts `confirmar`.** Confirming goes through
  `confirm_appointment` (permission `appointments.confirm`). Any prompt or agent that used
  `accion: confirmar` must switch.

## Files to change (live screens only)

- `components/tablero/tablero-acciones.tsx`: the declarative action menu of a board row (filters by
  `fromStatuses`, `permissionSlug`). Used by `components/tablero/generic-board.tsx`, which both the
  patient desk's consultation rows (`components/patient-desk/consultation-rows.tsx`) and the service
  tables reuse. Today it needs: the Cancel to not-served relabel and required reason, hiding the refused
  moves, the new permission on confirm. In piece 4 it switches to drawing `allowedActions`.
- `components/patient-desk/service-sessions-table.tsx` and `components/patient-desk/patient-detail.tsx`:
  the live Patient desk (`/boards/patient-desk`); therapy buttons, the "called" re-call, the confirm
  button when therapy confirm lands.
- `lib/api/tablero.ts` (`ejecutarAccion`, `Transicion`): the POST `/board/action` call; add `allowedActions`
  types when piece 4 delivers them. `lib/api/schema.d.ts` is regenerated from Swagger.
- `lib/api/errors.ts` and `messages/{es,en}.json`: error strings and label keys above.
- Not to touch: `/boards/frontdesk` and `components/frontdesk/` are the deprecated screen (20-oct-2026).

## Out of scope here

- `allowedActions`, `GET appointments/day`, check-in via visits, therapy confirm door, the new end of day
  job: piece 4 (backend), with the Citas screen.
- Removing the board status / transition editors: piece 6.
