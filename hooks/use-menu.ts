"use client";

import * as React from "react";

import { type MenuItem } from "@/lib/api/menu";
import { useMenuContext, useMenuFetch } from "@/components/menu-provider";

// The principal's navigation menu: `GET /me/menu`, already decided by the BE as every screen the
// person can use in AT LEAST ONE of their centers (cmr-be positions spec §2.5). It is NOT filtered
// again by the active center's permissions here: that would make the menu change with the center.
// A screen the active center does not allow is handled by CenterAccessGate, which names the centers
// where it is allowed. Hidden items still drop. Returns [] while loading or without a session.
//
// Prefers the shared MenuProvider (one fetch); without one mounted, it fetches on its own, like
// useMe()/MeProvider (components/menu-provider.tsx).
export function useMenu(): MenuItem[] {
  const shared = useMenuContext();
  const local = useMenuFetch(shared === null);
  const catalog = shared ?? local;
  return React.useMemo(() => catalog.filter((i) => i.visible !== false), [catalog]);
}
