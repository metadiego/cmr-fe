"use client";

import { useMe } from "@/hooks/use-me";
import { normalizarPermiso } from "@/lib/rbac/normalizar-permiso";

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

  function can(permiso: string): boolean {
    if (permissions.includes("*")) return true;
    const objetivo = normalizarPermiso(permiso);
    return permissions.some((p) => normalizarPermiso(p) === objetivo);
  }

  return { can, ready: state.kind === "ok" };
}
