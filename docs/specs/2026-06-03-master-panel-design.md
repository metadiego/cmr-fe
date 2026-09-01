# Master Panel (FE) — Design

**Date:** 2026-06-03
**Status:** Proposed

## Goal & scope
An admin area, visible only to master/admin principals, to run user onboarding and tenant setup
against the BE (which already exposes and enforces every endpoint). Three capabilities:

1. **Invite users** — create an approved user in one step (`POST /profiles/invite`); show the
   one-time `tempPassword` when the BE generates one; then optionally assign a center.
2. **Pending profiles** — list `estado='pendiente'` and **approve** / **reject (with motivo)**.
3. **Centers & assignments** — list/create centers; assign a profile to a center.

**In scope:** route `app/(app)/admin/`; client-side cosmetic role gating; `lib/api/profiles.ts` +
`lib/api/centers.ts`; the three UIs; an `admin` i18n namespace (English keys); the Shadcn primitives
the panel needs; a conditional "Admin" nav entry. **Out of scope:** edit/delete users, suspend,
RBAC-fino permissions (#6, Fase 3), per-user prefs, real-time. No `cmr-be` changes (endpoints are
deployed).

## Backend facts relied on (deployed)
All under `/api/v1`, admin/master-only; master passes `@Roles('admin')` via synthetic roles (fix
`48ed030`). Envelope `{data,meta}`; paginated lists return `{items, pagination:{total,page,limit}}`
(`Paginated<T>` in `lib/api/types.ts`).

- `POST /profiles/invite` — body `{ email, nombre, apellido?, accessMode?('operativo'|'gerencial'),
  password? }` → `{ ...perfil, tempPassword? }` (`tempPassword` only when no `password` was sent —
  show once).
- `GET /profiles/pending` → `Paginated<Perfil>`.
- `POST /profiles/:id/approve` → `Perfil`. `POST /profiles/:id/reject` — body `{ motivo }` → `Perfil`.
- `POST /profiles/:id/asignaciones` — body `{ centroId, tipo?, vigenteDesde?, vigenteHasta?,
  forzado? }` → `Asignacion`.
- `GET /profiles` → `Paginated<Perfil>`. `GET /centros` → `Paginated<Centro>`.
  `POST /centros` — body `{ nombre, codigo, direccion?, activo? }` → `Centro`.

## Approach (Next 16 + API-First + #6 cosmetic RBAC)
- **Data access only via `lib/api/`** (calca `lib/api/health.ts`): new `lib/api/profiles.ts` and
  `lib/api/centers.ts` with typed `Perfil`/`Centro`/`Asignacion` + payloads, using the browser
  `apiFetch` (Bearer + X-Tenant-ID already handled). Mutations carry `method` + JSON body.
- **Role gating is client-side & cosmetic.** `apiFetch` reads the **browser** Supabase session, so
  it cannot run in a Server Component. The `(app)` server layout already guards *session*. For
  *role*, a small client hook `useMe()` (wraps `getMe()` with loading/ok/fail) feeds:
  - an `<AdminGuard>` client wrapper for `app/(app)/admin/*` that shows loading → renders children if
    `isMaster || roles.includes('admin')`, else a "no access" notice (no redirect needed; routes 404
    nothing). **Real authorization stays in the BE** (#6).
  - a conditional **Admin** link in `site-header.tsx`, shown only when `me?.isMaster`.
- **UI:** `app/(app)/admin/page.tsx` is a client page with **tabs** (Pending · Users · Centers).
  Each tab is a component under `components/admin/`. Lists use a Shadcn `table`; mutations use
  `dialog`/`alert-dialog` + `form` + `select`; feedback via `sonner` toasts; states follow the
  dashboard pattern (`loading | ok | fail`, `ApiError` caught and shown).
- **Shadcn to add:** `table dialog form select badge sonner dropdown-menu alert-dialog` (only
  `button input sheet` exist today).
- **i18n:** new `admin` namespace in `messages/{es,en}.json`, **keys in English** (project rule);
  `es` holds Spanish copy. No hardcoded text. BE error messages shown verbatim.

## Edge cases
- Non-master who reaches `/admin` → `<AdminGuard>` "no access" (and BE 403s the calls anyway).
- Invite returns `tempPassword` → display once with a copy action; warn it won't be shown again.
- Reject requires `motivo` (validate non-empty before calling).
- Mutations: disable buttons while pending; on `ApiError` show toast with `code · message`; refresh
  the affected list on success.
- Empty lists → explicit empty state. Pagination: start with page 1 / a sane limit; wire controls if
  `pagination.total` exceeds it.

## Phasing (see plan)
- **Phase 1 (first delivery):** foundations (shadcn, `lib/api/*`, `useMe`, `AdminGuard`, `/admin`
  shell + tabs, nav link) **+ Pending approval tab** (highest immediate value).
- **Phase 2:** Invite users (+ one-time tempPassword) + assign center.
- **Phase 3:** Centers management (list + create) and assignment polish.
