import type { components } from "./schema";
import { apiFetch, oneCenterPath, tenantOf } from "./client";
import type { CenterChoice } from "@/lib/clinic-read-scope";

// Doctor working hours (per-doctor, or global when medicoId is null) and
// holidays — used to compute bookable slots and grey out unavailable days.
export type HorarioMedico = components["schemas"]["StaffScheduleResponseDto"];
// `clinicName`: the BE names each row's clinic (clinic-read-scope); a holiday of no clinic has none.
export type Festivo = components["schemas"]["FestivoEntity"] & { clinicName?: string | null };

function asArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

// GET /doctors/schedules?doctorId= — the doctor's hours, or the center's global
// hours (doctorId null) when the doctor has none. Empty = no hours configured.
export async function getHorariosMedico(
  medicoId?: string,
): Promise<HorarioMedico[]> {
  const q = medicoId ? `?doctorId=${encodeURIComponent(medicoId)}` : "";
  return asArray<HorarioMedico>(await apiFetch(await oneCenterPath(`/doctors/schedules${q}`)));
}

// GET /holidays?anio= — holidays for the year (recurring ones resolved to it).
// `anio` NO está en el mapa api-ingles (campos.ts) → el DTO del BE espera `anio`: se manda tal cual.
// `centers`: the clinics a month calendar shows (`null` = every one with citas.read); omitted = the
// active one, as before. Each row says its clinic. The company-wide holidays (no clinic) come too: the
// clinic list never includes them (`scope=global` is a separate read), so the calendars never showed
// them. A failed company-wide read only loses those.
export async function getFestivos(anio: number, centers?: CenterChoice): Promise<Festivo[]> {
  const path = await oneCenterPath(`/holidays?anio=${anio}`, centers);
  const [clinics, global] = await Promise.all([
    apiFetch(path, {}, tenantOf(centers)),
    apiFetch(`/holidays?anio=${anio}&scope=global`, {}, null).catch(() => []),
  ]);
  return [...asArray<Festivo>(clinics), ...asArray<Festivo>(global)];
}

// ── Schedules WRITE (RBAC citas.config). Campos ya en inglés en el schema (dayOfWeek/startTime/endTime).
// El día libre semanal NO es un campo: es NO tener horario ese día. Handoff agenda-dias-bloqueados-por-medico.
export type CreateHorarioPayload = components["schemas"]["CreateStaffScheduleDto"];
export function createHorario(payload: CreateHorarioPayload, centroId?: string): Promise<HorarioMedico> {
  return apiFetch<HorarioMedico>(`/doctors/schedules`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}
export function updateHorario(id: string, payload: Partial<CreateHorarioPayload>, centroId?: string): Promise<HorarioMedico> {
  return apiFetch<HorarioMedico>(`/doctors/schedules/${id}`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}
export function deleteHorario(id: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/doctors/schedules/${id}`, { method: "DELETE" }, centroId);
}

// ── Ausencias del médico (vacaciones / permisos). CRUD RBAC citas.config. NO está en el schema
// generado (gen:api pendiente) → se tipa aquí. `kind`: vacation | leave. Rango [startDate, endDate].
export interface DoctorAbsence {
  id: string;
  doctorId: string;
  kind: "vacation" | "leave";
  startDate: string;
  endDate: string;
  reason?: string | null;
  active: boolean;
}
export interface DoctorAbsencePayload {
  doctorId: string;
  kind: "vacation" | "leave";
  startDate: string;
  endDate: string;
  reason?: string;
  active?: boolean;
}
export async function listDoctorAbsences(doctorId: string, from?: string, to?: string, centroId?: string): Promise<DoctorAbsence[]> {
  const sp = new URLSearchParams({ doctorId });
  if (from) sp.set("from", from);
  if (to) sp.set("to", to);
  return asArray<DoctorAbsence>(await apiFetch(await oneCenterPath(`/doctors/absences?${sp.toString()}`, centroId), {}, centroId));
}
export function createDoctorAbsence(payload: DoctorAbsencePayload, centroId?: string): Promise<DoctorAbsence> {
  return apiFetch<DoctorAbsence>(`/doctors/absences`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}
export function updateDoctorAbsence(id: string, payload: Partial<DoctorAbsencePayload>, centroId?: string): Promise<DoctorAbsence> {
  return apiFetch<DoctorAbsence>(`/doctors/absences/${id}`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}
export function deleteDoctorAbsence(id: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/doctors/absences/${id}`, { method: "DELETE" }, centroId);
}

// ── Próxima fecha válida: dice si la fecha pedida sirve para ese médico y, si no, la siguiente hacia
// adelante con el motivo. Úsese al agendar. NO está en el schema → se tipa aquí.
export interface NextAvailableDate {
  doctorId: string;
  askedDate: string;
  date: string | null;
  moved: boolean;
  reason?: string | null; // sunday | holiday | no_schedule | vacation | leave
  exhausted: boolean;
  labelKey?: string | null; // citas.bloqueo.<reason>
}
export function getNextAvailableDate(doctorId: string, date: string, centroId?: string): Promise<NextAvailableDate> {
  const sp = new URLSearchParams({ doctorId, date });
  return apiFetch<NextAvailableDate>(`/availability/next-available-date?${sp.toString()}`, {}, centroId);
}
