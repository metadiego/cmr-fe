// Pure helpers of the purchase receptions list (components/inventario/receipts-list.tsx).

/** The default period: the last 30 days through today (both YYYY-MM-DD, `today` in the center's zone). */
export function last30Days(today: string): { from: string; to: string } {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 29);
  return { from: d.toISOString().slice(0, 10), to: today };
}

/** A line's cost: quantity × unit cost, or null when the line was loaded without cost. */
export function lineTotal(quantity: number, unitCost: number | null | undefined): number | null {
  return unitCost == null ? null : Math.round(quantity * unitCost * 100) / 100;
}

/** Totals of a list of receptions; cost is null if NONE carried a cost, else the sum of those that did. */
export function receiptTotals(rows: { lines: number; units: number; totalCost: number | null }[]) {
  const withCost = rows.filter((r) => r.totalCost != null);
  return {
    receipts: rows.length,
    lines: rows.reduce((a, r) => a + (Number(r.lines) || 0), 0),
    units: rows.reduce((a, r) => a + (Number(r.units) || 0), 0),
    totalCost: withCost.length ? Math.round(withCost.reduce((a, r) => a + Number(r.totalCost), 0) * 100) / 100 : null,
  };
}
