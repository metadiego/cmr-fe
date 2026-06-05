# Module: auth-lifecycle (state gate + forced password change)

## Purpose
Enforce the invited-user lifecycle on the FE after login: a non-approved profile can't use the app,
and an invited user must change their temporary password first. The BE already 403s every protected
endpoint for non-approved profiles and exposes `mustChangePassword`; this only routes the UX.

## Files
- `components/session-gate.tsx` — client gate mounted in `app/(app)/layout.tsx` (wraps all authed
  routes). Reads `/auth/me` via `useMe()` and routes:
  1. `mustChangePassword` → `/change-password`;
  2. `estado != 'aprobado'` and not admin/master → `/pending`.
  Never redirects away from those two paths (no loops); renders children on a fetch failure (BE still
  enforces). Shows a loading state while resolving or redirecting.
- `app/(app)/pending/page.tsx` — explains the estado (pendiente/rechazado/suspendido) + sign out.
- `app/(app)/change-password/page.tsx` — sets the password via `supabase.auth.updateUser({password})`,
  then `markPasswordChanged()` (`POST /api/v1/auth/me/password-changed`), then **hard-navigates** to
  `/dashboard` so the persistent-layout gate re-reads `/auth/me` (avoids a stale-flag redirect loop).
- `app/auth/set-password/page.tsx` — **public** landing for the Supabase invitation magic link
  (`redirect_to` = BE `INVITE_REDIRECT_URL`). Establishes the session from the URL (hash tokens or
  PKCE `?code=` → `exchangeCodeForSession`), then `supabase.auth.updateUser({password})`, then hard-nav
  to `/dashboard`. Shows verifying / invalid-link / form. Added to `proxy.ts` PUBLIC_PATHS.
- `lib/api/auth.ts` — `Me.mustChangePassword?`, `markPasswordChanged()`.

## Invite (email) ↔ lifecycle
- Email-invited users are created `aprobado` + `mustChangePassword=false` (BE), so they go straight
  to `/dashboard` after `/auth/set-password` — the forced `/change-password` gate is for the
  with-password / legacy edge.

## i18n keys
`common.loading`, `pending.*`, `password.*` (English keys; es.json holds Spanish).

## BE dependencies
`GET /auth/me` (`estado`, `mustChangePassword`) · `POST /auth/me/password-changed`. Password change
itself is Supabase Auth (client), not the BE.

## Decisions
- Gate is client-side: `apiFetch`/`/auth/me` read the **browser** session, so it can't run in the
  server layout. The server layout still guards the session; this gate adds the lifecycle.
- Priority: password change before the estado gate (a fresh invited user is `aprobado` +
  `mustChangePassword`).
- Hard navigation after password change instead of refetching `useMe` (gate lives in the persistent
  layout and wouldn't re-run on soft navigation).

## Center selector (tenant)
- `components/center-selector.tsx` (in the header) — shown only for operativo users with
  `allowedClinicIds.length > 1`. Lists `getMyCentros()` (`GET /auth/me/centros`, centers with name),
  and on change sets the `cmr_active_centro` cookie (`lib/tenant.ts`) + reloads.
- `lib/api/client.ts` `authHeaders()` sends `X-Tenant-ID` from that cookie (fallback
  `app_metadata.clinic_id`). The BE validates it against `allowedClinicIds` (409 if N centers and
  none chosen; auto-locks for 1).

## Pending
- `useMe()` is fetched in the gate, the header, the dashboard, and the selector separately — consider
  a shared context to dedupe `/auth/me`.
- "Forgot password" (`supabase.auth.resetPasswordForEmail`) — needs Supabase SMTP; not built.
