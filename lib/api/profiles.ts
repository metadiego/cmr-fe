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
export interface Perfil {
  id: string;
  email: string;
  nombre: string;
  apellido?: string | null;
  estado: PerfilEstado;
  accessMode: AccessMode;
  isMaster?: boolean;
  createdAt?: string;
}

export interface Asignacion {
  id: string;
  perfilId: string;
  centroId: string;
  tipo?: string;
  vigenteDesde?: string;
  vigenteHasta?: string | null;
  forzado?: boolean;
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
}

// Invite without password → the BE sends a Supabase invitation email and
// returns emailSent:true (the user sets their own password via the magic link
// at /auth/set-password). Invite WITH password → silent alta (no email). The
// legacy tempPassword is kept only as a defensive fallback.
export interface InviteResponse extends Perfil {
  emailSent?: boolean;
  tempPassword?: string;
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

export function assignCenter(
  profileId: string,
  payload: AssignCenterPayload,
): Promise<Asignacion> {
  return apiFetch<Asignacion>(`/profiles/${profileId}/asignaciones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
