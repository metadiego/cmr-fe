# Master Panel (FE) — Plan

**Date:** 2026-06-03
**Status:** Proposed

Spec: `docs/specs/2026-06-03-master-panel-design.md`. Module doc (on completion):
`docs/modules/master-panel.md`.

## Phase 1 — Foundations + Pending approval
1. **Shadcn primitives:** `npx shadcn@latest add table dialog form select badge sonner dropdown-menu
   alert-dialog`. Mount `<Toaster/>` (sonner) in `app/layout.tsx`.
2. **`lib/api/profiles.ts`** — types `Perfil`, `Asignacion`, `InvitePayload`, `InviteResponse`;
   functions `getPending(page?,limit?)`, `getProfiles(...)`, `approveProfile(id)`,
   `rejectProfile(id, motivo)`, `inviteUser(payload)`, `assignCenter(profileId, payload)`. Calca
   `lib/api/health.ts`; reuse `Paginated<T>` from `lib/api/types.ts`, `AccessMode`/`PerfilEstado`
   from `lib/api/auth.ts`.
3. **`lib/api/centers.ts`** — type `Centro`; `getCenters(...)`, `createCenter(payload)`.
4. **`hooks/use-me.ts`** — client hook wrapping `getMe()` → `{ state: loading|ok|fail, me }` (cleanup
   like dashboard). Used for gating + nav.
5. **`components/admin/admin-guard.tsx`** — client wrapper: loading spinner → if
   `me.isMaster || me.roles.includes('admin')` render children, else a localized "no access" notice.
6. **`app/(app)/admin/page.tsx`** — client page wrapped in `<AdminGuard>`, Shadcn `tabs`
   (Pending · Users · Centers); Phase 1 wires the **Pending** tab, others are placeholders.
7. **`components/admin/pending-profiles.tsx`** — `table` of pending profiles (`badge` for estado),
   **Approve** (button → `approveProfile` → toast + refresh) and **Reject** (`alert-dialog` with a
   `motivo` field → `rejectProfile`). States `loading|ok|fail`, `ApiError` → toast.
8. **Nav:** in `site-header.tsx`, add an **Admin** link (desktop + mobile) shown only when
   `useMe()` says `isMaster`. Add `/admin` to nav i18n.
9. **i18n:** add `admin` namespace to `messages/{es,en}.json` (English keys; es = Spanish copy).

## Phase 2 — Invite users
10. **`components/admin/invite-form.tsx`** — `form` (email, nombre, apellido?, `select` accessMode) →
    `inviteUser`. On success: toast + if `tempPassword` present, show it once in a `dialog` with a
    copy button and a "won't be shown again" warning. Then offer **assign center** (`select` of
    `getCenters()` → `assignCenter`).
11. Wire the **Users** tab: `getProfiles()` table + the invite entry point.

## Phase 3 — Centers & assignments
12. **`components/admin/centers-list.tsx`** — `table` of centers + **create** (`dialog` + `form`:
    nombre, codigo, direccion?, activo) → `createCenter` → refresh.
13. Polish assignment UX from a profile row (reuse the Phase 2 assign flow).

## Verification (each phase)
- `npm run typecheck && npm run lint && npm run build` green.
- dev :8080 logged in as master (`atencion@centrodemedicinaregenerativa.com` / `cmr.2026!`):
  - Non-admin (or logged out) never sees the Admin link; `/admin` shows "no access".
  - **Pending:** approve moves a profile out of the list; reject requires motivo; both toast.
  - **Invite:** creating a user shows tempPassword once; assign center succeeds.
  - **Centers:** create appears in the list.
  - Errors (e.g. duplicate email) surface as a toast with `code · message`, no crash.
- Confirm i18n: ES↔EN toggle translates the whole panel.

## Notes / gotchas
- `apiFetch` is **browser-only** (reads browser Supabase session) → admin pages/components are
  Client Components; gating is cosmetic, BE enforces (`@Roles('admin')`, #6).
- Next 16: Client Components for state/effects; keep mutations inside `lib/api/`.
- Pagination: wire controls only if `pagination.total` exceeds the page limit (keep Phase 1 simple).
