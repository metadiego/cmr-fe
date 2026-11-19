import { apiFetch } from "./client";

// Fusionar dos fichas de la misma persona (BE PR #581, handoff .personal/handoff-fusionar-pacientes.md):
// todo el historial pasa a la ficha BUENA (`target`); la duplicada (`duplicate`) desaparece.
// `simulate` NO escribe nada — se llama primero siempre, para mostrar el plan antes de pedir el motivo.
export type PatientMergeRef = { id: string; name: string; record: string | null };
export type PatientMergeMove = { table: string; column: string; rows: number };
export type PatientMergeCollision = {
  table: string;
  index: string;
  policy: "drop-duplicate-row" | "retire-duplicate-appointment" | "abort";
  rows: number;
};
export type PatientMergeBlocking = { code: string; labelKey?: string; message?: string };
export type PatientPastReports = {
  sharedDays: number;
  sharedMonths: string[];
  sharedYears: number[];
  firstDuplicate: string | null;
  firstTarget: string | null;
  changesNewVsFollowUp: boolean;
  changesPastPatientCounts: boolean;
};
export type PatientMergePlan = {
  duplicate: PatientMergeRef;
  target: PatientMergeRef;
  moves: PatientMergeMove[];
  collisions: PatientMergeCollision[];
  blocking: PatientMergeBlocking[];
  pastReports: PatientPastReports;
  merged?: boolean;
};

// No escribe nada: el plan para mostrar ANTES de pedir el motivo.
export function simulatePatientMerge(duplicateId: string, targetId: string, centroId?: string): Promise<PatientMergePlan> {
  return apiFetch<PatientMergePlan>(`/patients/${duplicateId}/merge-into/${targetId}/simulate`, { method: "POST" }, centroId);
}
// Fusiona. Pide confirmación (`patient.merge`, la maneja apiFetch solo). `acceptPastReportImpact`
// solo si `pastReports.changesPastPatientCounts` — sin eso el BE responde 409
// PATIENT_MERGE_CHANGES_PAST_REPORTS. Permiso `pacientes.merge` en el centro de CADA ficha.
export function mergePatients(
  duplicateId: string,
  targetId: string,
  payload: { reason: string; acceptPastReportImpact?: boolean },
  centroId?: string,
): Promise<PatientMergePlan> {
  return apiFetch<PatientMergePlan>(`/patients/${duplicateId}/merge-into/${targetId}`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}
