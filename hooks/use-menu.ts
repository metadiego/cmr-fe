"use client";

import * as React from "react";

import { type MenuItem } from "@/lib/api/menu";
import { filterMenuByPermissions } from "@/lib/nav/menu-access";
import { useMe } from "@/hooks/use-me";
import { useMenuContext, useMenuFetch } from "@/components/menu-provider";

// Menú de navegación del principal. La decisión «los accesos los decide el frontend»
// (docs/specs/accesos-los-decide-el-frontend.md) sigue valiendo — el FE filtra por `permissions`
// (lib/nav/menu-access), nunca a mano — pero la FUENTE pasó a ser `GET /me/menu` (ya filtrado por
// el BE), no el catálogo completo `GET /menu`: ese endpoint pasó a exigir el permiso `menu.read`
// (BE MenuController) después de escrita aquella decisión, y casi nadie lo tiene — pedirlo en cada
// navegación producía un 403 por persona por página (~680/día, handoff-ruido-403-auditoria.md).
// `filterMenuByPermissions` sobre un menú YA filtrado por el BE es idempotente (vuelve a filtrar lo
// mismo), así que este cambio no altera qué ve nadie. Devuelve [] mientras carga o sin sesión.
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
