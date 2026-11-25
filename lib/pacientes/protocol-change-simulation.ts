// Pure logic of the protocol change's simulation zone (owner, 23/24-nov-2026; cmr-be #691,
// docs/specs/cambio-de-protocolo-simulacro.md). A typed price per unit is an agreed price: it travels as
// `preciosOrigen[].precioUnitario` (what closes) and `nuevos[].precioUnitario` (what is created), and the
// SAME prices go to apply. An empty price is not zero: it leaves the BE's own valuation (charged / list).

/** A typed price: a number >= 0. Empty or unreadable → undefined (the BE values it on its own). */
export function priceOf(v: string | null | undefined): number | undefined {
  const s = (v ?? "").trim().replace(/^\$/, "").replace(/,/g, "");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Filled but not a price >= 0 (a `reason` that blocks: the BE would answer 400). */
export function priceInvalid(v: string | null | undefined): boolean {
  return (v ?? "").trim() !== "" && priceOf(v) === undefined;
}

/** `preciosOrigen` for the ticked packages that have a typed price, in tick order. */
export function originPrices(
  ticked: readonly string[],
  prices: Readonly<Record<string, string>>,
): { paqueteId: string; precioUnitario: number }[] {
  const out: { paqueteId: string; precioUnitario: number }[] = [];
  for (const id of ticked) {
    const p = priceOf(prices[id]);
    if (p !== undefined) out.push({ paqueteId: id, precioUnitario: p });
  }
  return out;
}

/** The difference reads green at 0 (to the cent), amber with its sign otherwise; nothing before a result. */
export function differenceTone(diff: number | null | undefined): "success" | "warning" | null {
  if (diff == null || !Number.isFinite(diff)) return null;
  return Math.abs(diff) < 0.005 ? "success" : "warning";
}

/** «+$90.00» / «-$90.00» / «$0.00», given the app's money formatter. */
export function signedMoney(diff: number, money: (v: number) => string): string {
  if (Math.abs(diff) < 0.005) return money(0);
  return (diff > 0 ? "+" : "-") + money(Math.abs(diff));
}

/**
 * What the patient would end up with of a product being created, when they still have it pending
 * (owner, 24-nov-2026): the BE's `continuesAfter` lists those packages (the new one starts after them).
 * Null when the patient has none of it pending.
 */
export function totalWithExisting(
  productId: string,
  units: number,
  continuesAfter: readonly { productId: string; pendingSessions: number }[] | undefined,
): { existing: number; total: number } | null {
  const existing = (continuesAfter ?? []).filter((c) => c.productId === productId).reduce((n, c) => n + Math.max(0, c.pendingSessions || 0), 0);
  return existing > 0 ? { existing, total: existing + units } : null;
}
