# Wire cmr-fe to cmr-be Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the FE plumbing (Supabase session clients, env config, and a typed API client) so `cmr-fe` can make auth-bearing, tenant-scoped calls to `cmr-be` — without implementing any auth flow.

**Architecture:** `@supabase/ssr` provides browser + server session clients and a `proxy.ts` (Next 16's renamed middleware) that refreshes the session cookie non-gatingly. A thin `fetch` wrapper in `lib/api/` reads the Supabase access token + `clinic_id` from the session, attaches `Authorization` + `X-Tenant-ID`, calls `cmr-be`, and unwraps its `{ data, meta }` envelope (throwing a typed `ApiError` on failure).

**Tech Stack:** Next.js 16 (App Router), `@supabase/ssr`, `@supabase/supabase-js`, TypeScript, native `fetch`.

---

## Context for the implementer (read first)

- **Backend contract** (do not change the BE):
  - Base URL from `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3000`).
  - Versioned feature endpoints: `/api/v1/...`. Health is **public + unversioned**: `/api/health`.
  - Auth: `Authorization: Bearer <supabase access token>`. BE only *verifies* tokens.
  - Tenant: `X-Tenant-ID` header, derived from the user's `app_metadata.clinic_id`.
  - Success envelope: `{ data, meta }`. Error envelope: `{ error: { code, message, details? }, meta }`.
- **Next 16 gotchas** (the FE `AGENTS.md` warns conventions differ from older Next):
  - `middleware.ts` is **renamed to `proxy.ts`** (root level), exporting a function named `proxy`.
  - `cookies()` from `next/headers` is **async** — must be `await`ed.
  - Only **literal** `process.env.NEXT_PUBLIC_FOO` access is statically inlined into client bundles. Dynamic `process.env[name]` is NOT replaced and reads `undefined` in the browser — so `lib/env.ts` must reference each var literally.
- **No test runner exists** in this template (no jest/vitest, no `test` script). This task is thin wiring whose only meaningful test is integration against a live BE; per YAGNI we do **not** add a unit-test framework. Verification per task is `npm run typecheck` + `npm run lint`; the final task is an end-to-end smoke test against a running BE. This is a deliberate, documented choice.
- Run all commands from the `cmr-fe/` directory.

## File Structure

- Create `lib/env.ts` — validated public-env accessor (fail-fast).
- Create `lib/supabase/client.ts` — browser Supabase client.
- Create `lib/supabase/server.ts` — server Supabase client (async, cookie-bound).
- Create `proxy.ts` (project root) — non-gating session refresh.
- Create `lib/api/types.ts` — envelope/error types + `ApiError` class.
- Create `lib/api/client.ts` — `apiRequest` (absolute) + `apiFetch` (v1-prefixed).
- Create `lib/api/health.ts` — `getHealth()` example call.
- Create `.env.example` and `.env.local` — public env vars.
- Modify `package.json` — add deps; set dev port to 8080.

---

### Task 1: Dependencies, env config, and dev port

**Files:**
- Modify: `package.json`
- Create: `lib/env.ts`
- Create: `.env.example`
- Create: `.env.local`

- [ ] **Step 1: Install Supabase packages**

Run:
```bash
npm install @supabase/ssr @supabase/supabase-js
```
Expected: both added to `package.json` `dependencies`; `npm install` exits 0.

- [ ] **Step 2: Change the dev script to port 8080**

In `package.json`, change the `dev` script so it does not collide with the BE on `:3000` (`:8080` is already in the BE CORS allowlist):
```json
    "dev": "next dev -p 8080",
```

- [ ] **Step 3: Create `.env.example`**

```bash
# Public env (exposed to the browser — NEXT_PUBLIC_*). Copy to .env.local and fill in.
# Supabase project (used by @supabase/ssr clients)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# cmr-be base URL (no trailing slash). Endpoints live under /api/v1.
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

- [ ] **Step 4: Create `.env.local`** (placeholders so `build`/`typecheck` can run; fill with real Supabase values to actually authenticate)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

- [ ] **Step 5: Confirm `.env*.local` is gitignored**

Run:
```bash
git check-ignore .env.local
```
Expected: prints `.env.local`. If it prints nothing, append `.env*.local` to `.gitignore`.

- [ ] **Step 6: Create `lib/env.ts`** (literal env access so client bundles inline the values)

```ts
// Validated accessor for public env vars. Throws at import time if a required
// var is missing (mirrors the BE's fail-fast config). NEXT_PUBLIC_* vars must be
// referenced literally here — dynamic process.env[name] is not inlined client-side.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

if (!SUPABASE_URL) {
  throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_URL");
}
if (!SUPABASE_ANON_KEY) {
  throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const env = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  API_BASE_URL,
} as const;
```

- [ ] **Step 7: Verify**

Run:
```bash
npm run typecheck
```
Expected: PASS (exit 0). (`lib/env.ts` has no unresolved imports.)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .env.example lib/env.ts .gitignore
git commit -m "chore: add supabase deps, public env config, dev port 8080"
```
(Note: `.env.local` is intentionally NOT committed.)

---

### Task 2: Supabase browser + server clients

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

- [ ] **Step 1: Create the browser client `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Browser-side Supabase client for use in Client Components.
export function createClient() {
  return createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}
```

- [ ] **Step 2: Create the server client `lib/supabase/server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

// Server-side Supabase client for Server Components / Route Handlers.
// cookies() is async in Next 16.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll called from a Server Component: ignored — proxy.ts refreshes the session.
        }
      },
    },
  });
}
```

- [ ] **Step 3: Verify**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: PASS (exit 0).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts
git commit -m "feat: add supabase browser and server clients"
```

---

### Task 3: Non-gating session refresh proxy

**Files:**
- Create: `proxy.ts` (project root — same level as `app/`)

- [ ] **Step 1: Create `proxy.ts`** (refreshes the session cookie; performs NO redirects/gating)

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Next 16 renamed `middleware` to `proxy`. This refreshes the Supabase session
// cookie on each request. It is intentionally NON-GATING: no redirects, no route
// protection (that belongs to the future auth work).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the session so @supabase/ssr refreshes it when needed.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Run on all paths except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Verify**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: PASS (exit 0).

- [ ] **Step 3: Commit**

```bash
git add proxy.ts
git commit -m "feat: add non-gating supabase session-refresh proxy"
```

---

### Task 4: API envelope types and ApiError

**Files:**
- Create: `lib/api/types.ts`

- [ ] **Step 1: Create `lib/api/types.ts`**

```ts
// Mirrors cmr-be's response/error envelopes (see CLAUDE.md request pipeline).

export interface ApiMeta {
  tenant?: string;
  timestamp: string;
  requestId: string;
  pagination?: { total: number; page: number; limit: number };
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

// For endpoints the BE returns paginated (meta.pagination present).
export interface Paginated<T> {
  items: T[];
  pagination: { total: number; page: number; limit: number };
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorShape {
  error: { code: string; message: string; details?: ApiErrorDetail[] };
  meta: ApiMeta;
}

// Thrown by the API client on any non-2xx response.
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}
```

- [ ] **Step 2: Verify**

Run:
```bash
npm run typecheck
```
Expected: PASS (exit 0).

- [ ] **Step 3: Commit**

```bash
git add lib/api/types.ts
git commit -m "feat: add cmr-be api envelope types and ApiError"
```

---

### Task 5: The API client (`apiRequest` + `apiFetch`)

**Files:**
- Create: `lib/api/client.ts`

- [ ] **Step 1: Create `lib/api/client.ts`**

```ts
import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import { ApiError, type ApiEnvelope, type ApiErrorShape } from "./types";

// Reads the current Supabase session (browser) and builds auth + tenant headers.
// No session → no headers (the BE will respond 401, surfaced as an ApiError).
async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
    const clinicId = session.user.app_metadata?.clinic_id;
    if (clinicId) {
      headers["X-Tenant-ID"] = String(clinicId);
    }
  }
  return headers;
}

// Core request: takes an absolute path on the BE (e.g. "/api/health"),
// attaches auth/tenant headers, and unwraps the { data, meta } envelope.
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const auth = await authHeaders();

  const res = await fetch(`${env.API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...auth,
      ...init.headers,
    },
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (body as ApiErrorShape | null)?.error;
    throw new ApiError(
      err?.code ?? "INTERNAL_ERROR",
      err?.message ?? res.statusText,
      res.status,
      err?.details,
    );
  }

  return (body as ApiEnvelope<T>).data;
}

// Convenience for versioned feature endpoints: apiFetch("/api-keys") → /api/v1/api-keys.
export function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiRequest<T>(`/api/v1${path}`, init);
}
```

- [ ] **Step 2: Verify**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: PASS (exit 0).

- [ ] **Step 3: Commit**

```bash
git add lib/api/client.ts
git commit -m "feat: add cmr-be api client (auth + tenant headers, envelope unwrap)"
```

---

### Task 6: Health example + end-to-end smoke test

**Files:**
- Create: `lib/api/health.ts`
- Create (temporary, removed in Step 6): `app/__smoke/health/page.tsx`

- [ ] **Step 1: Create `lib/api/health.ts`** (health is public + unversioned → use `apiRequest`, not `apiFetch`)

```ts
import { apiRequest } from "./client";

// Shape of @nestjs/terminus health output (wrapped in the { data } envelope by the BE).
export interface HealthStatus {
  status: "ok" | "error" | "shutting_down";
  info?: Record<string, { status: string; [key: string]: unknown }>;
  error?: Record<string, { status: string; [key: string]: unknown }>;
  details: Record<string, { status: string; [key: string]: unknown }>;
}

// Smoke-test call proving FE → BE wiring end-to-end against the only public endpoint.
export function getHealth(): Promise<HealthStatus> {
  return apiRequest<HealthStatus>("/api/health");
}
```

- [ ] **Step 2: Create a temporary smoke page `app/__smoke/health/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { getHealth, type HealthStatus } from "@/lib/api/health";

export default function SmokeHealthPage() {
  const [state, setState] = useState<string>("loading…");

  useEffect(() => {
    getHealth()
      .then((h: HealthStatus) => setState(`OK: ${JSON.stringify(h)}`))
      .catch((e) => setState(`ERROR: ${String(e)}`));
  }, []);

  return <pre data-testid="health">{state}</pre>;
}
```

- [ ] **Step 3: Verify it builds and typechecks**

Run:
```bash
npm run typecheck && npm run lint && npm run build
```
Expected: PASS (exit 0). `build` confirms `proxy.ts`/env wiring compiles with `.env.local` present.

- [ ] **Step 4: Run the end-to-end smoke test**

In one terminal, start the BE (needs its own `.env` with a reachable DB):
```bash
cd ../cmr-be && npm run start:dev
```
In another, start the FE:
```bash
npm run dev   # serves on http://localhost:8080
```
Then verify the BE is reachable and returns the envelope directly:
```bash
curl -s http://localhost:3000/api/health
```
Expected: JSON of the form `{"data":{"status":"ok",...},"meta":{...}}`.

Finally, open `http://localhost:8080/__smoke/health` in a browser.
Expected: the page renders `OK: {"status":"ok",...}` (no Supabase login required — `/api/health` is public, so the client sends no bearer and the call still succeeds). If the BE is down you'll see `ERROR: ApiError ...` — that also confirms the client + error path work.

- [ ] **Step 5: Remove the temporary smoke page**

```bash
rm -rf app/__smoke
```

- [ ] **Step 6: Verify clean state and commit**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: PASS (exit 0).

```bash
git add lib/api/health.ts
git commit -m "feat: add getHealth example call wiring FE to cmr-be"
```

---

## Done criteria

- `@supabase/ssr` browser + server clients exist and typecheck.
- `proxy.ts` refreshes sessions without gating routes.
- `apiFetch`/`apiRequest` attach `Authorization` + `X-Tenant-ID` (when a session exists) and unwrap `{ data, meta }`, throwing `ApiError` on failure.
- `getHealth()` returns the BE health payload end-to-end.
- `.env.example` documents required vars; FE dev runs on `:8080`.
- No auth UI, no route protection, no BE changes were introduced.
