# Auth — Login / sesión / route protection — Plan

**Date:** 2026-06-03 · derived from `docs/specs/2026-06-03-auth-login-design.md`

Grounded in current code: `lib/supabase/{client,server}.ts`, `lib/api/client.ts` (`apiFetch`,
browser-session auth headers), `proxy.ts` (session refresh, non-gating), `components/ui/{button,input}.tsx`,
`app/page.tsx` ("Iniciar sesión" button, no link), `components/site-header.tsx`.

## Steps
1. **`lib/api/auth.ts`** — `interface Me {...}` + `getMe(): Promise<Me>` = `apiFetch<Me>("/auth/me")`.
2. **`app/login/actions.ts`** — `"use server"`; `login(prev, formData)`: server client
   `signInWithPassword({email,password})`; on error return `{ error }`; else `redirect("/dashboard")`.
3. **`app/login/page.tsx`** — Client Component; `useActionState(login)`; Shadcn `Input` + `Button`
   + plain styled `<label>`; shows the action error; pending state via `useActionState`.
4. **`proxy.ts`** — after `getUser()`, if no user and `pathname` starts with a protected prefix
   (`/dashboard`), return `NextResponse.redirect(new URL("/login", request.url))`; keep refresh.
5. **`app/(app)/layout.tsx`** — Server Component guard: server client `getUser()`; if none
   `redirect("/login")`; render `{children}`.
6. **`app/(app)/dashboard/page.tsx`** — Client Component: `getMe()` on mount (loading/ok/fail like
   `api-health-check.tsx`); render context card; **Logout** button (browser `signOut` →
   `router.replace("/login")`).
7. **Wire entry points** — `app/page.tsx`: make "Iniciar sesión" a `<Button asChild><Link href="/login">`.
   `site-header.tsx`: same for its two buttons. (Full session-aware header deferred.)
8. **Green gates** — `npm run typecheck && npm run lint && npm run build`; dev `:8080`.

## Verification
`http://localhost:8080/login` → master `atencion@…/cmr.2025!` → `/dashboard` shows `isMaster:true,
accessMode:"admin"` (from the BE) → Logout → `/login`. Visiting `/dashboard` logged-out → `/login`.

## Notes (Next 16)
`cookies()` async; middleware = `proxy.ts`; `redirect()` from `next/navigation` in the Server Action
(call outside try/catch). Server Components can't use the browser api client → `/auth/me` is fetched
client-side. Bitácora en ambos `.personal/`.
