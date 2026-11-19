import { apiFetch } from "./client";
import type { AdjustmentInput } from "./inventory-adjustments";

// Inventory adjustments dated in the PAST (cmr-be #646, handoff
// docs/specs/inventory-backdated-adjustments-handoff.md). Field names copied from real /api/v2 answers
// (19-nov-2026, Caguas). Figures are SEALED vials, the same layer as the daily kardex.

export type BackdateNegativePolicy = "block" | "confirm" | "allow";

export type BackdateDay = { date: string; before: number; after: number };

export type BackdateProductImpact = {
  productId: string;
  sku: string | null;
  name: string | null;
  delta: number;
  /** What each later physical count MOVED that day (a delta, can be negative), not the counted quantity.
   *  cmr-be #647 renames `quantity` → `netChange`; read via countMoved. */
  laterCounts: Array<{ date: string; netChange?: number; quantity?: number }>;
  effectiveDayBefore: number;
  effectiveDayAfter: number;
  todayBefore: number;
  todayAfter: number;
  minAfter: number;
  newlyNegativeDays: string[];
  alreadyNegativeDays: string[];
  monthOpenings: BackdateDay[];
  days: BackdateDay[];
};

export type BackdateProblem = {
  code: string;
  status: number;
  labelKey: string;
  products?: Array<{ productId: string; newlyNegativeDays?: string[] }>;
  [k: string]: unknown;
};

export type BackdatePreview = {
  clinicId: string;
  warehouseId: string;
  effectiveDate: string;
  effectiveDay: string;
  today: string;
  backdated: boolean;
  daysBack: number;
  settings: { maxDays: number; negativeBalance: BackdateNegativePolicy };
  canBackdate: boolean;
  confirmationRequired: boolean;
  problems: BackdateProblem[];
  /** Closed periods after the day; shape not pinned by the handoff (sent as-is to the confirmation). */
  closings: unknown[];
  products: BackdateProductImpact[];
};

const withCenter = (path: string, centerId?: string | null) => (centerId ? `${path}?centerIds=${encodeURIComponent(centerId)}` : path);

/** Writes nothing: what saving this adjustment would do. Same body as the save (`notes` optional). */
export function previewAdjustment(body: Omit<AdjustmentInput, "notes"> & { notes?: string }, centerId?: string | null): Promise<BackdatePreview> {
  return apiFetch<BackdatePreview>(withCenter("/inventory/adjustments/preview", centerId), { method: "POST", body: JSON.stringify(body) }, centerId ?? undefined);
}

export type BackdateSettings = {
  clinicId: string;
  clinicName: string | null;
  maxDays: number;
  negativeBalance: BackdateNegativePolicy;
  negativeBalanceOptions: BackdateNegativePolicy[];
};

export function getBackdateSettings(centerId: string): Promise<BackdateSettings[]> {
  return apiFetch<BackdateSettings[]>(withCenter("/inventory/adjustments/retroactive/settings", centerId), {}, centerId);
}

/** Permission `inventory.backdate_settings` (explicit grant only). */
export function putBackdateSettings(
  body: { clinicId: string; maxDays?: number; negativeBalance?: BackdateNegativePolicy },
  centerId: string,
): Promise<{ clinicId: string; previous: unknown; current: unknown }> {
  return apiFetch(withCenter("/inventory/adjustments/retroactive/settings", centerId), { method: "PUT", body: JSON.stringify(body) }, centerId);
}
