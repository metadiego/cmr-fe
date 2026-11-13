import type { Me } from "@/lib/api/auth";

/**
 * ¿Este usuario puede ver VARIOS centros a la vez (vista combinada)?
 *
 * Solo admin/master (dirección, CEO, presidencia). El resto trabaja en UN centro
 * a la vez: el BE rechaza con 409 una petición sin `X-Tenant-ID` de un principal
 * no-admin, porque un ámbito sin centro no filtra en los servicios que no
 * consultan `allowedClinicIds` (leería pacientes de otros centros).
 * Ver cmr-be docs/specs/usuarios-roles-accesos.md.
 */
export function puedeVerTodosLosCentros(me: Me | null | undefined): boolean {
  if (!me) return false;
  // cmr-be #557 on: isAdmin is the only signal. Before it: master or the "admin" access mode (an admin
  // ROLE alone did not open the combined view, the backend answered 409).
  if (typeof me.isAdmin === "boolean") return me.isAdmin;
  return me.isMaster === true || me.accessMode === "admin";
}
