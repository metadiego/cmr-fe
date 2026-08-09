"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { getMyMenu, type MenuItem } from "@/lib/api/menu";

// Client hook for the principal's effective nav menu (GET /me/menu). Returns []
// while loading or when unauthenticated (the menu only exists for a session).
// Refetches on every pathname change: SiteHeader vive en el layout raíz y NO se
// remonta al loguearse (login es un server action; no dispara onAuthStateChange en
// el cliente) — sin esto, el fetch de antes del login (menú vacío/mínimo) se queda
// pegado hasta un F5 manual (FE-HANDOFF-NAV-NO-CARGA-TRAS-LOGIN).
export function useMenu(): MenuItem[] {
  const pathname = usePathname();
  const [items, setItems] = React.useState<MenuItem[]>([]);

  React.useEffect(() => {
    let active = true;
    getMyMenu()
      .then((list) => active && setItems(list))
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, [pathname]);

  return items;
}
