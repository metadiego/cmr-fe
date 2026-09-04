import { apiFetch } from "./client";

export type AccessMode = "operativo" | "gerencial" | "admin";
export type PerfilEstado =
  | "pendiente"
  | "aprobado"
  | "rechazado"
  | "suspendido";

// Resolved auth context the BE returns for the current session.
// Mirrors cmr-be GET /api/v1/auth/me (see cmr-be/docs/auth-login.md).
export interface Me {
  id: string;
  profileId: string | null;
  // personal.id of the logged-in operator (call-center/atención). Used as
  // bookedByStaffId on create and actorId on reschedule for the audit trail.
  staffId?: string | null;
  email: string | null;
  // Nombre/apellido del perfil enlazado (cmr-be PR #221). null si el login no tiene perfil
  // (p. ej. cuentas master por app_metadata) → el FE cae al email.
  name?: string | null;
  lastName?: string | null;
  status: PerfilEstado | null;
  roles: string[];
  permissions: string[];
  isMaster: boolean;
  accessMode: AccessMode;
  allowedClinicIds: string[];
  activeClinicId: string | null;
  // true after an invite that generated a tempPassword — the FE forces a change.
  mustChangePassword?: boolean;
  // Public URL of the user's avatar (Supabase Storage), or null.
  avatarUrl?: string | null;
  // Idioma de la interfaz ya RESUELTO por el BE para esta persona ("en" si nunca eligió),
  // y la lista de los que puede elegir (hoy ["en","es"]). El FE pinta el selector con esa
  // lista y aplica `language` al arrancar. Handoff idioma-por-usuario.
  language?: string;
  // OJO: el BE devuelve esta clave EN ESPAÑOL bajo v2 (no está en el mapa CAMPOS_EN_INGLES,
  // así que el interceptor la deja tal cual). Hueco del BE: añadir `idiomasDisponibles` al mapa.
  idiomasDisponibles?: string[];
}

export function getMe(): Promise<Me> {
  return apiFetch<Me>("/auth/me");
}

// Clears mustChangePassword in the BE after the user set a new password
// (via Supabase auth.updateUser on the client).
export function markPasswordChanged(): Promise<void> {
  return apiFetch<void>("/auth/me/password-changed", { method: "POST" });
}
