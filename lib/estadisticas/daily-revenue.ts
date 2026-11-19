// The money block of «Estadísticas diarias» (BE #541): refunds count on THEIR day, so the headline is the
// net — the same figure as the day's cash count (ventas.neto). The BE computes the three; nothing is
// added up here.
type Daily = { grossRevenue?: number | null; refunds?: number | null; netRevenue?: number | null; services?: Array<{ returned?: number | null }> };

export type RevenueLine = { key: "gross" | "refunds" | "net"; amount: number; headline: boolean };

/** Bruto, Devoluciones (negative) and Neto as the headline; an older BE without them → just Bruto. */
export function revenueLines(d: Daily): RevenueLine[] {
  const gross = Number(d.grossRevenue ?? 0);
  if (d.netRevenue == null) return [{ key: "gross", amount: gross, headline: true }];
  const refunds = Number(d.refunds ?? 0);
  return [
    { key: "gross", amount: gross, headline: false },
    ...(refunds ? [{ key: "refunds" as const, amount: -Math.abs(refunds), headline: false }] : []),
    { key: "net", amount: Number(d.netRevenue), headline: true },
  ];
}

/** The «Devueltos» column shows only when some service had sessions given back. */
export function showReturned(d: Daily): boolean {
  return (d.services ?? []).some((s) => Number(s.returned ?? 0) > 0);
}
