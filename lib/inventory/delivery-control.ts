// Pure helpers of the "Control de entregas" kardex tab (app/(app)/inventory/kardex). Tested in
// delivery-control.test.ts. Grouping and translation live here so both the screen and its CSV export
// (delivery-control-csv.ts) build the exact same rows from the exact same logic.

import type { KardexDeliveryLine, KardexDeliveryMonth } from "@/lib/api/inventory-kardex";

type T = (key: string, values?: Record<string, string | number>) => string;

export type DeliveryMonthGroup = {
  month: string | null;
  lines: KardexDeliveryLine[];
  sold: number;
  delivered: number;
  pending: number;
};

/**
 * Lines grouped by `month`, oldest to newest, in the exact order the BE's `months[]` already gives
 * (null — the undated legacy bucket — comes first there). Each group carries the BE's own subtotal,
 * not a client-recomputed one, so a screen row always matches the BE's arithmetic.
 */
export function groupDeliveryLines(
  lines: readonly KardexDeliveryLine[],
  months: readonly KardexDeliveryMonth[],
): DeliveryMonthGroup[] {
  const byMonth = new Map<string | null, KardexDeliveryLine[]>();
  for (const l of lines) {
    const arr = byMonth.get(l.month);
    if (arr) arr.push(l);
    else byMonth.set(l.month, [l]);
  }
  return months.map((m) => ({
    month: m.month,
    lines: byMonth.get(m.month) ?? [],
    sold: m.sold,
    delivered: m.delivered,
    pending: m.pending,
  }));
}

/**
 * One line's "Observaciones" cell: its free-text note, a "Devolución #…" per refund, and the kit or
 * protocol it was sold as (nothing when sold `direct` — that is the normal case, not worth a note).
 */
export function deliveryObservationsText(line: KardexDeliveryLine, t: T): string {
  const parts: string[] = [];
  if (line.notes) parts.push(line.notes);
  for (const n of line.refundNumbers) parts.push(t("delivery.refundNote", { number: n }));
  if (line.soldAs.channel !== "direct" && line.soldAs.name) parts.push(line.soldAs.name);
  return parts.join(" · ");
}
