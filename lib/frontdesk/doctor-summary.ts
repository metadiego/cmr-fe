// The day's consultations by doctor on the patient desk (owner 18-nov-2026: reception needs to see how
// many patients each doctor is carrying, to balance the load). Pure helpers, tested in
// doctor-summary.test.ts; the data comes from GET /appointments/summary-by-doctor (cmr-be #637,
// handoff docs/specs/resumen-por-medico-handoff-be.md).

import { toggleColumn, visibleColumns } from "./report-columns.ts";
import type { DoctorSummaryByDoctor, DoctorSummaryStage } from "@/lib/api/doctor-summary";

export const DOCTOR_SUMMARY_COLUMNS = [
  "record",
  "patient",
  "doctor",
  "nurse",
  "type",
  "stage",
  "time",
  "frontDesk",
  "amount",
  "paymentMethod",
] as const;
export type DoctorSummaryColumn = (typeof DOCTOR_SUMMARY_COLUMNS)[number];

/** Money columns, hidden whenever the viewer lacks `factura.read` (the BE sends them null either way). */
export const DOCTOR_SUMMARY_MONEY_COLUMNS: ReadonlySet<DoctorSummaryColumn> = new Set(["amount", "paymentMethod"]);

/** Every column but the money ones, which only show up for someone who can read invoices. */
export const DEFAULT_DOCTOR_SUMMARY_COLUMNS: readonly DoctorSummaryColumn[] = DOCTOR_SUMMARY_COLUMNS;

/** The preference key in the user's layer of /me/preferences: `{ reportColumns: { [report]: string[] } }`. */
export const DOCTOR_SUMMARY_REPORT = "frontdesk-doctor-summary";

/** The columns a viewer may ever see: everyone's columns, minus the money ones without `factura.read`. */
export function allowedDoctorSummaryColumns(canReadInvoices: boolean): DoctorSummaryColumn[] {
  return canReadInvoices ? [...DOCTOR_SUMMARY_COLUMNS] : DOCTOR_SUMMARY_COLUMNS.filter((c) => !DOCTOR_SUMMARY_MONEY_COLUMNS.has(c));
}

/** The saved choice, cleaned: only known AND allowed columns, always in table order; nothing valid → every allowed column. */
export function visibleDoctorSummaryColumns(saved: unknown, canReadInvoices: boolean): DoctorSummaryColumn[] {
  const allowed = allowedDoctorSummaryColumns(canReadInvoices);
  return visibleColumns(allowed, allowed, saved);
}

/** Toggle one column; the last visible one cannot be hidden (an empty table prints nothing). */
export function toggleDoctorSummaryColumn(current: readonly DoctorSummaryColumn[], col: DoctorSummaryColumn): DoctorSummaryColumn[] {
  return toggleColumn(DOCTOR_SUMMARY_COLUMNS, current, col);
}

/** `carried` (attended + inConsultation + waiting) sums every doctor's own `carried`, not `appointments`. */
export function totalCarried(byDoctor: readonly Pick<DoctorSummaryByDoctor, "carried">[]): number {
  return byDoctor.reduce((a, d) => a + d.carried, 0);
}

/** Doctors with at least one patient carried, busiest first, then by name; the doctor-less row sorts last. */
export function sortedByDoctor(byDoctor: readonly DoctorSummaryByDoctor[]): DoctorSummaryByDoctor[] {
  return [...byDoctor].sort((a, b) =>
    a.doctorId == null ? 1 : b.doctorId == null ? -1 : b.carried - a.carried || (a.doctor ?? "").localeCompare(b.doctor ?? "")
  );
}

/** A closed enum (the BE sends no display string for it), unlike `type.name` which is already data. */
export const DOCTOR_SUMMARY_STAGES: readonly DoctorSummaryStage[] = ["scheduled", "arrived", "in_consultation", "attended"];
