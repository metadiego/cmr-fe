# Appointments (Citas) — FE module

Route base: `/citas` (menu clave `citas`). i18n namespace: `appointments` (keys in English).
Status: **slices 1–2** (day agenda + create; list/board views + scheduling-flow transitions + polling). Slice 3 (triage/vitals, consult→atendida, reports) pending.

## API client — `lib/api/citas.ts` (+ `lib/api/personal.ts`)
Typed against `lib/api/schema.d.ts` (run `npm run gen:api` after BE changes).

| Function | Endpoint | Notes |
|---|---|---|
| `listCitas({page,limit,fecha,desde,hasta,medicoId,pacienteId,estado,canal})` | `GET /citas` | Paginated. **Returns ids only** (no names). |
| `getCita(id)` | `GET /citas/:id` | |
| `createCita(payload, centroId?)` | `POST /citas` | Tenant-scoped: `centroId` → `X-Tenant-ID`. |
| `getTiposCita()` | `GET /citas/tipos` | TipoCita: `clave/nombre/requiereMedico`. |
| `getMedicos()` (`personal.ts`) | `GET /personal?capacidad=medico` | Doctors for the selector. |
| `confirmarCita/presenteCita/noShowCita(id)` | `POST /citas/:id/{confirmar,presente,no-show}` | No body. |
| `cancelarCita(id, motivo)` | `POST /citas/:id/cancelar` | `motivo` required. |
| `reagendarCita(id, {fecha,hora,motivo})` | `POST /citas/:id/reagendar` | Creates a NEW cita on the new date. |

## Pages / components
- **Agenda** `app/(app)/citas/page.tsx` — date picker (default today) + estado/medico filters; **List ⇄ Board toggle**. List sorted by time with an actions menu per row. "New appointment" gated `citas.create`.
- **Board** `components/citas/cita-board.tsx` — Kanban columns by state (programada→…→atendida) + a trailing "Closed" column (no_show/cancelada/reprogramada); cards carry the actions menu.
- **Actions** `components/citas/cita-actions.tsx` — per-state scheduling transitions (confirm/check-in/reschedule/no-show/cancel) via a dropdown + dialogs (cancel reason, reschedule date/time/reason, no-show confirm). Gated `citas.update`.
- **Create Sheet** `components/citas/cita-form-sheet.tsx` — patient search-select, type, doctor, date/time/channel/first-visit/reason/notes. Center → `X-Tenant-ID` (master/multi-center must pick one).
- **Patient picker** `components/citas/paciente-select.tsx` — async search via `listPacientes({q})`.

## Realtime
Interim: the agenda **polls** (`reload` every 15s). True SSE (`GET /citas/stream`) is **pending**: native `EventSource` can't send the `Authorization` header, so the BE must accept the token via query param (or cookie) for header-less auth. Switch polling → SSE once supported.

## Transitions allowed per state (slice 2)
- programada: confirmar, reagendar, no-show, cancelar
- confirmada: presente, reagendar, no-show, cancelar
- presente / triage / en_consulta: cancelar (clinical flow = slice 3)
- atendida / no_show / cancelada / reprogramada: none (terminal)

## Business rules
- **Doctor:** shown when `tipo.requiereMedico`; **required only when NOT first visit** (`esPrimeraVez`). First visits are scheduled before a doctor is assigned (assigned later).
- **States:** programada → confirmada → presente → triage → en_consulta → atendida; + no_show / cancelada / reprogramada.
- **Channels:** atencion / callcenter / webhook / ia.

## Name resolution (interim)
`GET /citas` returns only `pacienteId/tipoCitaId/medicoId`. The agenda resolves: tipos & médicos from their small lists; patient names via parallel `getPaciente`. If volume grows, ask the BE to enrich the list response.

## Permissions
`citas.read` (menu), `citas.create`. FE gating cosmetic (`<Can>`); BE enforces.

## Known BE gaps (reported)
- BE does **not** enforce `medicoId` when `requiereMedico` (returns 201). Desired: require it only when `requiereMedico && !esPrimeraVez`. FE enforces this in the form meanwhile.
- Citas have **no hard delete** (only get/put + lifecycle transitions: confirmar/presente/triage/atender/no-show/cancelar/reagendar/reparar).

## Verification (done)
Against prod API — slice 1: create (201, estado=programada), filters fecha/medicoId/estado (200), missing tipoCitaId → 400. Slice 2: confirmar→confirmada, presente→presente, no-show→no_show, cancelar→cancelada, reagendar→201 (new cita on the new date). typecheck + lint green.
