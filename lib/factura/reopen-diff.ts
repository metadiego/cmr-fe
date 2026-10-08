// "What changed" for the invoice's reopen history. Each reopening stores the invoice exactly as it was
// issued (`snapshot`); comparing it with the NEXT state — the following reopening's snapshot, or the
// invoice as it is now for the latest — says what that correction changed. Pure, so it is tested.

export interface DiffLine {
  id?: string;
  productId?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  total?: number | string | null;
}

export interface DiffPayment {
  id?: string;
  amount?: number | string | null;
  formaPagoNombre?: string | null;
  paymentMethodId?: string | null;
  type?: string | null;
}

export interface DiffInvoice {
  date?: string | null;
  total?: number | string | null;
  discount?: number | string | null;
  exempt?: boolean | null;
  items?: DiffLine[] | null;
  payments?: DiffPayment[] | null;
}

export type HeaderField = "date" | "total" | "discount" | "exempt";

export type InvoiceChange =
  | { kind: "header"; field: HeaderField; before: string | number | boolean | null; after: string | number | boolean | null }
  | { kind: "lineAdded"; description: string; quantity: number; total: number }
  | { kind: "lineRemoved"; description: string; quantity: number; total: number }
  | { kind: "lineChanged"; description: string; before: { quantity: number; unitPrice: number; total: number }; after: { quantity: number; unitPrice: number; total: number } }
  | { kind: "paymentAdded"; method: string; amount: number }
  | { kind: "paymentRemoved"; method: string; amount: number };

const num = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
};

const lineKey = (l: DiffLine) => l.id ?? `${l.productId ?? ""}|${l.description ?? ""}`;
const payKey = (p: DiffPayment) => p.id ?? `${p.paymentMethodId ?? ""}|${num(p.amount)}`;

function lineValues(l: DiffLine) {
  return { quantity: num(l.quantity), unitPrice: num(l.unitPrice), total: num(l.total) };
}

// Changes from `before` (an issued snapshot) to `after` (the next snapshot, or the invoice now).
// Lines and payments are matched by id: a line edited in place keeps its row.
export function diffInvoice(before: DiffInvoice, after: DiffInvoice): InvoiceChange[] {
  const changes: InvoiceChange[] = [];

  if ((before.date ?? null) !== (after.date ?? null)) {
    changes.push({ kind: "header", field: "date", before: before.date ?? null, after: after.date ?? null });
  }
  for (const field of ["discount", "total"] as const) {
    if (num(before[field]) !== num(after[field])) {
      changes.push({ kind: "header", field, before: num(before[field]), after: num(after[field]) });
    }
  }
  if (!!before.exempt !== !!after.exempt) {
    changes.push({ kind: "header", field: "exempt", before: !!before.exempt, after: !!after.exempt });
  }

  const beforeLines = new Map((before.items ?? []).map((l) => [lineKey(l), l]));
  const afterLines = new Map((after.items ?? []).map((l) => [lineKey(l), l]));
  for (const [k, l] of beforeLines) {
    const a = afterLines.get(k);
    const description = l.description ?? "";
    if (!a) {
      changes.push({ kind: "lineRemoved", description, quantity: num(l.quantity), total: num(l.total) });
      continue;
    }
    const b = lineValues(l);
    const n = lineValues(a);
    if (b.quantity !== n.quantity || b.unitPrice !== n.unitPrice || b.total !== n.total) {
      changes.push({ kind: "lineChanged", description: a.description ?? description, before: b, after: n });
    }
  }
  for (const [k, l] of afterLines) {
    if (!beforeLines.has(k)) {
      changes.push({ kind: "lineAdded", description: l.description ?? "", quantity: num(l.quantity), total: num(l.total) });
    }
  }

  // Refunds belong to returns, not to the correction: only payments count here.
  const isPayment = (p: DiffPayment) => (p.type ?? "pago") !== "reembolso";
  const beforePays = new Map((before.payments ?? []).filter(isPayment).map((p) => [payKey(p), p]));
  const afterPays = new Map((after.payments ?? []).filter(isPayment).map((p) => [payKey(p), p]));
  for (const [k, p] of beforePays) {
    if (!afterPays.has(k)) changes.push({ kind: "paymentRemoved", method: p.formaPagoNombre ?? "", amount: num(p.amount) });
  }
  for (const [k, p] of afterPays) {
    if (!beforePays.has(k)) changes.push({ kind: "paymentAdded", method: p.formaPagoNombre ?? "", amount: num(p.amount) });
  }
  return changes;
}

// The history comes newest first. Reopening i is compared with what came right after it: the newer
// reopening's snapshot (i - 1), or the invoice as it is now for the newest one.
export function reopeningChanges(snapshotsNewestFirst: DiffInvoice[], current: DiffInvoice): InvoiceChange[][] {
  return snapshotsNewestFirst.map((snap, i) => diffInvoice(snap, i === 0 ? current : snapshotsNewestFirst[i - 1]));
}
