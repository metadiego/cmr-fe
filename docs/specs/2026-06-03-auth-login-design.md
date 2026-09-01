# Auth — Login / sesión / route protection — Design

**Date:** 2026-06-03
**Status:** Approved

## Goal & scope
Build the login flow that the wiring spec (`2026-06-02-wire-fe-to-be`) left out: email+password
login against **Supabase Auth**, session via `@supabase/ssr`, **route protection**, an authenticated
landing that shows the principal's context from the BE (`GET /api/v1/auth/me`), and **logout**.

**In scope:** `/login` page + Server Action; protected route group `(app)` with `/dashboard`;
session gating (proxy + server layout); `lib/api/auth.ts` (`getMe`); wiring the "Iniciar sesión"
buttons. **Out of scope:** signup, password reset, multi-center selector UI, domain modules. No
changes to `cmr-be`. Master login only (`atencion@…`); other roles handled by the BE already.

## Backend facts relied on
- Login is client-side against Supabase (`signInWithPassword`); the BE does **not** issue tokens.
  Supabase signs **ES256** tokens (the BE verifies them via JWKS — already deployed).
- `GET /api/v1/auth/me` returns `{ id, perfilId, email, estado, roles, permissions, isMaster,
  accessMode, allowedClinicIds, activeClinicId }` (reachable while `pendiente`).
- CORS allows `http://localhost:8080` and the Vercel origin; envelope `{ data, meta }`.

## Approach (Next 16 + @supabase/ssr)
- **Login = Server Action** using the **server** Supabase client (`lib/supabase/server.ts`) so the
  session cookies are written server-side; on success `redirect('/dashboard')`, on failure return a
  typed error to the form (`useActionState`).
- **Session refresh + gating** in `proxy.ts` (Next 16's renamed middleware): keep the existing
  refresh; add a redirect to `/login` for unauthenticated requests to protected paths.
- **Defense in depth:** `app/(app)/layout.tsx` is a Server Component that calls the server client
  `getUser()` and `redirect('/login')` when there is no session.
- **Authenticated landing `/dashboard`** is a Client Component: calls `getMe()` (the shared
  `apiFetch` reads the session via the **browser** client) and renders the context; **logout**
  button (browser `signOut` → `/login`).

## Edge cases
- Bad credentials → Supabase error surfaced inline on the form (no redirect).
- `/dashboard` without session → redirect `/login` (proxy + layout).
- `/login` with an active session → redirect `/dashboard` (optional nicety).
- `/auth/me` 401 (e.g. token rejected) → ApiError shown; user can re-login.
