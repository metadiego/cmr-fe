// «Venta de productos (IVU)» block of the cash reconciliation (BE PR #470, handoff
// docs/specs/cash-product-sales-ivu-handoff.md). Types copied from the REAL v2 response of
// GET /cash/reports/day (Caguas, 05-nov-2026): the generated schema does not carry ProductSalesDto yet.
// The numbers come squared from the BE; these helpers only arrange them for display, never recompute
// money, except the column sums of the invoice table (which the BE does not send per column).

export type TaxComponent = { taxId?: string; key: string; name: string; rate: number; amount: number };
export type TaxBreakdown = { total: number; components: TaxComponent[] };

export type ProductSalesBucket = { amount: number; discount: number; base: number; tax: number; lines: number };

export type ProductSalesInvoice = {
  id: string;
  number: string | null;
  date?: string;
  patient: string | null;
  medicalRecordNumber: string | null;
  status?: string | null;
  paymentMethods?: string | null;
  base: number;
  discount: number;
  tax: TaxBreakdown;
  total: number;
  exonerated: boolean;
  exoneratedBase?: number;
  refunded?: number;
  taxWouldBe?: TaxBreakdown;
  invoice?: { subtotal: number; discount: number; shipping: number; total: number };
};

export type ProductSales = {
  taxable: ProductSalesBucket;
  exempt: ProductSalesBucket;
  exonerated: ProductSalesBucket & { taxWouldBe?: TaxBreakdown };
  tax: TaxBreakdown;
  refunds: { amount: number; base: number; tax: TaxBreakdown; documents: number };
  net: number;
  invoices: ProductSalesInvoice[];
  check: { products: number; services: number; dayNet: number; squares: boolean; gap: number };
};

export type TaxColumn = { key: string; name: string; rate: number };

// One column per tax component, from the DATA (never hardcoded «Estatal/Municipal»): the union of
// every breakdown in the block, highest rate first, as the BE orders them.
export function taxColumns(ps: ProductSales): TaxColumn[] {
  const seen = new Map<string, TaxColumn>();
  const add = (b?: TaxBreakdown | null) => {
    for (const c of b?.components ?? []) if (!seen.has(c.key)) seen.set(c.key, { key: c.key, name: c.name, rate: c.rate });
  };
  add(ps.tax);
  add(ps.refunds?.tax);
  add(ps.exonerated?.taxWouldBe);
  for (const inv of ps.invoices ?? []) {
    add(inv.tax);
    add(inv.taxWouldBe);
  }
  return [...seen.values()].sort((a, b) => b.rate - a.rate);
}

export function componentAmount(b: TaxBreakdown | null | undefined, key: string): number {
  return Number(b?.components?.find((c) => c.key === key)?.amount ?? 0);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export type InvoiceTotals = {
  base: number;
  discount: number;
  tax: number;
  byComponent: Record<string, number>;
  total: number;
  refunded: number;
  exonerated: number; // how many invoices are exonerated
};

// Footer row of the invoice table: column sums of what the rows show.
export function invoiceTotals(invoices: ProductSalesInvoice[], columns: TaxColumn[]): InvoiceTotals {
  const t: InvoiceTotals = { base: 0, discount: 0, tax: 0, byComponent: {}, total: 0, refunded: 0, exonerated: 0 };
  for (const c of columns) t.byComponent[c.key] = 0;
  for (const inv of invoices) {
    t.base += Number(inv.base) || 0;
    t.discount += Number(inv.discount) || 0;
    t.tax += Number(inv.tax?.total) || 0;
    t.total += Number(inv.total) || 0;
    t.refunded += Number(inv.refunded) || 0;
    if (inv.exonerated) t.exonerated += 1;
    for (const c of columns) t.byComponent[c.key] += componentAmount(inv.tax, c.key);
  }
  t.base = round2(t.base);
  t.discount = round2(t.discount);
  t.tax = round2(t.tax);
  t.total = round2(t.total);
  t.refunded = round2(t.refunded);
  for (const k of Object.keys(t.byComponent)) t.byComponent[k] = round2(t.byComponent[k]);
  return t;
}
