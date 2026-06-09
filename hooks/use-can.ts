"use client";

import { useMe } from "@/hooks/use-me";

// Cosmetic permission check (#6, RBAC fino F1). Reads the real `permissions` the
// BE resolves into /auth/me (master → ['*']). Use ONLY to show/hide/disable UI;
// the BE enforces the real authorization (@Permissions). Never trust the FE.
//
// const { can } = useCan(); ... {can('clientes.update') && <EditButton/>}
export function useCan() {
  const state = useMe();
  const permissions = state.kind === "ok" ? state.me.permissions : [];

  function can(permiso: string): boolean {
    return permissions.includes("*") || permissions.includes(permiso);
  }

  return { can, ready: state.kind === "ok" };
}
