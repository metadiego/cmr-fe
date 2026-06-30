# Appointments (Citas) — FE module

Route base: `/citas` (menu clave `citas`). i18n namespace: `appointments` (keys in English).
Status: **slice 1** (day agenda + create). Slices 2–3 (board + realtime + transitions, triage/vitals, reports) pending.

## API client — `lib/api/citas.ts` (+ `lib/api/personal.ts`)
Typed against `lib/api/schema.d.ts` (run `npm run gen:api` after BE changes).

| Function | Endpoint | Notes |
|---|---|---|
| `listCitas({page,limit,fecha,desde,hasta,medicoId,pacienteId,estado,canal})` | `GET /citas` | Paginated. **Returns ids only** (no names). |
| `getCita(id)` | `GET /citas/:id` | |
| `createCita(payload, centroId?)` | `POST /citas` | Tenant-scoped: `centroId` → `X-Tenant-ID`. |
| `getTiposCita()` | `GET /citas/tipos` | TipoCita: `clave/nombre/requiereMedico`. |
| `getMedicos()` (`personal.ts`) | `GET /personal?capacidad=medico` | Doctors for the selector. |

## Pages / components
- **Agenda** `app/(app)/citas/page.tsx` — date picker (default today) + estado/medico filters + list sorted by time, colored status dot. "New appointment" gated `citas.create`.
- **Create Sheet** `components/citas/cita-form-sheet.tsx` — patient search-select, type, doctor, date/time/channel/first-visit/reason/notes. Center → `X-Tenant-ID` (master/multi-center must pick one).
- **Patient picker** `components/citas/paciente-select.tsx` — async search via `listPacientes({q})`.

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

## Verification (slice 1, done)
Against prod API: create (201, estado=programada), filters by fecha/medicoId/estado (200), missing tipoCitaId → 400. typecheck + lint green.
