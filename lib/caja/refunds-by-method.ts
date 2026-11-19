// A payment method's line in the cash count, as accounting reconciles it (Sheila, 10-nov; BE #560): the
// net (`amount`) stays the headline; when that method carried refunds, «cobrado / devuelto» are shown
// apart so cards can be matched to the settlements. Pure; every number is the BE's.
export type MethodRow = { amount: number; sales?: number | null; refunds?: number | null };

/** null = nothing to explain (no refunds through this method, or an older BE without the split). */
export function refundSplit(r: MethodRow): { sales: number; refunds: number } | null {
  const refunds = Number(r.refunds ?? 0);
  if (!refunds || r.sales == null) return null;
  return { sales: Number(r.sales), refunds: Math.abs(refunds) };
}
