// Pure money logic for a kit component's return row (app/(app)/billing/invoices/[id]/return/page.tsx).
// Tested here per CLAUDE.md rule 5 (money/billing logic ships with its test in lib/).

export type RefundableComp = {
  invoiceItemComponentId?: string | null;
  productId?: string | null;
  quantity?: number;
  price?: number;
  // What the line actually paid for this component, prorated (cmr-be #705). Ahead of the generated
  // schema — absent on an older BE response.
  paidShare?: number | null;
};

const n = (v: unknown) => Number(v ?? 0);

/**
 * A component is keyed by its own id when it has one, else its product (handoff
 * .personal/handoff-devolucion-espejo-de-la-factura.md §4) — every component is returnable, with or
 * without an invoiceItemComponentId (legacy kits often lack one).
 */
export function compKeyOf(c: RefundableComp): string {
  return String(c.invoiceItemComponentId ?? c.productId ?? "");
}

/**
 * Default refund for a partial component return: the paid share actually collected, prorated by the
 * quantity returned — never the list price. `paidShare` is ahead of the generated schema (cmr-be
 * #705); falls back to the billed price so an older BE response still prefills something sensible.
 */
export function compDefaultRefund(c: RefundableComp, quantityReturned: number): number {
  const billedQty = n(c.quantity);
  if (billedQty <= 0) return 0;
  const base = c.paidShare != null ? n(c.paidShare) : n(c.price);
  return (quantityReturned / billedQty) * base;
}
