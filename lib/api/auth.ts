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
  perfilId: string | null;
  email: string | null;
  estado: PerfilEstado | null;
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
}

export function getMe(): Promise<Me> {
  return apiFetch<Me>("/auth/me");
}

// Clears mustChangePassword in the BE after the user set a new password
// (via Supabase auth.updateUser on the client).
export function markPasswordChanged(): Promise<void> {
  return apiFetch<void>("/auth/me/password-changed", { method: "POST" });
}
