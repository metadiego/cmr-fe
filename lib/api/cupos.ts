import { apiFetch } from "./client";

// Per-center hourly capacity ("cupos") for the day-view. CRUD lives behind
// `citas.config`. A cupo says: for this hour + appointment type, how many slots
// exist. dayOfWeek=null → applies to every day (global schedule).
// Contract from Swagger: /api/v2/appointments/slots (+ /:id).

// Scope of a cupo/festivo: a single center or the global default (clinicId=null,
// applies to every center unless a center-specific row overrides it).
// OJO: `scope` es campo/param LITERAL del DTO del BE (no español) → se manda tal cual.
export type Scope = "centro" | "global";

export interface Cupo {
  id: string;
  dayOfWeek: number | null; // 0=Sun..6=Sat, null = default (any day)
  date: string | null; // "YYYY-MM-DD" one-off override, null = recurring
  time: string; // "HH:mm"
  // Un cupo es de un TIPO DE CITA (consulta…) o de un SERVICIO de frontdesk (laser, vitc…), no ambos.
  appointmentTypeId?: string | null;
  serviceId?: string | null;
  quantity: number;
  active: boolean;
  clinicId: string | null; // null = global
}

export interface CupoInput {
  dayOfWeek?: number; // omit → default (BE stores null)
  date?: string; // "YYYY-MM-DD" → one-off override for that date
  time: string;
  appointmentTypeId?: string; // exclusivo con serviceId
  serviceId?: string; // exclusivo con appointmentTypeId
  quantity: number;
  active?: boolean;
  scope?: Scope; // default "centro"; "global" writes clinicId=null (needs citas.config.global)
}

export interface CuposQuery {
  dayOfWeek?: number;
  date?: string;
  scope?: Scope;
  centroId?: string; // used as X-Tenant-ID for scope "centro"
}

function cuposParams(q: CuposQuery): string {
  const sp = new URLSearchParams();
  if (q.dayOfWeek != null) sp.set("dayOfWeek", String(q.dayOfWeek));
  if (q.date) sp.set("date", q.date);
  if (q.scope) sp.set("scope", q.scope);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

// GET /appointments/slots?dayOfWeek=&date=&scope=
// scope "global" → the cross-center defaults (tenant omitted); else the center's.
export function getCupos(q: CuposQuery = {}): Promise<Cupo[]> {
  const tenant = q.scope === "global" ? null : q.centroId;
  return apiFetch<Cupo[]>(`/appointments/slots${cuposParams(q)}`, {}, tenant);
}

// POST /appointments/slots. For scope "global" the tenant header is omitted.
export function createCupo(input: CupoInput, centroId?: string): Promise<Cupo> {
  const tenant = input.scope === "global" ? null : centroId;
  return apiFetch<Cupo>(
    "/appointments/slots",
    { method: "POST", body: JSON.stringify(input) },
    tenant,
  );
}

// PUT /appointments/slots/:id
export function updateCupo(
  id: string,
  input: Partial<CupoInput>,
  centroId?: string,
): Promise<Cupo> {
  const tenant = input.scope === "global" ? null : centroId;
  return apiFetch<Cupo>(
    `/appointments/slots/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    tenant,
  );
}

// DELETE /appointments/slots/:id
export function deleteCupo(
  id: string,
  opts: { scope?: Scope; centroId?: string } = {},
): Promise<void> {
  const tenant = opts.scope === "global" ? null : opts.centroId;
  return apiFetch<void>(`/appointments/slots/${id}`, { method: "DELETE" }, tenant);
}
