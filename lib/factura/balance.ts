// What is still owed on an invoice when the BE's `totals` carries no `balance` line (that line, which
// already counts refunds, is always the first choice at every caller). Since cmr-be #650 a refund no
// longer touches the invoice (status stays `emitida`, `paidAmount` stays what was charged), so the old
// shortcut «status devuelta → 0» is gone: the status says nothing about the balance any more
// (handoff docs/specs/refund-leaves-invoice-untouched-handoff.md §4).
export function invoiceBalance(_status: string | null | undefined, total: number, paid: number): number {
  return Math.round((total - paid) * 100) / 100;
}
