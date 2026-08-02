import { apiFetch } from "./client"

// RBAC fino (#6, F2). Admin management of roles + permisos. All endpoints are
// admin/super_admin on the BE. GET /permisos and /roles return arrays directly.

export interface Permiso {
  id: string
  clave: string // modulo.accion, e.g. "clientes.update"
  descripcion?: string | null
  modulo: string
  accion: string
}

export interface Rol {
  id: string
  clave: string
  nombre: string
  descripcion?: string | null
  esSistema: boolean
}

function asArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  const items = (res as { items?: unknown } | null)?.items
  return Array.isArray(items) ? (items as T[]) : []
}

export async function getPermisos(): Promise<Permiso[]> {
  return asArray<Permiso>(await apiFetch(`/permisos`))
}

export async function getRoles(): Promise<Rol[]> {
  return asArray<Rol>(await apiFetch(`/roles`))
}

export function createRole(payload: {
  clave: string
  nombre: string
  descripcion?: string
}): Promise<Rol> {
  return apiFetch<Rol>(`/roles`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function deleteRole(id: string): Promise<void> {
  return apiFetch<void>(`/roles/${id}`, { method: "DELETE" })
}

// Claves ACTUALES del rol — para PRECARGAR el editor antes del PUT (que
// reemplaza el set completo). Corrige el viejo bug del REPLACE ciego.
export async function getRolePermisos(id: string): Promise<string[]> {
  return asArray<string>(await apiFetch(`/roles/${id}/permisos`))
}

// Replaces the role's permisos with EXACTLY these claves. Precarga SIEMPRE con
// getRolePermisos antes de editar.
export function setRolePermisos(id: string, claves: string[]): Promise<Rol> {
  return apiFetch<Rol>(`/roles/${id}/permisos`, {
    method: "PUT",
    body: JSON.stringify({ claves }),
  })
}

// Menú anotado (allowed/requiresPermiso) para un ROL — el vínculo rol↔menú.
export async function getRoleMenu(id: string): Promise<ProfileMenuItem[]> {
  return asArray<ProfileMenuItem>(await apiFetch(`/roles/${id}/menu`))
}

// Fija QUÉ ítems de menú ve el rol (claves de menú → permisos; los permisos
// no ligados a menú del rol no se tocan).
export function setRoleMenu(
  id: string,
  claves: string[]
): Promise<{ claves: string[] }> {
  return apiFetch<{ claves: string[] }>(`/roles/${id}/menu`, {
    method: "PUT",
    body: JSON.stringify({ claves }),
  })
}

// Edit a custom role's name/description (PUT /roles/:id). esSistema roles are
// not editable on the BE.
export function updateRole(
  id: string,
  payload: { nombre?: string; descripcion?: string }
): Promise<Rol> {
  return apiFetch<Rol>(`/roles/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

// Assign a role to a profile (POST). Optional centroId scopes it to one center.
export function assignRoleToProfile(
  profileId: string,
  rolClave: string,
  centroId?: string
): Promise<unknown> {
  return apiFetch(`/profiles/${profileId}/roles`, {
    method: "POST",
    body: JSON.stringify({ rolClave, centroId }),
  })
}

// ---- Per-profile access ("Accesos del usuario") ------------------------------
// GET /profiles/:id/access returns the profile's effective access: assigned
// roles, per-permiso overrides, and the resolved permiso list. Swagger types it
// loosely (Record<string,never>) so we model the contract by hand.

const qCentro = (centroId?: string) =>
  centroId ? `?centroId=${encodeURIComponent(centroId)}` : ""

export interface AccessRole {
  id: string // assignment id (use to remove)
  rolId: string
  clave: string
  nombre: string
  centroId?: string | null
}

export interface AccessOverride {
  id: string // override id (use to remove)
  permisoId: string
  permisoClave: string
  efecto: "grant" | "deny"
  centroId?: string | null
}

export interface AccessPermiso {
  clave: string
  modulo: string
  accion: string
  descripcion?: string | null
  viaRole: boolean // granted by an assigned role
  override: "grant" | "deny" | null // per-profile exception
  effective: boolean // resolved result
}

export interface ProfileAccess {
  roles: AccessRole[]
  overrides: AccessOverride[]
  permisos: AccessPermiso[]
  effectivePermissions: string[]
}

export async function getProfileAccess(
  id: string,
  centroId?: string
): Promise<ProfileAccess> {
  const res = (await apiFetch(
    `/profiles/${id}/access${qCentro(centroId)}`
  )) as Partial<ProfileAccess> | null
  return {
    roles: res?.roles ?? [],
    overrides: res?.overrides ?? [],
    permisos: res?.permisos ?? [],
    effectivePermissions: res?.effectivePermissions ?? [],
  }
}

// A preview of the menu the profile would see (each item annotated allowed/required).
export interface ProfileMenuItem {
  // El BE devuelve la entidad completa anotada (MenuService.annotateForPermissions):
  // estos campos SÍ viajan y se usan para pintar grupos/separadores e iconos.
  tipo?: "item" | "grupo" | "separador"
  labelCustom?: string | null
  mostrarIcono?: boolean
  visible?: boolean
  centroId?: string | null
  id: string
  clave: string
  labelKey: string
  path: string
  parentClave?: string | null
  orden: number
  allowed: boolean
  requiresPermiso?: string | null
}

export async function getProfileMenu(
  id: string,
  centroId?: string
): Promise<ProfileMenuItem[]> {
  return asArray<ProfileMenuItem>(
    await apiFetch(`/profiles/${id}/menu${qCentro(centroId)}`)
  )
}

export function removeRoleFromProfile(
  id: string,
  rolId: string,
  centroId?: string
): Promise<unknown> {
  return apiFetch(`/profiles/${id}/roles/${rolId}${qCentro(centroId)}`, {
    method: "DELETE",
  })
}

// Set a per-profile permission exception (grant or deny).
export function setProfileOverride(
  id: string,
  permisoClave: string,
  efecto: "grant" | "deny",
  centroId?: string
): Promise<unknown> {
  return apiFetch(`/profiles/${id}/permisos`, {
    method: "POST",
    body: JSON.stringify({ permisoClave, efecto, centroId }),
  })
}

// Remove an exception → the permiso falls back to whatever the role decides.
export function removeProfileOverride(
  id: string,
  permisoId: string,
  centroId?: string
): Promise<unknown> {
  return apiFetch(`/profiles/${id}/permisos/${permisoId}${qCentro(centroId)}`, {
    method: "DELETE",
  })
}
