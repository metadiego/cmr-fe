import { apiFetch } from "./client";
import type { ExportRequest, ExportResult } from "./day-summary";

// GET /appointments/summary-by-doctor and its export (cmr-be #637, handoff
// docs/specs/resumen-por-medico-handoff-be.md). How many patients each doctor on Consultas is
// carrying today (attended + in consultation + waiting), so reception can balance the load.

export type DoctorSummaryStage = "scheduled" | "arrived" | "in_consultation" | "attended";

export type DoctorSummaryRow = {
  appointmentId: string;
  record: string | null;
  patient: string | null;
  doctorId: string | null;
  doctor: string | null;
  nurse: string | null;
  type: { slug: string; name: string } | null;
  stage: DoctorSummaryStage;
  time: string | null;
  arrivedAt: string | null;
  attendedAt: string | null;
  frontDesk: string | null;
  /** null when the viewer lacks `factura.read` — hide the money columns in that case. */
  invoiceAmount: number | null;
  paymentMethods: string | null;
};

export type DoctorSummaryTypeCount = { slug: string; name: string; count: number };

export type DoctorSummaryByDoctor = {
  doctorId: string | null;
  doctor: string | null;
  total: number;
  attended: number;
  inConsultation: number;
  waiting: number;
  scheduled: number;
  /** attended + inConsultation + waiting: how many this doctor is carrying right now. */
  carried: number;
  byType: DoctorSummaryTypeCount[];
  amount: number | null;
};

export type DoctorSummary = {
  date: string;
  rows: DoctorSummaryRow[];
  totals: {
    appointments: number;
    carried: number;
    patients: number;
    amount: number | null;
    byType: DoctorSummaryTypeCount[];
    byDoctor: DoctorSummaryByDoctor[];
  };
};

export function getDoctorSummary(p: { date: string; centerId: string; doctorIds?: string[] }): Promise<DoctorSummary> {
  const q = new URLSearchParams({ fecha: p.date, centerIds: p.centerId });
  if (p.doctorIds?.length) q.set("doctorIds", p.doctorIds.join(","));
  return apiFetch<DoctorSummary>(`/appointments/summary-by-doctor?${q}`, {}, p.centerId);
}

/** What the screen narrowed: only these appointments, these columns, and the «Filtrado:» line. Omitted = the whole day. */
export type DoctorSummaryNarrowing = { appointmentIds?: string[]; columns?: string[]; filterLabel?: string };

export function doctorSummaryExport(p: { date: string; centerId: string; doctorIds?: string[] } & DoctorSummaryNarrowing) {
  return (format: "csv" | "pdf", channel: "download" | "email", destination?: string) =>
    exportDoctorSummary(
      {
        resource: "appointments-doctor-summary",
        format,
        channel,
        destination,
        filters: {
          fecha: p.date,
          centerIds: [p.centerId],
          ...(p.doctorIds?.length ? { doctorIds: p.doctorIds } : {}),
          ...(p.appointmentIds ? { appointmentIds: p.appointmentIds } : {}),
          ...(p.columns ? { columns: p.columns } : {}),
          ...(p.filterLabel ? { filterLabel: p.filterLabel } : {}),
        },
      },
      p.centerId
    );
}

// Same shape as day-summary's exportReport; kept local so this file has no runtime dependency on
// day-summary.ts beyond the two shared types above.
function exportDoctorSummary(req: ExportRequest, centerId: string): Promise<ExportResult> {
  return apiFetch<ExportResult>("/export", { method: "POST", body: JSON.stringify(req) }, centerId);
}
