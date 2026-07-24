import { apiFetch } from "./client";

// Per-center hourly capacity ("cupos") for the day-view. CRUD lives behind
// `citas.config`. A cupo says: for this hour + appointment type, how many slots
// exist. diaSemana=null → applies to every day (global schedule).
// Contract from Swagger: /api/v1/citas/cupos (+ /:id).

// Scope of a cupo/festivo: a single center or the global default (clinicId=null,
// applies to every center unless a center-specific row overrides it).
export type Scope = "centro" | "global";

export interface Cupo {
  id: string;
  diaSemana: number | null; // 0=Sun..6=Sat, null = default (any day)
  fecha: string | null; // "YYYY-MM-DD" one-off override, null = recurring
  hora: string; // "HH:mm"
  // Un cupo es de un TIPO DE CITA (consulta…) o de un SERVICIO de frontdesk (laser, vitc…), no ambos.
  tipoCitaId?: string | null;
  servicioId?: string | null;
  cantidad: number;
  activo: boolean;
  clinicId: string | null; // null = global
}

export interface CupoInput {
  diaSemana?: number; // omit → default (BE stores null)
  fecha?: string; // "YYYY-MM-DD" → one-off override for that date
  hora: string;
  tipoCitaId?: string; // exclusivo con servicioId
  servicioId?: string; // exclusivo con tipoCitaId
  cantidad: number;
  activo?: boolean;
  scope?: Scope; // default "centro"; "global" writes clinicId=null (needs citas.config.global)
}

export interface CuposQuery {
  diaSemana?: number;
  fecha?: string;
  scope?: Scope;
  centroId?: string; // used as X-Tenant-ID for scope "centro"
}

function cuposParams(q: CuposQuery): string {
  const sp = new URLSearchParams();
  if (q.diaSemana != null) sp.set("diaSemana", String(q.diaSemana));
  if (q.fecha) sp.set("fecha", q.fecha);
  if (q.scope) sp.set("scope", q.scope);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

// GET /citas/cupos?diaSemana=&fecha=&scope=
// scope "global" → the cross-center defaults (tenant omitted); else the center's.
export function getCupos(q: CuposQuery = {}): Promise<Cupo[]> {
  const tenant = q.scope === "global" ? null : q.centroId;
  return apiFetch<Cupo[]>(`/citas/cupos${cuposParams(q)}`, {}, tenant);
}

// POST /citas/cupos. For scope "global" the tenant header is omitted.
export function createCupo(input: CupoInput, centroId?: string): Promise<Cupo> {
  const tenant = input.scope === "global" ? null : centroId;
  return apiFetch<Cupo>(
    "/citas/cupos",
    { method: "POST", body: JSON.stringify(input) },
    tenant,
  );
}

// PUT /citas/cupos/:id
export function updateCupo(
  id: string,
  input: Partial<CupoInput>,
  centroId?: string,
): Promise<Cupo> {
  const tenant = input.scope === "global" ? null : centroId;
  return apiFetch<Cupo>(
    `/citas/cupos/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    tenant,
  );
}

// DELETE /citas/cupos/:id
export function deleteCupo(
  id: string,
  opts: { scope?: Scope; centroId?: string } = {},
): Promise<void> {
  const tenant = opts.scope === "global" ? null : opts.centroId;
  return apiFetch<void>(`/citas/cupos/${id}`, { method: "DELETE" }, tenant);
}
