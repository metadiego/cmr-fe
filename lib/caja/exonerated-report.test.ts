import { test } from "node:test";
import assert from "node:assert/strict";

import { dueTaxColumns, exoneratedCsvRows } from "./exonerated-report.ts";
import type { ProductSalesInvoice } from "./product-sales.ts";

const due = { total: 11.5, components: [{ key: "municipal", name: "Municipal", rate: 1, amount: 1 }, { key: "estatal", name: "Estatal", rate: 10.5, amount: 10.5 }] };
const inv: ProductSalesInvoice = {
  id: "x", number: "000429", date: "2026-10-10", patient: "LUZ", medicalRecordNumber: "103060", status: "emitida",
  paymentMethods: "", base: 100, discount: 0, tax: { total: 0, components: [] }, total: 100, exonerated: true,
  exoneratedBase: 100, taxWouldBe: due, invoice: { subtotal: 100, discount: 0, shipping: 0, total: 100 },
};
const H = { number: "N", date: "D", record: "R", patient: "P", subtotal: "S", discount: "Ds", shipping: "E", total: "T", exoneratedBase: "B", status: "St", payment: "Pg" };

test("due-IVU columns come from the data, highest rate first", () => {
  assert.deepEqual(dueTaxColumns(null, [inv]).map((c) => c.name), ["Estatal", "Municipal"]);
  assert.deepEqual(dueTaxColumns({ total: 0, components: [] }, []), []);
});

test("CSV: header + one row per invoice, component columns in order", () => {
  const rows = exoneratedCsvRows([inv], dueTaxColumns(due, [inv]), H);
  assert.deepEqual(rows[0], ["N", "D", "R", "P", "S", "Ds", "E", "T", "B", "Estatal", "Municipal", "St", "Pg"]);
  assert.deepEqual(rows[1], ["000429", "2026-10-10", "103060", "LUZ", 100, 0, 0, 100, 100, 10.5, 1, "emitida", ""]);
});
