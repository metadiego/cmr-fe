// «Imprimir recibo» on an invoice with refunds offers each refund's OWN receipt («DEVOLUCIÓN #D-…») and
// defaults to the latest one (owner, 10-nov: the first two refunds printed the invoice instead).

export type RefundRow = { id: string; displayNumber?: string | null; number?: number | null; date?: string | null; createdAt?: string; status?: string };

/** Live refunds first by date (then creation), newest first; voided ones are still printable, last. */
export function refundsNewestFirst<T extends RefundRow>(rows: readonly T[]): T[] {
  const live = (r: T) => (r.status === "anulada" ? 1 : 0);
  const when = (r: T) => `${r.date ?? ""}|${r.createdAt ?? ""}|${String(r.number ?? 0).padStart(9, "0")}`;
  return [...rows].sort((a, b) => live(a) - live(b) || (when(a) < when(b) ? 1 : when(a) > when(b) ? -1 : 0));
}

/** The default document: the latest live refund when there is one, else the invoice itself (""). */
export function defaultReceipt(rows: readonly RefundRow[]): string {
  const first = refundsNewestFirst(rows)[0];
  return first && first.status !== "anulada" ? first.id : "";
}

/** The print page of the chosen document (`centro` always in the URL: the page shares no state). */
export function receiptUrl(invoiceId: string, refundId: string): string {
  return refundId ? `/print/refund/${invoiceId}/${refundId}` : `/print/invoice/${invoiceId}`;
}
