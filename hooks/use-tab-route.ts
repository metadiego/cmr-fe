"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { legacyTab, matchTab, tabHref, type TabRoute } from "@/lib/nav/tab-routes";

/**
 * The active tab of a tabbed screen, read from the URL path (see lib/nav/tab-routes.ts), and a
 * setter that navigates to the tab's path. `replace`, not `push`: switching tabs does not pile up
 * history entries, so Back leaves the screen as it did when tabs were local state.
 * An old `?tab=` link (e.g. `?tab=caja`) is rewritten in place to its tab's path.
 */
export function useTabRoute<T extends string>(route: TabRoute<T>): [T, (tab: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const match = matchTab(route, pathname);
  const base = match?.base ?? pathname;
  const legacy = legacyTab(route, params.get("tab"));
  const tab = legacy ?? match?.tab ?? route.tabs[0];

  const hasTabParam = params.has("tab");
  React.useEffect(() => {
    if (hasTabParam) router.replace(tabHref(route, base, tab, params), { scroll: false });
  }, [hasTabParam, route, base, tab, params, router]);

  const select = React.useCallback(
    (next: string) => {
      const target = (route.tabs as readonly string[]).includes(next) ? (next as T) : route.tabs[0];
      router.replace(tabHref(route, base, target, params), { scroll: false });
    },
    [route, base, params, router],
  );
  return [tab, select];
}
