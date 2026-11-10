// What is still owed on an invoice. A refunded invoice owes nothing: after a refund the BE lowers what
// was paid, so «total − paid» read the refund as a debt (Caguas, 10-nov: devuelta_total showed the whole
// total as Saldo). Until the BE ships its own balance (BE fix in progress), a refunded invoice owes 0.
export function invoiceBalance(status: string | null | undefined, total: number, paid: number): number {
  if (status === "devuelta_total" || status === "devuelta_parcial") return 0;
  return Math.round((total - paid) * 100) / 100;
}
