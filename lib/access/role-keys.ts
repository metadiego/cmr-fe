// Role keys: cmr-be PR #557 (access-control cleanup) renames them to English and merges a few.
// After that release the API RETURNS the new key (`roles` of /auth/me, `slug` of /roles and /profiles);
// it keeps ACCEPTING the old one forever. Every role-key comparison goes through `roleKey`, so the
// screens behave the same before and after the backend release.
// Source: cmr-be docs/specs/access-control-cleanup-handoff-fe.md §3.

export const LEGACY_ROLE_KEYS: Readonly<Record<string, string>> = {
  gerente: "manager",
  atencion: "frontdesk",
  recepcion: "frontdesk",
  citas: "appointments",
  cc_operator: "appointments",
  facturacion: "billing",
  facturador_consulta: "billing",
  enfermeria: "nursing",
  inventarios: "inventory",
  solo_lectura: "read_only",
};

export const ADMIN_ROLE = "admin";

/** The current key of a role, whichever spelling the API sent. */
export function roleKey(key: string): string {
  return LEGACY_ROLE_KEYS[key] ?? key;
}

/** Whether `roles` holds `wanted` (old or new key on either side). */
export function hasRole(roles: readonly string[] | null | undefined, wanted: string): boolean {
  const target = roleKey(wanted);
  return (roles ?? []).some((r) => roleKey(r) === target);
}

/** The admin role grants full access ('*'); the backend refuses to edit or delete it. */
export function isAdminRole(role: { slug: string } | null | undefined): boolean {
  return !!role && roleKey(role.slug) === ADMIN_ROLE;
}

/** Full access, a permission only the admin role holds: never offered in a permission picker. */
export const FULL_ACCESS_PERMISSION = "*";

export function isAssignablePermission(slug: string): boolean {
  return slug !== FULL_ACCESS_PERMISSION;
}

interface MeLike {
  isAdmin?: boolean;
  isMaster?: boolean;
  accessMode?: string;
  roles?: readonly string[] | null;
}

/**
 * Full access (admin). After cmr-be #557, `/auth/me` returns `isAdmin`, the only signal (and
 * `isMaster` mirrors it). Before it, an admin is a master, an "admin" access mode, or a holder of
 * the admin role. Cosmetic only: the backend decides.
 */
export function isAdmin(me: MeLike | null | undefined): boolean {
  if (!me) return false;
  if (typeof me.isAdmin === "boolean") return me.isAdmin;
  return me.isMaster === true || me.accessMode === "admin" || hasRole(me.roles, ADMIN_ROLE);
}
