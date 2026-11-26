# Appointment lifecycle, piece 5 (frontend): hand-off

Release 5d. The backend (5a-5c) now exposes the appointment stages next to the old status. The
frontend moves its readers from the old Spanish `estado` / `status` words to stage groups.
Plan: `cmr-be/docs/plans/appointment-lifecycle-5-move-consumers.md` (Part B).

## What the responses carry

Types are regenerated in `lib/api/schema.d.ts` (`npm run gen:api`, commit 21798db).

- `CitaEntity` (appointments / citas): `bookingStatus`, `careStatus`, `syncedStatus`, plus the old `status` (`estado` in v1 payloads).
- `FrontdeskSesionEntity` (therapy sessions): `bookingStatus`, `careStatus`, `syncedStatus`, plus the old `status`.
- Every endpoint that returns one of those two entities (lists, detail, create/update, stream) carries the fields; no other schema has them.
- `bookingStatus`: `booked | confirmed | arrived | cancelled | no_show | rescheduled | null`.
- `careStatus`: `waiting | triage | in_consultation | done | not_served` (medical), `waiting | called | in_therapy | done | not_served` (therapy), or `null`.
- `syncedStatus`: the old status the stage columns were last synced from. A row whose old status differs from `syncedStatus` has stale stage columns (a writer that bypasses the API changed it, the reconciler catches up within a minute); `bookingStatus` null means no stage yet.

`estado` / `status` STAY in responses until piece 6. The old values are read only inside `lib/lifecycle/`.

## New list filters

Repeated or comma separated, accepted on REST v1 and v2:

- `CitasController_list` (citas list) and `CitasController_countByDay`: `bookingStatus[]`, `careStatus[]`.
- `FrontdeskController_listarSesiones` (therapy sessions): `bookingStatus[]` (`booked | confirmed | arrived | cancelled`), `careStatus[]` (`waiting | called | in_therapy | done | not_served`).
- The old `status` query param stays accepted but is deprecated (translated to its group on the backend). Readers should not send it.

## The FE groups (`lib/lifecycle/stage-groups.ts`)

Same names and unions as the backend module. `stagesOf(kind, row)` trusts `bookingStatus` / `careStatus` when
`bookingStatus` is present and the row has no `syncedStatus` key (a present null counts as not synced) or it equals the row's old status; otherwise it derives the stages from the
old value (a copy of the backend mapping, kept only in `lib/lifecycle/`). A status it does not know gives `null` stages
(`isNotCancelled` counts it as not cancelled, as the old read did).

| Group | medical (old value) | therapy (old value) |
|---|---|---|
| `booked` | booked (`programada`) | - |
| `confirmed` | confirmed (`confirmada`) | - |
| `upcoming` | - | booked, confirmed (`pendiente`) |
| `waiting` | arrived / waiting (`presente`) | arrived / waiting, arrived / called (`presente`) |
| `triage` | arrived / triage (`triage`) | - |
| `in_consultation` | arrived / in_consultation (`en_consulta`) | - |
| `in_therapy` | - | arrived / in_therapy (`en_terapia`) |
| `done` | arrived / done (`atendida`) | arrived / done (`asistido`) |
| `no_show` | no_show (`no_show`) | - |
| `cancelled_or_not_served` | cancelled, arrived / not_served (`cancelada`) | cancelled, arrived / not_served (`cancelada`) |
| `rescheduled` | rescheduled (`reprogramada`) | - |

Named unions: `LIVE`, `IN_CARE`, `SHOWED_UP`, `BEFORE_ARRIVAL`, `NOT_OCCUPYING_THE_DAY` (medical), `SHOWN_IN_LIST`,
`NOT_CANCELLED`; helpers `groupsExcept`, `inGroups`, `groupOf`, `stagesInGroup`, `rowInGroups`, `isNotCancelled`.
Use positive group lists, not negations of a stage predicate (a row with no stage would fall out of both).
