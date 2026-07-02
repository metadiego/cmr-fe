import { apiFetch } from "./client";
import type { Scope } from "./cupos";

// Holidays. Per-center or global (scope). `bloqueaAgenda` decides whether the
// day closes scheduling (true) or is just informational (false).
// Contract: /api/v1/festivos (CRUD admin).

export interface Festivo {
  id: string;
  fecha: string; // "YYYY-MM-DD" (recurrentes resueltos al año consultado)
  nombre: string;
  recurrenteAnual: boolean;
  bloqueaAgenda: boolean;
  activo: boolean;
  clinicId: string | null; // null = global
}

export interface FestivoInput {
  fecha: string;
  nombre: string;
  recurrenteAnual?: boolean;
  bloqueaAgenda?: boolean; // default true (cierra la agenda)
  activo?: boolean;
  scope?: Scope; // default "centro"; "global" needs citas.config.global
}

function params(q: { anio?: number; scope?: Scope }): string {
  const sp = new URLSearchParams();
  if (q.anio != null) sp.set("anio", String(q.anio));
  if (q.scope) sp.set("scope", q.scope);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

// GET /festivos?anio=&scope=
export function getFestivos(
  q: { anio?: number; scope?: Scope; centroId?: string } = {},
): Promise<Festivo[]> {
  const tenant = q.scope === "global" ? null : q.centroId;
  return apiFetch<Festivo[]>(`/festivos${params(q)}`, {}, tenant);
}

export function createFestivo(input: FestivoInput, centroId?: string): Promise<Festivo> {
  const tenant = input.scope === "global" ? null : centroId;
  return apiFetch<Festivo>(
    "/festivos",
    { method: "POST", body: JSON.stringify(input) },
    tenant,
  );
}

export function updateFestivo(
  id: string,
  input: Partial<FestivoInput>,
  centroId?: string,
): Promise<Festivo> {
  const tenant = input.scope === "global" ? null : centroId;
  return apiFetch<Festivo>(
    `/festivos/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    tenant,
  );
}

export function deleteFestivo(
  id: string,
  opts: { scope?: Scope; centroId?: string } = {},
): Promise<void> {
  const tenant = opts.scope === "global" ? null : opts.centroId;
  return apiFetch<void>(`/festivos/${id}`, { method: "DELETE" }, tenant);
}
