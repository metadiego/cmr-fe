// Checks for the invoice's inline payment rows (components/facturacion/pagos-factura.tsx): «Add payment»
// and the edit of an existing payment. MONEY: this only splits the rule the rows already applied
// (`method && Number(amount) > 0 && !exceeds`) into "empty" vs "filled but invalid". The amount sent,
// the cap (lib/facturacion/tope-pago.ts) and the payload are untouched.

import { pagoExcede } from "./tope-pago.ts";

export type PaymentRowField = "method" | "amount";

/** Empty required fields, in on-screen order: the payment method, then the amount (blank after trim). */
export function paymentRowMissing(s: { methodId: string; amount: string }): PaymentRowField[] {
  const out: PaymentRowField[] = [];
  if (!s.methodId) out.push("method");
  if (s.amount.trim() === "") out.push("amount");
  return out;
}

/**
 * Why a FILLED amount cannot be saved: "notPositive" (zero, negative or not a number) or "exceedsCap"
 * (over the cap; `cap` null = no cap, as for refunds). null when it is fine or still blank.
 */
export function paymentAmountIssue(amount: string, cap: number | null): "notPositive" | "exceedsCap" | null {
  if (amount.trim() === "") return null;
  const n = Number(amount);
  if (!(n > 0)) return "notPositive";
  if (cap != null && pagoExcede(n, cap)) return "exceedsCap";
  return null;
}
