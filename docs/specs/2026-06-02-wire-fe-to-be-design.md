# Wire `cmr-fe` to `cmr-be` — Design

**Date:** 2026-06-02
**Status:** Approved

## Goal & scope

Scaffold the plumbing so `cmr-fe` (Next.js 16, App Router, shadcn/ui) talks to
`cmr-be` (NestJS 11) for auth-token-bearing data calls, using `@supabase/ssr`
for session management.

**Out of scope (explicit):** auth flows — login/signup/logout UI, route
protection/gating, and obtaining the initial session. We only build the
clients, config, and wiring that auth and feature work will later consume.
No changes to `cmr-be`.

## Backend facts this design relies on

- Base URL `http://localhost:3000`, global prefix `api`, URI versioning →
  feature endpoints at `/api/v1/...`. Health is `@Public()` at `/api/health`
  (no version segment).
- Auth: `Authorization: Bearer <token>`. A Supabase JWT is verified against
  `SUPABASE_JWT_SECRET`; the BE does **not** issue tokens — login happens
  client-side against Supabase, then the access token is sent as Bearer.
- Multi-tenancy: `X-Tenant-ID` header (or `?tenant=`). For a Supabase principal
  the BE derives clinic scope from `app_metadata.clinic_id`; admin tokens may
  pass a clinic via the header.
- Success envelope: `{ data, meta }` where `meta` = `{ tenant, timestamp,
  requestId, pagination? }`; `pagination` = `{ total, page, limit }`.
- Error envelope: `{ error: { code, message, details? }, meta }`.
- CORS allows `http://localhost:3000` and `http://localhost:8080`,
  `credentials: true`.

## Components (all new, in `cmr-fe`)

### 1. Supabase clients (`@supabase/ssr`)
- `lib/supabase/client.ts` — `createBrowserClient()` for client components.
- `lib/supabase/server.ts` — `createServerClient()` wired to Next 16 `cookies()`
  for server components / route handlers.
- `middleware.ts` (project root) — refreshes the Supabase session cookie on each
  request. **Non-gating:** refreshes tokens only; no redirects / route
  protection (that belongs to the later auth work).

### 2. Typed API client to `cmr-be` (`lib/api/`)
- `client.ts` — `apiFetch<T>(path, opts)`:
  - Prefixes `NEXT_PUBLIC_API_BASE_URL` + `/api/v1`.
  - Reads the access token from `supabase.auth.getSession()` (browser); sets
    `Authorization: Bearer <token>` when a session exists, sends none when
    logged out.
  - Reads `clinic_id` from the user's `app_metadata`; sets `X-Tenant-ID` when
    present.
  - On 2xx: unwraps `{ data, meta }` → returns `data`.
  - On non-2xx: throws a typed `ApiError` built from `{ error: {...} }`.
- `types.ts` — `ApiEnvelope<T>`, `ApiErrorShape`, `ApiError` class,
  `Paginated<T>` (mirrors `meta.pagination`).
- `health.ts` — concrete example: `getHealth()` → `GET /api/health`. Proves the
  wiring end-to-end against the only public endpoint (`api-keys` is admin-only,
  so it isn't a usable smoke test pre-auth).

### 3. Config
- `lib/env.ts` — validated accessor for public env vars; throws early if a
  required var is missing (mirrors the BE's fail-fast Joi philosophy).
- `.env.example` + `.env.local` — `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL`
  (default `http://localhost:3000`). Supabase values are placeholders to fill in.
- `package.json` — add `@supabase/ssr` + `@supabase/supabase-js`; set dev script
  to `next dev -p 8080` to avoid colliding with the BE on `:3000` (and `:8080`
  is already in the BE CORS allowlist).

## Data flow

Browser component → `apiFetch()` → read Supabase session (token + `clinic_id`)
→ `fetch http://localhost:3000/api/v1/...` with `Authorization` + `X-Tenant-ID`
→ BE `TenantMiddleware` / `AuthGuard` → `{ data, meta }` → client returns `data`
(or throws `ApiError`).

## Error handling

- `ApiError(code, message, status, details?)` thrown on non-2xx; callers catch.
- Missing required env → thrown at module load (fail fast).
- No session → request sent without bearer; BE returns 401, surfaced as
  `ApiError` with code `UNAUTHORIZED`.

## Out of scope / not touched

No login/signup pages, no protected routes, no `cmr-be` changes, no new BE
endpoints. During implementation, consult `node_modules/next/dist/docs/` for
Next 16 specifics (the FE `AGENTS.md` warns conventions differ from older Next).
