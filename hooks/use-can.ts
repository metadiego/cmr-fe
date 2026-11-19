"use client";

import { useMe } from "@/hooks/use-me";
import { holdsPermission } from "@/lib/rbac/permission-aliases";

// Cosmetic permission check (#6, RBAC fino F1). Reads the real `permissions` the
// BE resolves into /auth/me (master → ['*']). Use ONLY to show/hide/disable UI;
// the BE enforces the real authorization (@Permissions). Never trust the FE.
//
// const { can } = useCan(); ... {can('clientes.update') && <EditButton/>}
//
// Matched normalized (casing/separators stripped), not with `===`: a permission key
// typo'd as camelCase on one side and snake_case on the other (real incident, see
// docs/specs/alertas-de-prioridad-del-paciente-handoff-be.md) used to silently fail
// `can()` for every non-master account. Normalizing turns that class of bug into a
// harmless false positive instead of a silent false negative nobody notices until a
// real user reports it.
export function useCan() {
  const state = useMe();
  const permissions = state.kind === "ok" ? state.me.permissions : [];

  // Also by a key's other names (old Spanish ↔ English, merged keys): lib/rbac/permission-aliases.ts.
  function can(permiso: string): boolean {
    return holdsPermission(permissions, permiso);
  }

  return { can, ready: state.kind === "ok" };
}
