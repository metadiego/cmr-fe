# Module: master-panel (admin)

## Purpose
Admin-only area (`/admin`) for master/admin principals to onboard users and set up tenants against
the BE. **Realigned to invite-only** (the real alta is invite + assign, not approve-pending).
**Shipped:** Users tab (list + **invite** with one-time tempPassword + **assign center**), Centers
tab (list + **create**), Pending tab (approve/reject — kept as backup, decided in operation).
Spec: `docs/specs/2026-06-03-master-panel-design.md`; plan: `docs/plans/2026-06-03-master-panel.md`.

## Files
- `app/(app)/admin/page.tsx` — client page; `<AdminGuard>` + Tabs (**Users** (default) · Centers ·
  Pending).
- `components/admin/admin-guard.tsx` — cosmetic role gate (loading → admin? children : no-access).
- `components/admin/users-list.tsx` — `getProfiles` table + Invite button + per-row Assign center.
- `components/admin/invite-dialog.tsx` — invite form → `inviteUser`. **Email flow (BE 2026-06-05):**
  no password sent → BE returns `emailSent:true` → dialog shows "invitation sent" (the invited user
  sets their password at `/auth/set-password`). tempPassword path kept as a fallback. Then offer
  assign. Reset-on-close (handler, not effect).
- `components/admin/assign-center-dialog.tsx` — shared; loads `getCenters`, `assignCenter`.
- `components/admin/centers-list.tsx` — `getCenters` table + create dialog (`createCenter`).
- `components/admin/pending-profiles.tsx` — table of pending profiles; approve + reject(motivo).
- `lib/api/errors.ts` — shared `apiErrorMessage(err)` for toasts.
- `hooks/use-me.ts` — `useMe()` client hook (wraps `getMe()`) + `isAdmin(me)`. Used by the guard and
  the header's Admin link.
- `lib/api/profiles.ts` — `Perfil`/`Asignacion`/`InvitePayload`/`InviteResponse`; `getPendingProfiles`,
  `getProfiles`, `approveProfile`, `rejectProfile`, `inviteUser`, `assignCenter`.
- `lib/api/centers.ts` — `Centro`; `getCenters`, `createCenter`.
- `components/site-header.tsx` — conditional **Admin** link (shown when `useMe()` → isAdmin).
- `app/layout.tsx` — mounts `<Toaster/>` (sonner) for feedback.

## i18n keys (namespaces)
`admin` (title, loading, noAccess, comingSoon, tabs.*, columns.*, approve, reject, approved, rejected,
emptyPending, reject dialog keys) + `nav.admin`. Keys in **English**; `es.json` holds Spanish copy.

## How to use
Routes via the header **Admin** link or `/admin`. Each tab is a self-contained client component that
fetches via `lib/api/`, follows the `loading | ok | fail` pattern, catches `ApiError`, and surfaces
mutations through `sonner` toasts. To add a tab: build `components/admin/<tab>.tsx` and wire it into
`app/(app)/admin/page.tsx`.

## BE dependencies (all `/api/v1`, admin/master-only, deployed)
`GET /profiles/pending`, `POST /profiles/:id/approve`, `POST /profiles/:id/reject {motivo}`,
`POST /profiles/invite`, `POST /profiles/:id/asignaciones`, `GET /profiles`, `GET/POST /centros`.
Master passes `@Roles('admin')` via synthetic roles.

## Decisions
- **Cosmetic, client-side role gating** (#6): `apiFetch` reads the browser Supabase session, so it
  can't run server-side; the guard only hides UI. **Real authorization is BE-enforced.**
- Session is already guaranteed by `app/(app)/layout.tsx` + `proxy.ts` (`/admin` is protected).
- Reject uses a `Dialog` + `Textarea` (motivo required) rather than `alert-dialog` (which auto-closes).
- No `react-hook-form`/shadcn `form` yet — controlled inputs suffice (added in Phase 2 only if needed).

## Pending
- **Fase 2 (auth):** state gate (no-aprobado → `/pending`) + forced password change
  (`mustChangePassword`).
- **Fase 3 (operación):** center selector (`getMyCentros`, dynamic `X-Tenant-ID`).
- Browser test of the interactive flow (invite/assign/create) against the live BE.
- Pagination controls (only page 1 fetched today). Center `activo` toggle on create (defaults true).
- `useMe()` runs on every header render (incl. public pages → a 401 when logged out). Consider a
  shared context if it becomes noisy.
