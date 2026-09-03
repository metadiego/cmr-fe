import { apiFetch } from "./client"

// RBAC fino (#6, F2). Admin management of roles + permisos. All endpoints are
// admin/super_admin on the BE. GET /permisos and /roles return arrays directly.

export interface Permiso {
  id: string
  slug: string // module.action, e.g. "clientes.update"
  description?: string | null
  module: string
  action: string
}

export interface Rol {
  id: string
  slug: string
  name: string
  description?: string | null
  isSystem: boolean
  // El rol opera en TODOS los centros (quien lo recibe lo hereda). Un rol multi-centro se asigna GLOBAL
  // (sin centerId). Handoff HANDOFF-rol-multicentro-y-preparacion-legado.
  allCenters?: boolean
}

function asArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  const items = (res as { items?: unknown } | null)?.items
  return Array.isArray(items) ? (items as T[]) : []
}

export async function getPermisos(): Promise<Permiso[]> {
  return asArray<Permiso>(await apiFetch(`/permissions`))
}

// Catálogo de permisos (rbac.create/update/delete). La CLAVE va `modulo.accion` (la acción puede llevar
// puntos: `factura.pago.anular`); el BE deriva modulo/accion de la clave y la normaliza (minúsculas, sin
// espacios) — NO mandar modulo/accion por separado. La clave NO se edita (está en el código y en cada
// concesión). Al borrar, el BE responde 400 con un mensaje que dice a cuántos afecta → mostrarlo tal cual.
// Handoff permisos-y-roles-pantalla.
export function crearPermiso(payload: { slug: string; description?: string }): Promise<Permiso> {
  return apiFetch<Permiso>(`/permissions`, { method: "POST", body: JSON.stringify(payload) })
}
export function actualizarPermiso(id: string, description: string): Promise<Permiso> {
  return apiFetch<Permiso>(`/permissions/${id}`, { method: "PUT", body: JSON.stringify({ description }) })
}
export function eliminarPermiso(id: string): Promise<void> {
  return apiFetch<void>(`/permissions/${id}`, { method: "DELETE" })
}

// «Clonar de»: copia a un perfil el ACCESO de otro (roles + excepciones de permiso + centros de trabajo
// + modo de acceso). SUMA, no reemplaza (clonar dos veces no duplica). NO copia identidad (nombre/email/
// avatar/contraseña/ficha/estado/master) ni la apariencia. Permiso `rbac.create`. El perfil destino debe
// existir ya → invitar primero, clonar después. Handoff clonar-acceso-de-usuario.
// OJO: NINGUNO de estos campos está en CAMPOS_EN_INGLES (origenPerfilId, destinoPerfilId, copiados,
// yaTenia, antes, ahora, y las colecciones roles/permisos/asignaciones aquí son objetos-contador, no
// listas de entidades). El BE los devuelve EN ESPAÑOL bajo v2 (huecos del mapa) → se dejan tal cual.
export interface ClonarAccesoResultado {
  origenPerfilId: string
  destinoPerfilId: string
  roles: { copiados: number; yaTenia: number }
  permisos: { copiados: number; yaTenia: number }
  asignaciones: { copiados: number; yaTenia: number }
  accessMode: { antes: string; ahora: string }
}
export function clonarAccesoDe(destinoPerfilId: string, origenPerfilId: string): Promise<ClonarAccesoResultado> {
  // Ruta REAL verificada en prod: POST /profiles/:id/clone-of (v1: /clonar-de). Handoff clonar-acceso-de-usuario.
  // `origenPerfilId` no está en el mapa → el traductor de entrada lo deja tal cual y el DTO lo espera así.
  return apiFetch<ClonarAccesoResultado>(`/profiles/${destinoPerfilId}/clone-of`, {
    method: "POST",
    body: JSON.stringify({ origenPerfilId }),
  })
}

export async function getRoles(): Promise<Rol[]> {
  return asArray<Rol>(await apiFetch(`/roles`))
}

export function createRole(payload: {
  slug: string
  name: string
  description?: string
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
  return asArray<string>(await apiFetch(`/roles/${id}/permissions`))
}

// Replaces the role's permisos with EXACTLY these claves. Precarga SIEMPRE con
// getRolePermisos antes de editar. `claves` NO está en el mapa (solo `clave`→`slug`): el DTO del BE
// espera `claves`, así que la clave del cuerpo se queda en español a propósito.
export function setRolePermisos(id: string, claves: string[]): Promise<Rol> {
  return apiFetch<Rol>(`/roles/${id}/permissions`, {
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
// `claves` NO está en el mapa (solo `clave`→`slug`): el DTO/respuesta del BE usa `claves`, se deja en español.
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
  payload: { name?: string; description?: string; allCenters?: boolean }
): Promise<Rol> {
  return apiFetch<Rol>(`/roles/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

// Assign a role to a profile (POST). Se asigna GLOBAL: NO se manda centroId (el centro donde trabaja
// alguien vive en sus asignaciones de centro, no en la del rol; un rol multi-centro rechaza centroId).
// Handoff HANDOFF-rol-multicentro-y-preparacion-legado.
// `centroId` acota el rol a un centro (perfiles_roles = perfilId+rolId+centroId): así una persona puede
// ser Gerente en un centro y Facturación en otro a la vez. SIN centroId el rol es GLOBAL (todos los
// centros); un rol `todosLosCentros` SOLO se asigna global (el BE rechaza acotarlo). Handoff
// roles-por-centro-en-la-ui. Verificado en prod (POST 201, aparece en access?centroId=).
// `rolClave` NO está en el mapa (solo `rol`→`role`, `clave`→`slug`): el DTO del BE espera `rolClave`,
// se envía en español a propósito. `centerId` sí se traduce en el mapa.
export function assignRoleToProfile(
  profileId: string,
  rolClave: string,
  centerId?: string
): Promise<unknown> {
  return apiFetch(`/profiles/${profileId}/roles`, {
    method: "POST",
    body: JSON.stringify(centerId ? { rolClave, centerId } : { rolClave }),
  })
}

// ---- Per-profile access ("Accesos del usuario") ------------------------------
// GET /profiles/:id/access returns the profile's effective access: assigned
// roles, per-permiso overrides, and the resolved permiso list. Swagger types it
// loosely (Record<string,never>) so we model the contract by hand.

const qCentro = (centerId?: string) =>
  centerId ? `?centerId=${encodeURIComponent(centerId)}` : ""

export interface AccessRole {
  id: string // assignment id (use to remove)
  roleId: string
  slug: string
  name: string
  centerId?: string | null
}

export interface AccessOverride {
  id: string // override id (use to remove)
  permissionId: string
  permissionSlug: string
  effect: "grant" | "deny"
  centerId?: string | null
}

// Centro (id + name) para los selectores de la ficha de accesos. Handoff centros-por-permiso-del-usuario.
export interface CentroRef {
  id: string
  name: string
}

// OJO: `centrosConcedidos`, `centrosDisponibles` y `effectivePermissions` NO están en CAMPOS_EN_INGLES
// → el BE los devuelve tal cual bajo v2. `centrosConcedidos`/`centrosDisponibles` quedan en español
// (huecos del mapa, añadir al BE); `effectivePermissions`/`viaRole`/`override`/`allowed` ya son inglés.
export interface AccessPermiso {
  slug: string
  module: string
  action: string
  description?: string | null
  viaRole: boolean // granted by an assigned role
  override: "grant" | "deny" | null // per-profile exception
  effective: boolean // resolved result
  // «Centros concedidos»: el permiso suelto en centros AJENOS (no da sesión, no cambia el menú ni el nav).
  // SIEMPRE array (vacío = sin excepciones, «donde le toque por su rol y sus centros»). Se ven aun en la
  // vista global. Handoff centros-por-permiso-del-usuario.
  centrosConcedidos: CentroRef[]
}

export interface ProfileAccess {
  roles: AccessRole[]
  overrides: AccessOverride[]
  permissions: AccessPermiso[]
  effectivePermissions: string[]
  // Todos los centros de la empresa: fuente del selector de la columna «Centros». (Clave en español: hueco del mapa.)
  centrosDisponibles: CentroRef[]
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
    // centrosConcedidos SIEMPRE array aunque el BE lo omita en algún borde.
    permissions: (res?.permissions ?? []).map((p) => ({ ...p, centrosConcedidos: p.centrosConcedidos ?? [] })),
    effectivePermissions: res?.effectivePermissions ?? [],
    centrosDisponibles: res?.centrosDisponibles ?? [],
  }
}

// «Esta persona, ESTE permiso, en ESTOS centros» sin tocar su rol/menú/sesión. Deja los centros de la
// fila EXACTAMENTE en `centroIds` (crea los que falten, borra los que sobren; [] los quita todos).
// Idempotente. Devuelve la fila recalculada para repintar solo esa fila. Handoff centros-por-permiso-del-usuario.
// `centroIds` NO está en el mapa (solo `centroId`→`centerId`): el DTO del BE espera `centroIds`, se envía
// en español. La respuesta trae `slug` (clave→slug) y `centrosConcedidos` (español, hueco del mapa).
export async function setPermisoCentros(
  id: string,
  permisoClave: string,
  centroIds: string[]
): Promise<{ slug: string; centrosConcedidos: CentroRef[] }> {
  return apiFetch(`/profiles/${id}/permissions/${encodeURIComponent(permisoClave)}/centers`, {
    method: "PUT",
    body: JSON.stringify({ centroIds }),
  })
}

// A preview of the menu the profile would see (each item annotated allowed/required).
export interface ProfileMenuItem {
  // El BE devuelve la entidad completa anotada (MenuService.annotateForPermissions):
  // estos campos SÍ viajan y se usan para pintar grupos/separadores e iconos.
  // `requiresPermiso` NO está en el mapa → el BE lo devuelve en español bajo v2 (hueco del mapa).
  type?: "item" | "grupo" | "separador"
  customLabel?: string | null
  showIcon?: boolean
  visible?: boolean
  centerId?: string | null
  id: string
  slug: string
  labelKey: string
  path: string
  parentSlug?: string | null
  sortOrder: number
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
  permissionSlug: string,
  effect: "grant" | "deny",
  centerId?: string
): Promise<unknown> {
  return apiFetch(`/profiles/${id}/permissions`, {
    method: "POST",
    body: JSON.stringify({ permissionSlug, effect, centerId }),
  })
}

// Remove an exception → the permiso falls back to whatever the role decides.
export function removeProfileOverride(
  id: string,
  permissionId: string,
  centerId?: string
): Promise<unknown> {
  return apiFetch(`/profiles/${id}/permissions/${permissionId}${qCentro(centerId)}`, {
    method: "DELETE",
  })
}
