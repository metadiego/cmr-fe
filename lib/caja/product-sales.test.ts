import { test } from "node:test";
import assert from "node:assert/strict";

import { componentAmount, invoiceTotals, taxColumns, type ProductSales } from "./product-sales.ts";

const est = (amount: number) => ({ key: "estatal", name: "Estatal", rate: 10.5, amount });
const mun = (amount: number) => ({ key: "municipal", name: "Municipal", rate: 1, amount });
const zero = { total: 0, components: [] };
const bucket = { amount: 0, discount: 0, base: 0, tax: 0, lines: 0 };

// Shape and figures of the real Caguas general reconciliation, 05-nov-2026 (two of its four invoices).
const ps: ProductSales = {
  taxable: { amount: 1298.82, discount: 603.14, base: 1164.87, tax: 133.95, lines: 10 },
  exempt: bucket,
  exonerated: { ...bucket, taxWouldBe: zero },
  tax: { total: 133.95, components: [mun(11.65), est(122.3)] },
  refunds: { amount: 0, base: 0, tax: zero, documents: 0 },
  net: 1298.82,
  check: { products: 1298.82, services: 22000, dayNet: 23298.82, squares: true, gap: 0 },
  invoices: [
    { id: "a", number: "001050", patient: "W", medicalRecordNumber: "15178", base: 313.27, discount: 0, tax: { total: 36.02, components: [est(32.89), mun(3.13)] }, total: 349.29, exonerated: false, refunded: 0 },
    { id: "b", number: "001053", patient: "A", medicalRecordNumber: "86667", base: 0, discount: 515.07, tax: zero, total: 0, exonerated: false, refunded: 0 },
  ],
};

test("tax columns come from the data, highest rate first", () => {
  assert.deepEqual(taxColumns(ps).map((c) => c.name), ["Estatal", "Municipal"]);
});

test("a new component in any breakdown gets its own column", () => {
  const extra = { ...ps, refunds: { ...ps.refunds, tax: { total: 1, components: [{ key: "otro", name: "Otro", rate: 2, amount: 1 }] } } };
  assert.deepEqual(taxColumns(extra).map((c) => c.key), ["estatal", "otro", "municipal"]);
});

test("missing component reads as 0", () => {
  assert.equal(componentAmount(zero, "estatal"), 0);
  assert.equal(componentAmount(ps.invoices[0].tax, "municipal"), 3.13);
});

test("footer sums the rows, per component too, a 100% discount invoice included", () => {
  const t = invoiceTotals(ps.invoices, taxColumns(ps));
  assert.equal(t.base, 313.27);
  assert.equal(t.discount, 515.07);
  assert.equal(t.tax, 36.02);
  assert.deepEqual(t.byComponent, { estatal: 32.89, municipal: 3.13 });
  assert.equal(t.total, 349.29);
  assert.equal(t.exonerated, 0);
});

test("printed sheet lists EVERY invoice, a column per component, and the check", async () => {
  const { productSalesPrintHtml } = await import("./product-sales-print.ts");
  const L = new Proxy({}, { get: (_t, k) => (k === "totals" ? "Totales ({n})" : k === "gap" ? "Descuadre {amount}" : String(k)) });
  const html = productSalesPrintHtml(ps, L as never);
  assert.ok(html.includes("001050") && html.includes("001053"));
  assert.ok(html.includes("<th class=\"r\">Estatal</th>") && html.includes("<th class=\"r\">Municipal</th>"));
  assert.ok(html.includes("Totales (2)"));
  assert.ok(html.includes("squares"));
  const off = productSalesPrintHtml({ ...ps, check: { ...ps.check, squares: false, gap: 5 } }, L as never);
  assert.ok(off.includes("Descuadre $5.00") || off.includes("Descuadre"));
});

test("print escapes patient names", async () => {
  const { productSalesPrintHtml } = await import("./product-sales-print.ts");
  const html = productSalesPrintHtml({ ...ps, invoices: [{ ...ps.invoices[0], patient: "<b>x</b>" }] }, new Proxy({}, { get: () => "" }) as never);
  assert.ok(!html.includes("<b>x</b>") && html.includes("&lt;b&gt;x"));
});
