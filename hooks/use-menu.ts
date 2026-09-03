"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { getAllMenu, getMyMenu, type MenuItem } from "@/lib/api/menu";
import { filterMenuByPermissions } from "@/lib/nav/menu-access";
import { useMe } from "@/hooks/use-me";

// Menú de navegación del principal. Desde la decisión «los accesos los decide el frontend»
// (docs/specs/accesos-los-decide-el-frontend.md) la FUENTE es el catálogo COMPLETO (GET /menu)
// y el FE lo filtra por `permissions` (lib/nav/menu-access). Antes se leía `GET /me/menu` (ya
// filtrado por el BE); ese endpoint sigue vivo como comodidad y aquí es el RESPALDO si /menu
// falla (dan el mismo resultado). Devuelve [] mientras carga o sin sesión.
//
// Se refetchea al cambiar de ruta: el shell vive por encima de la página y NO se remonta al
// loguearse (login es server action; no dispara onAuthStateChange en el cliente) — sin esto el
// fetch de antes del login (catálogo vacío) se quedaría pegado hasta un F5 (FE-HANDOFF-NAV-NO-CARGA).
export function useMenu(): MenuItem[] {
  const pathname = usePathname();
  const me = useMe();
  const [catalog, setCatalog] = React.useState<MenuItem[]>([]);

  React.useEffect(() => {
    let active = true;
    getAllMenu()
      .then((list) => active && setCatalog(list))
      // /menu no disponible (permiso/transitorio): caemos a /me/menu (ya filtrado; el filtro por
      // permisos de abajo es idempotente sobre él). NO vaciar ante un error transitorio al navegar.
      .catch(() => {
        getMyMenu()
          .then((list) => active && setCatalog(list))
          .catch(() => {});
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  return React.useMemo(() => {
    const permissions = me.kind === "ok" ? me.me.permissions : [];
    return filterMenuByPermissions(catalog, permissions);
  }, [catalog, me]);
}
