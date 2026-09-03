import { apiFetch } from "./client";
import type { AccessMode, PerfilEstado } from "./auth";

// List endpoints return the array in the envelope's `data` (pagination lives in
// `meta`, which apiFetch drops). Normalize defensively in case a `{items}` shape
// shows up.
function asList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

// Domain types mirror cmr-be profiles endpoints. Optional fields are kept loose
// because the BE may add columns; the panel only relies on what it renders.
export interface PerfilRolResumen {
  slug: string;
  name: string;
  centerId: string | null;
}

export interface PerfilCentroResumen {
  // `asignacionId` NO está en CAMPOS_EN_INGLES → el BE lo devuelve en español bajo v2 (hueco del mapa).
  asignacionId: string;
  centerId: string;
  name: string | null;
  type: string;
  validFrom?: string | null;
  validUntil?: string | null;
  active: boolean;
}

export interface Perfil {
  id: string;
  email: string;
  name: string;
  lastName?: string | null;
  status: PerfilEstado;
  accessMode: AccessMode;
  isMaster?: boolean;
  createdAt?: string;
  // GET /profiles enriquecido (usuarios-roles-accesos): roles y centros del perfil.
  roles?: PerfilRolResumen[];
  centers?: PerfilCentroResumen[];
}

export interface Asignacion {
  id: string;
  profileId: string;
  centerId: string;
  type?: string;
  validFrom?: string;
  validUntil?: string | null;
  forced?: boolean;
  active?: boolean;
  center?: { id: string; name: string } | null;
}

export interface InvitePayload {
  email: string;
  name: string;
  lastName?: string;
  // BE accepts operativo|gerencial here (admin/master is reserved for the master).
  accessMode?: Extract<AccessMode, "operativo" | "gerencial">;
  password?: string;
  // Where the Supabase invite magic link should land (the FE set-password page).
  // Sent per-request so it works in any environment (dev :8080 / prod Vercel).
  redirectTo?: string;
  // Invite ampliado: centro + rol en el mismo paso (el invitado no nace sin accesos).
  centerId?: string;
  // `rolClave` y `tipoAsignacion` NO están en CAMPOS_EN_INGLES: el traductor de entrada de v2 los
  // deja tal cual, y el DTO del BE los espera en español, así que se envían en español a propósito.
  rolClave?: string;
  tipoAsignacion?: "base" | "temporal" | "fijo";
  validUntil?: string;
  // Enlace a una PERSONA ya dada de alta (personal sin cuenta): la invitación engancha la cuenta nueva a
  // ese staffId y conserva su historial (sellos/participaciones cuelgan de staffId, no del login).
  // Sin este campo, la cuenta nace sin ficha, como antes (BE PR #241). Ver HANDOFF-invitar-vinculando-persona.
  staffId?: string;
}

// Invite without password → the BE sends a Supabase invitation email and
// returns emailSent:true (the user sets their own password via the magic link
// at /auth/set-password). Invite WITH password → silent alta (no email). The
// legacy tempPassword is kept only as a defensive fallback.
export interface InviteResponse extends Perfil {
  emailSent?: boolean;
  tempPassword?: string;
  // Avisos no-bloqueantes tras crear la cuenta (centro/rol/enlace de personal que quedó pendiente).
  // `avisos` NO está en CAMPOS_EN_INGLES → el BE lo devuelve en español bajo v2 (hueco del mapa).
  avisos?: string[];
}

export interface AssignCenterPayload {
  centerId: string;
  type?: string;
  validFrom?: string;
  validUntil?: string;
  forced?: boolean;
}

const qs = (page?: number, limit?: number) => {
  const p = new URLSearchParams();
  if (page) p.set("page", String(page));
  if (limit) p.set("limit", String(limit));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export async function getPendingProfiles(
  page?: number,
  limit?: number,
): Promise<Perfil[]> {
  return asList<Perfil>(await apiFetch(`/profiles/pending${qs(page, limit)}`));
}

export async function getProfiles(
  page?: number,
  limit?: number,
): Promise<Perfil[]> {
  return asList<Perfil>(await apiFetch(`/profiles${qs(page, limit)}`));
}

export function approveProfile(id: string): Promise<Perfil> {
  return apiFetch<Perfil>(`/profiles/${id}/approve`, { method: "POST" });
}

export function rejectProfile(id: string, reason: string): Promise<Perfil> {
  return apiFetch<Perfil>(`/profiles/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function inviteUser(payload: InvitePayload): Promise<InviteResponse> {
  return apiFetch<InviteResponse>(`/profiles/invite`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface UpdatePerfilPayload {
  name?: string;
  lastName?: string | null;
  accessMode?: Extract<AccessMode, "operativo" | "gerencial">;
}

// PUT /profiles/:id — name/lastName/accessMode (D5).
export function updateProfile(
  id: string,
  payload: UpdatePerfilPayload,
): Promise<Perfil> {
  return apiFetch<Perfil>(`/profiles/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function suspenderProfile(id: string): Promise<Perfil> {
  return apiFetch<Perfil>(`/profiles/${id}/suspend`, { method: "POST" });
}

export function reactivarProfile(id: string): Promise<Perfil> {
  return apiFetch<Perfil>(`/profiles/${id}/reactivate`, { method: "POST" });
}

// Código de acceso de UN SOLO USO (8 caracteres, caduca en 60 min): el admin lo genera y lo entrega en
// persona; con él, la persona fija SU propia contraseña en /auth/set-password (verifyOtp). El admin NO
// fija ni conoce la contraseña. Permiso profiles.codigo_acceso (solo admin). NUNCA devuelve contraseñas
// ni enlaces. 409 si el perfil está suspendido/rechazado o sin email. Handoff codigo-de-acceso.
export interface CodigoAccesoResult {
  email: string;
  code: string;
  // `expiraEnMinutos` NO está en CAMPOS_EN_INGLES → el BE lo devuelve en español bajo v2 (hueco del mapa).
  expiraEnMinutos: number;
}
export function generarCodigoAcceso(id: string): Promise<CodigoAccesoResult> {
  return apiFetch<CodigoAccesoResult>(`/profiles/${id}/access-code`, { method: "POST", body: JSON.stringify({}) });
}

// Cambia el email de ACCESO de un perfil ya invitado (cmr-be PR #277). Mueve el correo en Supabase Y en
// nuestra tabla a la vez, CIERRA las sesiones abiertas de esa persona (tendrá que volver a entrar) y
// actualiza su ficha de personal. NO cambia la contraseña. Permiso profiles.email (admin/super_admin).
// Errores: 409 (email ya usado / correo reservado del master / perfil master), 400 (email inválido).
// Devuelve el perfil actualizado. Handoff cambiar-email-de-perfil-handoff-be.
export function cambiarEmailPerfil(id: string, email: string): Promise<Perfil> {
  return apiFetch<Perfil>(`/profiles/${id}/email`, {
    method: "PUT",
    body: JSON.stringify({ email }),
  });
}

// GET /profiles/:id/assignments — centros del perfil con type/vigencia/active.
export function getAsignaciones(perfilId: string): Promise<Asignacion[]> {
  return apiFetch<Asignacion[]>(`/profiles/${perfilId}/assignments`).then(
    (r) => asList<Asignacion>(r),
  );
}

export interface UpdateAsignacionPayload {
  type?: "base" | "temporal" | "fijo";
  validFrom?: string;
  validUntil?: string;
  active?: boolean;
}

export function updateAsignacion(
  perfilId: string,
  asignacionId: string,
  payload: UpdateAsignacionPayload,
): Promise<Asignacion> {
  return apiFetch<Asignacion>(
    `/profiles/${perfilId}/assignments/${asignacionId}`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

// Revoca (soft: active=false) — el perfil pierde el centro sin borrar historial.
export function revokeAsignacion(
  perfilId: string,
  asignacionId: string,
): Promise<Asignacion> {
  return apiFetch<Asignacion>(
    `/profiles/${perfilId}/assignments/${asignacionId}`,
    { method: "DELETE" },
  );
}

export function assignCenter(
  profileId: string,
  payload: AssignCenterPayload,
): Promise<Asignacion> {
  return apiFetch<Asignacion>(`/profiles/${profileId}/assignments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
