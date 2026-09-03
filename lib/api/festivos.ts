import { apiFetch } from "./client";
import type { Scope } from "./cupos";

// Holidays. Per-center or global (scope). `bloqueaAgenda` decides whether the
// day closes scheduling (true) or is just informational (false).
// Contract: /api/v1/festivos (CRUD admin).

export interface Festivo {
  id: string;
  date: string; // "YYYY-MM-DD" (recurrentes resueltos al año consultado)
  name: string;
  recursAnnually: boolean;
  blocksSchedule: boolean;
  active: boolean;
  clinicId: string | null; // se dice igual (CAMPOS_IGUALES); null = global
}

export interface FestivoInput {
  date: string;
  name: string;
  recursAnnually?: boolean;
  blocksSchedule?: boolean; // default true (cierra la agenda)
  active?: boolean;
  // OJO (hueco BE): el DTO del BE nombra este campo `scope` en inglés, pero el middleware de v2 traduce
  // la clave entrante `scope`→`alcance` (candidato de alcance/ambito) y el DTO ya no lo reconoce. No hay
  // clave que sobreviva como `scope` desde el FE. Requiere fix BE (añadir `scope` a NUNCA_SE_TRADUCEN o
  // renombrar el campo del DTO a `alcance`). Ver reporte. default "centro"; "global" needs citas.config.global
  scope?: Scope;
}

// `anio` NO está en el mapa de campos → la query pasa tal cual al @Query('anio') del BE.
// `scope`: mismo hueco BE que en el body (ver FestivoInput).
function params(q: { anio?: number; scope?: Scope }): string {
  const sp = new URLSearchParams();
  if (q.anio != null) sp.set("anio", String(q.anio));
  if (q.scope) sp.set("scope", q.scope);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

// GET /holidays?anio=&scope=
export function getFestivos(
  q: { anio?: number; scope?: Scope; centroId?: string } = {},
): Promise<Festivo[]> {
  const tenant = q.scope === "global" ? null : q.centroId;
  return apiFetch<Festivo[]>(`/holidays${params(q)}`, {}, tenant);
}

export function createFestivo(input: FestivoInput, centroId?: string): Promise<Festivo> {
  const tenant = input.scope === "global" ? null : centroId;
  return apiFetch<Festivo>(
    "/holidays",
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
    `/holidays/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    tenant,
  );
}

export function deleteFestivo(
  id: string,
  opts: { scope?: Scope; centroId?: string } = {},
): Promise<void> {
  const tenant = opts.scope === "global" ? null : opts.centroId;
  return apiFetch<void>(`/holidays/${id}`, { method: "DELETE" }, tenant);
}
