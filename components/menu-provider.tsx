"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { getAllMenu, getMyMenu, type MenuItem } from "@/lib/api/menu";

// Shared /menu catalog so the whole app fetches it ONCE per navigation. Without this, every
// useMenu() mount (sidebar, user menu, header, /configuration — 3-4 independent call sites) fires
// its own GET /menu, tripling/quadrupling that request on every page load. Found live (2026-09-26)
// contributing to a BE rate-limit trip (429 ThrottlerException) on an unrelated endpoint,
// GET /patients/:id — same per-user throttle bucket. Same fix already applied to /auth/me via
// MeProvider (components/me-provider.tsx); this mirrors it for /menu.
const MenuContext = React.createContext<MenuItem[] | null>(null);

// Runs the single /menu fetch. `enabled` lets useMenu() call it under the rules of hooks while
// skipping the request when a provider is already in the tree.
export function useMenuFetch(enabled: boolean): MenuItem[] {
  const [catalog, setCatalog] = React.useState<MenuItem[]>([]);
  // Refetch al navegar: mismo motivo que MeProvider — el shell no se remonta al loguearse, así que
  // sin esto el catálogo (vacío, de antes del login) se quedaría pegado hasta un F5 manual.
  const pathname = usePathname();

  React.useEffect(() => {
    if (!enabled) return;
    let active = true;
    getAllMenu()
      .then((list) => active && setCatalog(list))
      // /menu no disponible (permiso/transitorio): caemos a /me/menu (ya filtrado; idempotente si
      // useMenu() lo vuelve a filtrar). NO vaciar ante un error transitorio al navegar.
      .catch(() => {
        getMyMenu()
          .then((list) => active && setCatalog(list))
          .catch(() => {});
      });
    return () => {
      active = false;
    };
  }, [enabled, pathname]);

  return catalog;
}

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const catalog = useMenuFetch(true);
  return <MenuContext.Provider value={catalog}>{children}</MenuContext.Provider>;
}

// Returns the shared catalog when a MenuProvider is mounted, or null otherwise.
export function useMenuContext(): MenuItem[] | null {
  return React.useContext(MenuContext);
}
