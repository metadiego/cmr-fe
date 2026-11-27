"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import type { Centro } from "@/lib/api/centers";
import { menuItemForPath, needsOtherCenter } from "@/lib/nav/screen-access";
import { getActiveCentro, setActiveCentro, setClinicViewAll } from "@/lib/tenant";
import { urlAfterCenterSwitch } from "@/lib/navigation/after-center-switch";
import { useMenu } from "@/hooks/use-menu";
import { useMe } from "@/hooks/use-me";
import { centersWhere } from "@/hooks/use-can-in-center";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

// The menu is the same in every center (every screen usable in at least one of the person's
// centers), so a screen can open while the ACTIVE center does not allow it. One place for every
// screen: instead of a page that fails, name the centers where it is allowed and offer to switch
// (cmr-fe docs/specs/positions-and-centers.md §3). Everything else renders as is.
export function CenterAccessGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations("centerAccess");
  const tRoot = useTranslations();
  const pathname = usePathname();
  const menu = useMenu();
  const me = useMe();
  const screen = menuItemForPath(menu, pathname);
  const permissions = me.kind === "ok" ? me.me.permissions : null;
  const blocked = permissions !== null && needsOtherCenter(screen, permissions);
  const permission = blocked ? (screen?.permissionSlug ?? null) : null;

  const [elsewhere, setElsewhere] = React.useState<{ permission: string; centers: Centro[] } | null>(null);
  React.useEffect(() => {
    if (!permission) return;
    let alive = true;
    void centersWhere(permission).then((centers) => {
      if (alive) setElsewhere({ permission, centers: centers ?? [] });
    });
    return () => {
      alive = false;
    };
  }, [permission]);

  // Never offer the center the session is already in (FE and BE aliases could disagree).
  const active = getActiveCentro() ?? (me.kind === "ok" ? me.me.activeClinicId : null);
  const centers =
    elsewhere && elsewhere.permission === permission
      ? elsewhere.centers.filter((c) => c.id !== active)
      : null;
  // Until the session is known, do not start a page whose calls might fail here.
  if (me.kind === "loading") return null;
  // Not blocked, or allowed nowhere (the page answers for itself, as before).
  if (!blocked || !screen || (centers && centers.length === 0)) return <>{children}</>;
  // Blocked here and still asking where it is allowed: do not start a page whose calls would fail.
  if (!centers) return null;

  const name = screen.customLabel || (tRoot.has(screen.labelKey) ? tRoot(screen.labelKey) : screen.slug);
  const switchTo = (id: string) => {
    setClinicViewAll(false);
    setActiveCentro(id);
    // Same as the top-bar picker: a record of the previous center goes back to its list.
    const { pathname: path, search } = window.location;
    const next = urlAfterCenterSwitch(path, search, id);
    if (next === path + search) window.location.reload();
    else window.location.assign(next);
  };
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <EmptyState
        title={t("title", { screen: name, centers: centers.map((c) => c.name).join(", ") })}
        description={t("description", { screen: name })}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {centers.map((c) => (
              <Button key={c.id} size="sm" onClick={() => switchTo(c.id)}>
                {t("switchTo", { center: c.name })}
              </Button>
            ))}
          </div>
        }
      />
    </div>
  );
}
