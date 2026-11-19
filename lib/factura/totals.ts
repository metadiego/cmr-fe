// The invoice's totals as the BE projects them (BE #536, docs/specs/la-devolucion-no-deja-deuda-handoff.md):
// the SAME block on screen and on every receipt, nothing computed here. `lines` always come in order
// subtotal, discount (−), tax, shipping, total, paid, refunded (−), balance; `moves` are each payment (+)
// and each refund (−). The balance already subtracts what was refunded.

export type TotalsKey = "subtotal" | "discount" | "tax" | "shipping" | "total" | "paid" | "refunded" | "balance";
export interface TotalsLine {
  key: TotalsKey | string;
  labelKey: string;
  amount: number;
}
export interface TotalsMove {
  kind: "payment" | "refund" | string;
  labelKey: string;
  method: string | null;
  amount: number;
  date: string | null;
  refundId: string | null;
}
export interface InvoiceTotals {
  lines: TotalsLine[];
  moves: TotalsMove[];
  fullyReturned: boolean;
}

/** `invoice.totals` read defensively; null when the BE did not send it (older invoice projection). */
export function readTotals(inv: unknown): InvoiceTotals | null {
  const t = (inv as { totals?: unknown } | null)?.totals as Partial<InvoiceTotals> | undefined;
  if (!t || !Array.isArray(t.lines) || t.lines.length === 0) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
  return {
    lines: t.lines.map((l) => ({ key: String(l.key), labelKey: String(l.labelKey ?? `invoice.totals.${l.key}`), amount: num(l.amount) })),
    moves: (Array.isArray(t.moves) ? t.moves : []).map((m) => ({
      kind: String(m.kind),
      labelKey: String(m.labelKey ?? `invoice.totals.${m.kind}`),
      method: m.method ?? null,
      amount: num(m.amount),
      date: m.date ?? null,
      refundId: m.refundId ?? null,
    })),
    fullyReturned: t.fullyReturned === true,
  };
}

/** One line's amount, or null when the block does not carry it. */
export function line(t: InvoiceTotals | null, key: TotalsKey): number | null {
  const l = t?.lines.find((x) => x.key === key);
  return l ? l.amount : null;
}
