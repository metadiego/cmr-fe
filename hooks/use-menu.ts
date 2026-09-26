"use client";

import * as React from "react";

import { type MenuItem } from "@/lib/api/menu";
import { filterMenuByPermissions } from "@/lib/nav/menu-access";
import { useMe } from "@/hooks/use-me";
import { useMenuContext, useMenuFetch } from "@/components/menu-provider";

// Menú de navegación del principal. Desde la decisión «los accesos los decide el frontend»
// (docs/specs/accesos-los-decide-el-frontend.md) la FUENTE es el catálogo COMPLETO (GET /menu)
// y el FE lo filtra por `permissions` (lib/nav/menu-access). Antes se leía `GET /me/menu` (ya
// filtrado por el BE); ese endpoint sigue vivo como comodidad y aquí es el RESPALDO si /menu
// falla (dan el mismo resultado). Devuelve [] mientras carga o sin sesión.
//
// Prefiere el MenuProvider compartido (un solo fetch); si no hay provider montado, cae a su
// propio fetch, igual que useMe()/MeProvider — mismo patrón, mismo motivo (components/menu-provider.tsx).
export function useMenu(): MenuItem[] {
  const shared = useMenuContext();
  const local = useMenuFetch(shared === null);
  const catalog = shared ?? local;
  const me = useMe();

  return React.useMemo(() => {
    const permissions = me.kind === "ok" ? me.me.permissions : [];
    return filterMenuByPermissions(catalog, permissions);
  }, [catalog, me]);
}
