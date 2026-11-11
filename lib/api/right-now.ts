import { apiFetch, oneCenterPath } from "@/lib/api/client";

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

// Una fila del ranking = una PERSONA (BE #553, handoff .personal/handoff-extensiones-por-central.md):
// antes era una extensión suelta. `staffId:null` = extensión sin dueño todavía (pintar "sin asignar").
// `extension` ya viene combinada ("805 / 2224"); `extensions` trae el desglose por central si hace
// falta mostrarlo como chips.
export type RightNowCallRankingRow = {
  staffId: string | null;
  name: string | null;
  extension: string;
  extensions: { pbx: string; extension: string }[];
  answered: number;
  outbound: number;
};
export type RightNowCalls = {
  byPbx?: ({ pbx: string } & RightNowCallTotals)[];
  consolidated?: RightNowCallTotals;
  ranking?: RightNowCallRankingRow[];
};

// Un centro enchufado al legado (BE PR feat/right-now-legacy-plug, handoff
// .personal/handoff-ahora-mismo-legado-bayamon.md) trae esta marca junto a sales/doctors/patients/
// services calculados allá. Ausente = cifras nuestras, como siempre. `stale` del BE asume que el
// empujador sigue vivo; la pantalla además vigila `receivedAt` + `staleAfterMinutes` contra SU
// propio reloj (el `now` que ya refresca cada 30 s), porque si el empujador muere no llega SSE y
// `stale` se quedaría en false para siempre.
export type RightNowExternalSource = {
  source: string;
  day: string;
  generatedAt: string;
  receivedAt: string;
  staleAfterMinutes: number;
  stale: boolean;
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
  // El call center es UNO solo para toda la organización (#553): esta copia solo sobrevive en el
  // PRIMER centro, por compatibilidad con el panel viejo — leer `combinado.calls`, no esto.
  calls?: RightNowCalls;
  alerts?: { total: number; bySeverity?: Record<string, number> };
  externalSource?: RightNowExternalSource;
};

export type RightNowCombined = {
  sales?: Omit<RightNowSales, "sellers" | "megagrupos">;
  patients?: RightNowPatients;
  calls?: RightNowCalls;
  alerts?: { total: number };
};

export type RightNowCenters = {
  date: string;
  centers: RightNowCenter[];
  combinado: RightNowCombined;
};

// GET /right-now/centers — the top bar's clinic, or on «Ambos» every center the user may read (admin: all
// active ones), as `centerIds` (oneCenterPath). `date` optional: without it each center reports ITS today.
// No X-Tenant-ID: the scope is the user's centers, not one.
export async function getRightNowCenters(date?: string): Promise<RightNowCenters> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiFetch<RightNowCenters>(await oneCenterPath(`/right-now/centers${qs}`), {}, null);
}

// SSE of invalidations (no snapshot in the event): on each one, refetch the snapshot (debounced).
export const RIGHT_NOW_STREAM_PATH = "/api/v2/right-now/stream";

// El interruptor del enchufe del legado, por centro (ahora-mismo.config). `lastSnapshot` deja ver,
// antes de encender, si el empujador del legado está mandando algo. `GET` es `ahora-mismo.read`.
export type RightNowExternalSourceConfig = {
  clinicId: string;
  name: string;
  enabled: boolean;
  staleAfterMinutes: number;
  lastSnapshot: { source: string; day: string; generatedAt: string; receivedAt: string } | null;
};

export function getExternalSourceConfig(centerIds: string[]): Promise<RightNowExternalSourceConfig[]> {
  const sp = new URLSearchParams();
  for (const id of centerIds) sp.append("centerIds", id);
  const qs = sp.toString();
  return apiFetch<RightNowExternalSourceConfig[]>(`/right-now/external-source${qs ? `?${qs}` : ""}`);
}

export function setExternalSourceConfig(
  centroId: string,
  payload: { enabled: boolean; staleAfterMinutes?: number },
): Promise<{ clinicId: string; previous: boolean; current: boolean }> {
  const sp = new URLSearchParams({ centerIds: centroId });
  return apiFetch<{ clinicId: string; previous: boolean; current: boolean }>(
    `/right-now/external-source?${sp.toString()}`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
}
