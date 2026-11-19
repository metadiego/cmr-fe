import { componentAmount, type ProductSalesInvoice, type TaxColumn } from "./product-sales.ts";
import type { TaxBreakdown } from "./product-sales.ts";

// Tax columns of the exonerated report: the components of the IVU that was due, from the data,
// highest rate first (same rule as the cash section; never hardcoded names).
export function dueTaxColumns(totals: TaxBreakdown | null | undefined, invoices: ProductSalesInvoice[]): TaxColumn[] {
  const seen = new Map<string, TaxColumn>();
  const add = (b?: TaxBreakdown | null) => {
    for (const c of b?.components ?? []) if (!seen.has(c.key)) seen.set(c.key, { key: c.key, name: c.name, rate: c.rate });
  };
  add(totals);
  for (const i of invoices) add(i.taxWouldBe);
  return [...seen.values()].sort((a, b) => b.rate - a.rate);
}

// CSV rows (header first) of the report, as the screen shows it. Money as plain numbers.
export function exoneratedCsvRows(
  invoices: ProductSalesInvoice[],
  cols: TaxColumn[],
  header: { number: string; date: string; record: string; patient: string; subtotal: string; discount: string; shipping: string; total: string; exoneratedBase: string; status: string; payment: string },
): (string | number)[][] {
  const head = [header.number, header.date, header.record, header.patient, header.subtotal, header.discount, header.shipping, header.total, header.exoneratedBase, ...cols.map((c) => c.name), header.status, header.payment];
  const rows = invoices.map((i) => [
    i.number ?? "",
    i.date ?? "",
    i.medicalRecordNumber ?? "",
    i.patient ?? "",
    i.invoice?.subtotal ?? 0,
    i.invoice?.discount ?? 0,
    i.invoice?.shipping ?? 0,
    i.invoice?.total ?? 0,
    i.exoneratedBase ?? 0,
    ...cols.map((c) => componentAmount(i.taxWouldBe, c.key)),
    i.status ?? "",
    i.paymentMethods ?? "",
  ]);
  return [head, ...rows];
}
