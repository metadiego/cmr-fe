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
}

export function getMe(): Promise<Me> {
  return apiFetch<Me>("/auth/me");
}
