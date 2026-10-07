// Normalizes a permission key (casing + separators stripped) so that a camelCase vs
// snake_case typo on either side of a comparison still matches, instead of silently
// failing `can()` for every non-master account — the exact incident documented in
// docs/specs/alertas-de-prioridad-del-paciente-handoff-be.md.
export function normalizarPermiso(permiso: string): string {
  return permiso.toLowerCase().replace(/[^a-z0-9.]/g, "");
}
