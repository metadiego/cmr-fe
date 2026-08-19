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
  clave: string;
  nombre: string;
  centroId: string | null;
}

export interface PerfilCentroResumen {
  asignacionId: string;
  centroId: string;
  nombre: string | null;
  tipo: string;
  vigenteDesde?: string | null;
  vigenteHasta?: string | null;
  activo: boolean;
}

export interface Perfil {
  id: string;
  email: string;
  nombre: string;
  apellido?: string | null;
  estado: PerfilEstado;
  accessMode: AccessMode;
  isMaster?: boolean;
  createdAt?: string;
  // GET /profiles enriquecido (usuarios-roles-accesos): roles y centros del perfil.
  roles?: PerfilRolResumen[];
  centros?: PerfilCentroResumen[];
}

export interface Asignacion {
  id: string;
  perfilId: string;
  centroId: string;
  tipo?: string;
  vigenteDesde?: string;
  vigenteHasta?: string | null;
  forzado?: boolean;
  activo?: boolean;
  centro?: { id: string; nombre: string } | null;
}

export interface InvitePayload {
  email: string;
  nombre: string;
  apellido?: string;
  // BE accepts operativo|gerencial here (admin/master is reserved for the master).
  accessMode?: Extract<AccessMode, "operativo" | "gerencial">;
  password?: string;
  // Where the Supabase invite magic link should land (the FE set-password page).
  // Sent per-request so it works in any environment (dev :8080 / prod Vercel).
  redirectTo?: string;
  // Invite ampliado: centro + rol en el mismo paso (el invitado no nace sin accesos).
  centroId?: string;
  rolClave?: string;
  tipoAsignacion?: "base" | "temporal" | "fijo";
  vigenteHasta?: string;
  // Enlace a una PERSONA ya dada de alta (personal sin cuenta): la invitación engancha la cuenta nueva a
  // ese personalId y conserva su historial (sellos/participaciones cuelgan de personalId, no del login).
  // Sin este campo, la cuenta nace sin ficha, como antes (BE PR #241). Ver HANDOFF-invitar-vinculando-persona.
  personalId?: string;
}

// Invite without password → the BE sends a Supabase invitation email and
// returns emailSent:true (the user sets their own password via the magic link
// at /auth/set-password). Invite WITH password → silent alta (no email). The
// legacy tempPassword is kept only as a defensive fallback.
export interface InviteResponse extends Perfil {
  emailSent?: boolean;
  tempPassword?: string;
  // Avisos no-bloqueantes tras crear la cuenta (centro/rol/enlace de personal que quedó pendiente).
  avisos?: string[];
}

export interface AssignCenterPayload {
  centroId: string;
  tipo?: string;
  vigenteDesde?: string;
  vigenteHasta?: string;
  forzado?: boolean;
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

export function rejectProfile(id: string, motivo: string): Promise<Perfil> {
  return apiFetch<Perfil>(`/profiles/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });
}

export function inviteUser(payload: InvitePayload): Promise<InviteResponse> {
  return apiFetch<InviteResponse>(`/profiles/invite`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface UpdatePerfilPayload {
  nombre?: string;
  apellido?: string | null;
  accessMode?: Extract<AccessMode, "operativo" | "gerencial">;
}

// PUT /profiles/:id — nombre/apellido/accessMode (D5).
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
  return apiFetch<Perfil>(`/profiles/${id}/suspender`, { method: "POST" });
}

export function reactivarProfile(id: string): Promise<Perfil> {
  return apiFetch<Perfil>(`/profiles/${id}/reactivar`, { method: "POST" });
}

// Código de acceso de UN SOLO USO (8 caracteres, caduca en 60 min): el admin lo genera y lo entrega en
// persona; con él, la persona fija SU propia contraseña en /auth/set-password (verifyOtp). El admin NO
// fija ni conoce la contraseña. Permiso profiles.codigo_acceso (solo admin). NUNCA devuelve contraseñas
// ni enlaces. 409 si el perfil está suspendido/rechazado o sin email. Handoff codigo-de-acceso.
export interface CodigoAccesoResult {
  email: string;
  codigo: string;
  expiraEnMinutos: number;
}
export function generarCodigoAcceso(id: string): Promise<CodigoAccesoResult> {
  return apiFetch<CodigoAccesoResult>(`/profiles/${id}/codigo-acceso`, { method: "POST", body: JSON.stringify({}) });
}

// GET /profiles/:id/asignaciones — centros del perfil con tipo/vigencia/activo.
export function getAsignaciones(perfilId: string): Promise<Asignacion[]> {
  return apiFetch<Asignacion[]>(`/profiles/${perfilId}/asignaciones`).then(
    (r) => asList<Asignacion>(r),
  );
}

export interface UpdateAsignacionPayload {
  tipo?: "base" | "temporal" | "fijo";
  vigenteDesde?: string;
  vigenteHasta?: string;
  activo?: boolean;
}

export function updateAsignacion(
  perfilId: string,
  asignacionId: string,
  payload: UpdateAsignacionPayload,
): Promise<Asignacion> {
  return apiFetch<Asignacion>(
    `/profiles/${perfilId}/asignaciones/${asignacionId}`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

// Revoca (soft: activo=false) — el perfil pierde el centro sin borrar historial.
export function revokeAsignacion(
  perfilId: string,
  asignacionId: string,
): Promise<Asignacion> {
  return apiFetch<Asignacion>(
    `/profiles/${perfilId}/asignaciones/${asignacionId}`,
    { method: "DELETE" },
  );
}

export function assignCenter(
  profileId: string,
  payload: AssignCenterPayload,
): Promise<Asignacion> {
  return apiFetch<Asignacion>(`/profiles/${profileId}/asignaciones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
