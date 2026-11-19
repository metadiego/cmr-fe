import { apiFetch } from "./client";

// GET /frontdesk/summary-of-day and the export engine for it (cmr-be #632, handoff
// docs/specs/resumen-del-dia-por-servicio-handoff.md). The center always travels as centerIds.

export type DaySummaryRow = {
  sessionId: string;
  /** The v2 edge renames the BE's `record` to `medicalRecordNumber` (verified live 18-nov); read via rowRecord. */
  medicalRecordNumber?: string | null;
  record?: string | null;
  patient: string | null;
  quantity: number;
  dose: string | null;
  nurse: string | null;
  attendedBy: string | null;
  attendedAt: string | null;
  sealedVials: number;
  content: number;
};

export type DaySummaryGroupRow = { name: string | null; sessions: number; sealedVials: number; content: number };

export type DaySummary = {
  service: { id: string; slug: string | null; name: string };
  centers: { id: string; name: string }[];
  date: string;
  total: number;
  attended: number;
  complete: boolean;
  rows: DaySummaryRow[];
  totals: {
    sessions: number;
    patients: number;
    quantity: number;
    sealedVials: number;
    content: number;
    proportion: number | null;
    /** Per nurse / per who marked it attended, most first (cmr-be #634). Absent before it deploys. */
    byNurse?: DaySummaryGroupRow[];
    byUser?: DaySummaryGroupRow[];
  };
};

export const rowRecord = (r: Pick<DaySummaryRow, "medicalRecordNumber" | "record">): string | null =>
  r.medicalRecordNumber ?? r.record ?? null;

export function getDaySummary(p: { service: string; date: string; centerId: string }): Promise<DaySummary> {
  const q = new URLSearchParams({ servicio: p.service, fecha: p.date, centerIds: p.centerId });
  return apiFetch<DaySummary>(`/frontdesk/summary-of-day?${q}`, {}, p.centerId);
}

export type ExportResult = { filename: string; mime: string; base64: string; rows?: number };

export type ExportRequest = {
  resource: string;
  format: "csv" | "pdf";
  channel: "download" | "email";
  destination?: string;
  filters: Record<string, unknown>;
};

/** POST /export: the file (download) or the email with it attached; logged in /export/jobs either way. */
export function exportReport(req: ExportRequest, centerId: string): Promise<ExportResult> {
  return apiFetch<ExportResult>("/export", { method: "POST", body: JSON.stringify(req) }, centerId);
}

/** What the screen narrowed: only these sessions, these columns, and the «Filtrado:» line for the letterhead
 *  (owner 18-nov-2026: «que esos filtros apliquen para csv, email y print»). Omitted = the whole day. */
export type DaySummaryNarrowing = { sessionIds?: string[]; columns?: string[]; filterLabel?: string };

/** The export request for this report: the board's center, the service, the day and what is on screen. */
export function daySummaryExport(p: { service: string; date: string; centerId: string } & DaySummaryNarrowing) {
  return (format: "csv" | "pdf", channel: "download" | "email", destination?: string) =>
    exportReport(
      {
        resource: "frontdesk-day-summary",
        format,
        channel,
        destination,
        filters: {
          servicio: p.service,
          fecha: p.date,
          centerIds: [p.centerId],
          ...(p.sessionIds ? { sessionIds: p.sessionIds } : {}),
          ...(p.columns ? { columns: p.columns } : {}),
          ...(p.filterLabel ? { filterLabel: p.filterLabel } : {}),
        },
      },
      p.centerId
    );
}
