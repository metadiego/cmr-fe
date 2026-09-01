# Patients (Pacientes) — FE module

Route base: `/clientes` (menu clave `clientes`). i18n namespace: `patients` (keys in English).

## API client — `lib/api/pacientes.ts`
Typed against `lib/api/schema.d.ts` (run `npm run gen:api` after BE changes).

| Function | Endpoint | Notes |
|---|---|---|
| `listPacientes({page,limit,q})` | `GET /pacientes` | Paginated (`apiFetchPaged`). `q` is server-side search (name/docId/phone/…). |
| `getPaciente(id)` | `GET /pacientes/:id` | |
| `createPaciente(payload, centroId?)` | `POST /pacientes` | Tenant-scoped: `centroId` → `X-Tenant-ID`. |
| `updatePaciente(id, payload, centroId?)` | `PUT /pacientes/:id` | Reactivate via `{activo:true}`. |
| `deletePaciente(id, centroId?)` | `DELETE /pacientes/:id` | **Soft-delete** (`activo=false`); patient drops out of the list. |

## Pages
- **List** `app/(app)/clientes/page.tsx` — `ListToolbar` (search) + `DataTable` (rows clickable → detail) + pagination. "New patient" button gated `pacientes.create`.
- **Detail** `app/(app)/clientes/[id]/page.tsx` — avatar + sections (Contact / Personal / Clinical); Edit (`pacientes.update`), Deactivate (`pacientes.delete`, confirm dialog), Reactivate (`pacientes.update`, shown when inactive).
- **Create/Edit Sheet** `components/clientes/paciente-form-sheet.tsx` — sectioned form; only `nombres` required. Master/multi-center users must pick a **Center** (sent as `X-Tenant-ID`); single-center is auto.

## Tenancy
Writes require an active center. The form resolves it from: explicit pick → `cmr_active_centro` cookie → the only center. Without one, the BE returns 500 — the form blocks submit until a center is chosen.

## Permissions (BE `@Permissions`)
`pacientes.read` (menu), `pacientes.create`, `pacientes.update`, `pacientes.delete`. FE gating is cosmetic (`<Can>`); the BE enforces.

## Verification (done)
End-to-end against the prod API: create (required-only / all fields / subset), get, update (subset), list, soft-delete + reactivate, and validation 400s (missing `nombres`, invalid `sexo`/`email`). typecheck + lint green.
