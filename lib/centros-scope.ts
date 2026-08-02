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
  return me.isMaster === true || me.accessMode === "admin";
}
