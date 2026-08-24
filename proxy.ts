import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Next 16 renamed `middleware` to `proxy`. Refreshes the Supabase session cookie
// AND gates access: every route is auth-by-default except the public allowlist —
// the nav menu stays visible but its destinations aren't reachable without a session.
// /auth/set-password is public: the invited user arrives via a magic link and
// the session is established client-side (URL hash / PKCE code), so there's no
// server cookie yet — gating it would bounce them to /login before they can set
// their password.
const PUBLIC_PATHS = new Set(["/", "/login", "/auth/set-password"]);

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);

  // Auth-by-default: no session + non-public route → /login.
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Already signed in and landing on /login → a SU trabajo (/inicio resuelve GET /me/inicio), no a «Tu
  // sesión». Handoff al-entrar-cada-uno-a-su-trabajo.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on all paths except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
