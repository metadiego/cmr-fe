"use client";

import * as React from "react";

import { getMyMenu, type MenuItem } from "@/lib/api/menu";

// Client hook for the principal's effective nav menu (GET /me/menu). Returns []
// while loading or when unauthenticated (the menu only exists for a session).
export function useMenu(): MenuItem[] {
  const [items, setItems] = React.useState<MenuItem[]>([]);

  React.useEffect(() => {
    let active = true;
    getMyMenu()
      .then((list) => active && setItems(list))
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, []);

  return items;
}
