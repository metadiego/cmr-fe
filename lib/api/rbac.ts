import { apiFetch } from "./client";

// RBAC fino (#6, F2). Admin management of roles + permisos. All endpoints are
// admin/super_admin on the BE. GET /permisos and /roles return arrays directly.

export interface Permiso {
  id: string;
  clave: string; // modulo.accion, e.g. "clientes.update"
  descripcion?: string | null;
  modulo: string;
  accion: string;
}

export interface Rol {
  id: string;
  clave: string;
  nombre: string;
  descripcion?: string | null;
  esSistema: boolean;
}

function asArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

export async function getPermisos(): Promise<Permiso[]> {
  return asArray<Permiso>(await apiFetch(`/permisos`));
}

export async function getRoles(): Promise<Rol[]> {
  return asArray<Rol>(await apiFetch(`/roles`));
}

export function createRole(payload: {
  clave: string;
  nombre: string;
  descripcion?: string;
}): Promise<Rol> {
  return apiFetch<Rol>(`/roles`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteRole(id: string): Promise<void> {
  return apiFetch<void>(`/roles/${id}`, { method: "DELETE" });
}

// Replaces the role's permisos with EXACTLY these claves (BE has no GET for a
// role's current permisos, so the editor sets from scratch — warn the user).
export function setRolePermisos(id: string, claves: string[]): Promise<Rol> {
  return apiFetch<Rol>(`/roles/${id}/permisos`, {
    method: "PUT",
    body: JSON.stringify({ claves }),
  });
}

// Assign a role to a profile (add only; removal needs the assigned rolId, which
// the BE doesn't expose via GET yet).
export function assignRoleToProfile(
  profileId: string,
  rolClave: string,
  centroId?: string,
): Promise<unknown> {
  return apiFetch(`/profiles/${profileId}/roles`, {
    method: "POST",
    body: JSON.stringify({ rolClave, centroId }),
  });
}
