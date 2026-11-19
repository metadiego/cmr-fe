import { apiFetch, oneCenterPath, tenantOf } from "./client";
import type { CenterChoice } from "@/lib/clinic-read-scope";

// Analítica: ventas y asistencia combinables, pacientes y tasa de retorno (BE cmr-be#546/#550, spec
// cmr-be/docs/specs/analytics-screens.md en cmr-fe PR #122, Diego — verificado en vivo 11-nov-2026,
// coincide con el handoff). Permiso estadisticas.read. Todas aceptan `centerIds` como el resto de
// reportes. `group`/`labels` SIEMPRE llegan juntos: pintar `labels[d] ?? group[d]`; `group[d]: null`
// = «Sin médico / Sin vendedor / …» (el dinero/evento no se pierde, solo no tiene a quién atribuirse).

export type SalesBreakdownDimension =
  | "clinic" | "day" | "month" | "weekday" | "hour" | "doctor" | "seller" | "product"
  | "patient" | "source" | "paymentMethod" | "division";

export type BreakdownTotals = {
  invoices: number;
  patients: number;
  gross: number;
  refunds: number;
  net: number;
  quantity?: number;
};
export type SalesBreakdownRow = BreakdownTotals & {
  group: Record<string, string | null>;
  labels: Record<string, string | null>;
};
export type SalesBreakdown = {
  from: string;
  to: string;
  by: SalesBreakdownDimension[];
  rows: SalesBreakdownRow[];
  total: BreakdownTotals;
  truncated: number;
};
export async function getSalesBreakdown(
  params: {
    from: string;
    to: string;
    by: SalesBreakdownDimension[];
    contexto?: "general" | "consulta";
    doctorIds?: string[];
    sellerIds?: string[];
    productIds?: string[];
    patientId?: string;
    limit?: number;
  },
  choice?: CenterChoice,
): Promise<SalesBreakdown> {
  const sp = new URLSearchParams({ from: params.from, to: params.to, by: params.by.join(",") });
  if (params.contexto) sp.set("contexto", params.contexto);
  if (params.patientId) sp.set("patientId", params.patientId);
  if (params.limit) sp.set("limit", String(params.limit));
  for (const id of params.doctorIds ?? []) sp.append("doctorIds", id);
  for (const id of params.sellerIds ?? []) sp.append("sellerIds", id);
  for (const id of params.productIds ?? []) sp.append("productIds", id);
  return apiFetch<SalesBreakdown>(await oneCenterPath(`/statistics/sales-breakdown?${sp.toString()}`, choice), {}, tenantOf(choice));
}

export type AttendanceDimension =
  | "clinic" | "day" | "month" | "weekday" | "hour" | "kind" | "service" | "doctor"
  | "technician" | "visitType" | "channel" | "status" | "patient";
export type AttendanceTotals = {
  events: number;
  attended: number;
  noShows: number;
  cancelled: number;
  scheduled: number;
  unrecorded: number;
  patients: number;
  attendedPatients: number;
};
export type AttendanceRow = AttendanceTotals & {
  group: Record<string, string | null>;
  labels: Record<string, string | null>;
};
export type Attendance = {
  from: string;
  to: string;
  by: AttendanceDimension[];
  rows: AttendanceRow[];
  total: AttendanceTotals;
  truncated: number;
};
export async function getAttendance(
  params: { from: string; to: string; by: AttendanceDimension[]; limit?: number },
  choice?: CenterChoice,
): Promise<Attendance> {
  const sp = new URLSearchParams({ from: params.from, to: params.to, by: params.by.join(",") });
  if (params.limit) sp.set("limit", String(params.limit));
  return apiFetch<Attendance>(await oneCenterPath(`/statistics/attendance?${sp.toString()}`, choice), {}, tenantOf(choice));
}

export type PatientAttendance = {
  patient: string;
  label: string;
  firstVisit: string | null;
  lastVisit: string | null;
  visits: { total: number; appointments: number; therapies: number; days: number };
  noShows: number;
  cancelled: number;
  unrecorded: number;
  avgDaysBetweenVisits: number | null;
  therapies: Array<{ service: string; serviceName: string; sessions: number; first: string; last: string }>;
  visitsByMonth: Array<{ month: string; visits: number }>;
  upcoming: Array<{ date: string; time: string | null; kind: string; clinicName: string; serviceName: string | null; doctorName: string | null }>;
  packages: Array<{ productId: string; productName: string; total: number; delivered: number; returned: number; transferred: number; remaining: number }>;
  spend: { invoices: number; gross: number; refunds: number; net: number };
};
export function getPatientAttendance(patientId: string, centroId?: string): Promise<PatientAttendance> {
  return apiFetch<PatientAttendance>(`/statistics/patients/${patientId}/attendance`, {}, centroId);
}

export type PatientsStatsSort = "visits" | "spend" | "lastVisit" | "firstVisit";
export type PatientsStatsRow = {
  patient: string;
  label: string;
  visits: number;
  therapies: number;
  firstVisit: string;
  lastVisit: string;
  nextVisit: string | null;
  avgDaysBetweenVisits: number | null;
  spend: number;
  isNew: boolean;
};
export type PatientsStats = {
  from: string;
  to: string;
  patients: number;
  distribution: Record<"1" | "2" | "3-5" | "6-10" | "11+", number>;
  rows: PatientsStatsRow[];
  truncated: number;
};
export async function getPatientsStats(
  params: { from: string; to: string; minVisits?: number; lapsedDays?: number; newOnly?: boolean; sort?: PatientsStatsSort; limit?: number },
  choice?: CenterChoice,
): Promise<PatientsStats> {
  const sp = new URLSearchParams({ from: params.from, to: params.to });
  if (params.minVisits != null) sp.set("minVisits", String(params.minVisits));
  if (params.lapsedDays != null) sp.set("lapsedDays", String(params.lapsedDays));
  if (params.newOnly) sp.set("newOnly", "true");
  if (params.sort) sp.set("sort", params.sort);
  if (params.limit) sp.set("limit", String(params.limit));
  return apiFetch<PatientsStats>(await oneCenterPath(`/statistics/patients?${sp.toString()}`, choice), {}, tenantOf(choice));
}

export type ReturnRateDimension = "clinic" | "month" | "service" | "doctor" | "kind";
export type ReturnRateTotals = {
  cohort: number;
  returned: number;
  notReturned: number;
  pending: number;
  rate: number | null;
  avgDaysToReturn: number | null;
};
export type ReturnRateRow = ReturnRateTotals & {
  group: Record<string, string | null>;
  labels: Record<string, string | null>;
};
export type ReturnRate = {
  from: string;
  to: string;
  withinDays: number;
  cohort: string;
  by: ReturnRateDimension | null;
  rows: ReturnRateRow[];
  total: ReturnRateTotals;
};
export async function getReturnRate(
  params: { from: string; to: string; withinDays?: number; cohort?: string; by?: ReturnRateDimension },
  choice?: CenterChoice,
): Promise<ReturnRate> {
  const sp = new URLSearchParams({ from: params.from, to: params.to });
  if (params.withinDays != null) sp.set("withinDays", String(params.withinDays));
  if (params.cohort) sp.set("cohort", params.cohort);
  if (params.by) sp.set("by", params.by);
  return apiFetch<ReturnRate>(await oneCenterPath(`/statistics/return-rate?${sp.toString()}`, choice), {}, tenantOf(choice));
}
