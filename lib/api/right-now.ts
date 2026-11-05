import { apiFetch } from "@/lib/api/client";

// «Ahora mismo» — the office live dashboard (BE PR #451, handoff docs/specs/right-now-office-dashboard.md).
// The BE's OpenAPI types this response as an empty object, so these types are copied from the REAL
// v2 response (Caguas + Bayamón, 04-nov-2026), not from a DTO. Only what the screen reads is typed.
// `combinado` is Spanish because v2 serves it that way today (BE translation debt, announced first).

export type RightNowSeller = { userId: string; name: string | null; total: number };

export type RightNowSales = {
  invoices: number;
  bruto: number;
  devuelto: number;
  neto: number;
  refunds: number;
  sellers?: RightNowSeller[];
  megagrupos?: { slug: string; neto: number; invoices: number }[];
};

export type RightNowPatients = {
  present: number;
  firstVisit: number;
  followUp: number;
  attended: number;
  pending: number;
};

export type RightNowDoctor = {
  doctorId: string | null;
  name: string | null;
  total: number;
  attended: number;
  firstVisit: number;
  followUp: number;
  net: number;
  // Fila de cierre "lo facturado sin médico" (BE PR #474, handoff-ahora-mismo-sin-medico): solo
  // presente en esa fila (doctorId/name null). Pintar t(labelKey) en vez de name.
  labelKey?: string;
};

export type RightNowWaiting = { medicalRecordNumber: string | null; patient: string; since: string | null };
export type RightNowCompleted = {
  medicalRecordNumber: string | null;
  patient: string;
  attendedBy: string | null;
  startedAt: string | null;
  endedAt: string | null;
};

export type RightNowService = {
  serviceId: string;
  name: string;
  color: string | null;
  icon: string | null;
  total: number;
  waiting: number;
  inCare: number;
  completed: number;
  staffOnDuty: string[];
  waitingList: RightNowWaiting[];
  completedList: RightNowCompleted[];
};

export type RightNowPrescriptions = {
  source?: string;
  available?: boolean;
  ranking?: { name?: string | null; total?: number }[];
};

export type RightNowCallTotals = {
  total: number;
  inbound: number;
  outbound: number;
  missed: number;
  answerRate: number; // 0..1
};

export type RightNowCalls = {
  byPbx?: ({ pbx: string } & RightNowCallTotals)[];
  consolidated?: RightNowCallTotals;
  ranking?: { extension: string; name: string | null; answered: number; outbound: number }[];
};

export type RightNowCenter = {
  clinicId: string;
  name: string;
  date: string;
  sales?: RightNowSales;
  patients?: RightNowPatients;
  doctors?: RightNowDoctor[];
  services?: RightNowService[];
  prescriptions?: RightNowPrescriptions;
  calls?: RightNowCalls;
  alerts?: { total: number; bySeverity?: Record<string, number> };
};

export type RightNowCombined = {
  sales?: Omit<RightNowSales, "sellers" | "megagrupos">;
  patients?: RightNowPatients;
  calls?: { consolidated?: RightNowCallTotals };
  alerts?: { total: number };
};

export type RightNowCenters = {
  date: string;
  centers: RightNowCenter[];
  combinado: RightNowCombined;
};

// GET /right-now/centers — every center the user may read (admin: all active ones). `date` optional:
// without it each center reports ITS today. No X-Tenant-ID: the scope is the user's centers, not one.
export function getRightNowCenters(date?: string): Promise<RightNowCenters> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiFetch<RightNowCenters>(`/right-now/centers${qs}`, {}, null);
}

// SSE of invalidations (no snapshot in the event): on each one, refetch the snapshot (debounced).
export const RIGHT_NOW_STREAM_PATH = "/api/v2/right-now/stream";
