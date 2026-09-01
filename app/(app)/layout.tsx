import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SessionGate } from "@/components/session-gate";

// Server-side guard for the authenticated area. No session → /login.
// Defense in depth alongside the redirect in proxy.ts. SessionGate then enforces
// the profile lifecycle (mustChangePassword / estado) from /auth/me client-side.
// MeProvider ya NO vive aquí: se subió a AppShell (components/app-shell.tsx) para que el rail y el header
// (que renderizan por ENCIMA de esta capa) compartan la misma sesión /auth/me que la página. Tenerlo aquí
// dejaba al shell fuera del provider → fetches locales duplicados y nav vacío intermitente.
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <SessionGate>{children}</SessionGate>;
}
