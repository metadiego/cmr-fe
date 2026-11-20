// A refund no longer writes on the invoice (cmr-be #650, owner 20-nov-2026, handoff
// docs/specs/refund-leaves-invoice-untouched-handoff.md): an invoice refunded from now on stays
// `status: "emitida"`, while older ones still say `devuelta_parcial` / `devuelta_total`. The refund state
// comes from the derived `refundStatus` ("none" | "partial" | "full") so old and new look the same.

export type RefundStatus = "none" | "partial" | "full";

const LEGACY: Record<string, RefundStatus> = { devuelta_parcial: "partial", devuelta_total: "full" };

/** Old `devuelta_*` statuses are issued invoices too. */
export function isIssuedInvoice(status: string | null | undefined): boolean {
  return status === "emitida" || (!!status && status in LEGACY);
}

/** `refundStatus` when the BE sends it; else read from a legacy status (an older payload); else none. */
export function refundStateOf(inv: { status?: string | null; refundStatus?: string | null }): RefundStatus {
  const r = inv.refundStatus;
  if (r === "none" || r === "partial" || r === "full") return r;
  return (inv.status && LEGACY[inv.status]) || "none";
}

/** The status the badge shows: refunded (from the derived state) wins; a legacy `devuelta_*` with no
 *  refund left (all refunds voided) reads as what it is, an issued invoice. Keys are the catalogue's. */
export function invoiceBadgeStatus(inv: { status?: string | null; refundStatus?: string | null }): string {
  const status = inv.status ?? "";
  if (!isIssuedInvoice(status)) return status;
  const r = refundStateOf(inv);
  return r === "partial" ? "devuelta_parcial" : r === "full" ? "devuelta_total" : "emitida";
}

/** «Devolver»: an issued invoice that still has something to return. */
export function canRefundInvoice(inv: { status?: string | null; refundStatus?: string | null }): boolean {
  return isIssuedInvoice(inv.status) && refundStateOf(inv) !== "full";
}

/** «Anular»: the BE refuses a fully refunded invoice. */
export function canVoidInvoice(inv: { status?: string | null; refundStatus?: string | null }): boolean {
  return isIssuedInvoice(inv.status) && refundStateOf(inv) !== "full";
}

/** Reopen / change patient / add a kit component stay closed once anything was refunded. */
export function isUntouchedIssued(inv: { status?: string | null; refundStatus?: string | null }): boolean {
  return isIssuedInvoice(inv.status) && refundStateOf(inv) === "none";
}

/** What a line can still return: the BE's `refundable*` (already net of delivered, returned and
 *  transferred); an older payload falls back to total − refunded. Never negative. */
export function refundableOf(
  line: { quantity?: unknown; sessions?: unknown; refundedQuantity?: unknown; refundedSessions?: unknown; refundableQuantity?: unknown; refundableSessions?: unknown },
  by: "quantity" | "sessions",
): number {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v ?? 0) || 0);
  const direct = by === "quantity" ? line.refundableQuantity : line.refundableSessions;
  if (direct != null && Number.isFinite(Number(direct))) return Math.max(0, num(direct));
  const total = by === "quantity" ? line.quantity : line.sessions;
  const done = by === "quantity" ? line.refundedQuantity : line.refundedSessions;
  return Math.max(0, num(total) - num(done));
}
