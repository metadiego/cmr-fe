"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useMe, isAdmin } from "@/hooks/use-me";

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
  const t = useTranslations("common");

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

  if (state.kind === "loading" || target) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return <>{children}</>;
}
