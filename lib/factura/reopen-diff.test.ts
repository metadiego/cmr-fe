import { test } from "node:test";
import assert from "node:assert/strict";
import { diffInvoice, reopeningChanges, type DiffInvoice } from "./reopen-diff.ts";

// Shaped like the real snapshot of test invoice 000399 (Bayamón, 2026-10-08): exonerated by mistake.
const issued: DiffInvoice = {
  date: "2026-10-08",
  total: 0,
  discount: 0,
  exempt: false,
  items: [{ id: "l1", productId: "p1", description: "Exonerada", quantity: 1, unitPrice: 0, total: 0 }],
  payments: [],
};

test("the owner's case: exonerated by mistake, the patient pays 10 dollars", () => {
  const now: DiffInvoice = {
    ...issued,
    total: 10,
    items: [{ id: "l1", productId: "p1", description: "Consulta", quantity: 1, unitPrice: 10, total: 10 }],
    payments: [{ id: "pay1", amount: 10, formaPagoNombre: "Efectivo" }],
  };
  assert.deepEqual(diffInvoice(issued, now), [
    { kind: "header", field: "total", before: 0, after: 10 },
    { kind: "lineChanged", description: "Consulta", before: { quantity: 1, unitPrice: 0, total: 0 }, after: { quantity: 1, unitPrice: 10, total: 10 } },
    { kind: "paymentAdded", method: "Efectivo", amount: 10 },
  ]);
});

test("moving the date, adding and removing lines, changing the payment method", () => {
  const before: DiffInvoice = {
    date: "2026-10-08",
    total: 50,
    items: [{ id: "a", description: "Vitamina C", quantity: 1, unitPrice: 50, total: 50 }],
    payments: [{ id: "p1", amount: "50.00", formaPagoNombre: "Efectivo" }],
  };
  const after: DiffInvoice = {
    date: "2026-10-07",
    total: 50,
    items: [{ id: "b", description: "Glutatión", quantity: 1, unitPrice: 50, total: 50 }],
    payments: [{ id: "p2", amount: 50, formaPagoNombre: "ATH Móvil" }],
  };
  assert.deepEqual(diffInvoice(before, after), [
    { kind: "header", field: "date", before: "2026-10-08", after: "2026-10-07" },
    { kind: "lineRemoved", description: "Vitamina C", quantity: 1, total: 50 },
    { kind: "lineAdded", description: "Glutatión", quantity: 1, total: 50 },
    { kind: "paymentRemoved", method: "Efectivo", amount: 50 },
    { kind: "paymentAdded", method: "ATH Móvil", amount: 50 },
  ]);
});

test("nothing changed → no changes (string amounts from the API count as equal numbers)", () => {
  const same = { ...issued, total: "0.00", items: [{ ...issued.items![0], unitPrice: "0" }] };
  assert.deepEqual(diffInvoice(issued, same), []);
});

test("refunds belong to returns, not to the correction", () => {
  const after = { ...issued, payments: [{ id: "r1", amount: 5, type: "reembolso" }] };
  assert.deepEqual(diffInvoice(issued, after), []);
});

test("exempt toggled and global discount changed", () => {
  assert.deepEqual(diffInvoice({ ...issued, discount: 0 }, { ...issued, discount: 5, exempt: true }), [
    { kind: "header", field: "discount", before: 0, after: 5 },
    { kind: "header", field: "exempt", before: false, after: true },
  ]);
});

test("each reopening is compared with what came right after it, newest first", () => {
  const first: DiffInvoice = { ...issued, total: 0 }; // older
  const second: DiffInvoice = { ...issued, total: 10 }; // newer
  const now: DiffInvoice = { ...issued, total: 12 };
  const [newest, oldest] = reopeningChanges([second, first], now);
  assert.deepEqual(newest, [{ kind: "header", field: "total", before: 10, after: 12 }]);
  assert.deepEqual(oldest, [{ kind: "header", field: "total", before: 0, after: 10 }]);
});
