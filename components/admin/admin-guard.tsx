"use client";

import { useTranslations } from "next-intl";

import { useMe, isAdmin } from "@/hooks/use-me";

// Cosmetic role gate for the admin area. Real authorization is enforced by the
// BE (@Roles('admin')); this only avoids rendering the panel to non-admins
// (CONSIDERACIONES-FE #6). Session is already guaranteed by app/(app)/layout.tsx.
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const state = useMe();
  const t = useTranslations("admin");

  if (state.kind === "loading") {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (state.kind === "fail" || !isAdmin(state.me)) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("noAccess")}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
