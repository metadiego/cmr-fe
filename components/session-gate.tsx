"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { useMe, isAdmin } from "@/hooks/use-me";
import { RouteSkeleton } from "@/components/route-skeleton";

const PENDING_PATH = "/pending";
const CHANGE_PASSWORD_PATH = "/change-password";

// Client gate for the authenticated area. The (app) server layout already
// guarantees a session; this enforces the profile lifecycle from /auth/me:
//  1. mustChangePassword → /change-password (force the temp-password change).
//  2. estado != aprobado (non-admin) → /pending.
// The BE enforces the real rules (403); this only routes the UX. It never
// blocks /pending or /change-password themselves (avoids redirect loops), and
// renders children on a fetch failure (the BE still protects).
export function SessionGate({ children }: { children: React.ReactNode }) {
  const state = useMe();
  const pathname = usePathname();
  const router = useRouter();

  const target = React.useMemo(() => {
    if (state.kind !== "ok") return null;
    const me = state.me;
    if (me.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
      return CHANGE_PASSWORD_PATH;
    }
    if (
      !me.mustChangePassword &&
      me.status !== "aprobado" &&
      !isAdmin(me) &&
      pathname !== PENDING_PATH
    ) {
      return PENDING_PATH;
    }
    return null;
  }, [state, pathname]);

  React.useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  // The skeleton of the page being opened, not a bare "Loading…": the page's own loading state then
  // takes over in the same shape.
  if (state.kind === "loading" || target) {
    return <RouteSkeleton pathname={target ?? pathname} />;
  }

  return <>{children}</>;
}
