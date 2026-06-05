import { apiFetch } from "./client";

export interface Centro {
  id: string;
  nombre: string;
  codigo: string;
  direccion?: string | null;
  activo?: boolean;
}

export interface CreateCenterPayload {
  nombre: string;
  codigo: string;
  direccion?: string;
  activo?: boolean;
}

export async function getCenters(
  page?: number,
  limit?: number,
): Promise<Centro[]> {
  const p = new URLSearchParams();
  if (page) p.set("page", String(page));
  if (limit) p.set("limit", String(limit));
  const s = p.toString();
  const res: unknown = await apiFetch(`/centros${s ? `?${s}` : ""}`);
  if (Array.isArray(res)) return res as Centro[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as Centro[]) : [];
}

export function createCenter(payload: CreateCenterPayload): Promise<Centro> {
  return apiFetch<Centro>(`/centros`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// The principal's own centers WITH name (master → all). Use this for the center
// selector instead of cross-referencing allowedClinicIds against getCenters().
export async function getMyCentros(): Promise<Centro[]> {
  const res: unknown = await apiFetch(`/auth/me/centros`);
  if (Array.isArray(res)) return res as Centro[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as Centro[]) : [];
}
