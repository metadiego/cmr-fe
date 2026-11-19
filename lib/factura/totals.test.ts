import { test } from "node:test";
import assert from "node:assert/strict";

import { line, readTotals } from "./totals.ts";

// L006875 as GET /api/v2/invoices/:id returns it on prod (10-nov, after BE #536).
const l006875 = {
  totals: {
    lines: [
      { key: "subtotal", labelKey: "invoice.totals.subtotal", amount: 9240 },
      { key: "discount", labelKey: "invoice.totals.discount", amount: -2880 },
      { key: "tax", labelKey: "invoice.totals.tax", amount: 0 },
      { key: "shipping", labelKey: "invoice.totals.shipping", amount: 0 },
      { key: "total", labelKey: "invoice.totals.total", amount: 6360 },
      { key: "paid", labelKey: "invoice.totals.paid", amount: 6360 },
      { key: "refunded", labelKey: "invoice.totals.refunded", amount: -6360 },
      { key: "balance", labelKey: "invoice.totals.balance", amount: 0 },
    ],
    moves: [
      { kind: "payment", labelKey: "invoice.totals.payment", method: "Care Credit", amount: 6360, date: "2026-07-08", refundId: null },
      { kind: "refund", labelKey: "invoice.totals.refund", method: "Care Credit", amount: -6360, date: "2026-11-10", refundId: "47a44509" },
    ],
    fullyReturned: true,
  },
};

test("a fully refunded invoice owes 0, and the refund is a negative move", () => {
  const t = readTotals(l006875);
  assert.equal(line(t, "balance"), 0);
  assert.equal(line(t, "refunded"), -6360);
  assert.equal(line(t, "total"), 6360);
  assert.equal(t?.fullyReturned, true);
  assert.deepEqual(t?.moves.map((m) => [m.kind, m.amount]), [["payment", 6360], ["refund", -6360]]);
});

test("no block → null, so the screen keeps its previous source", () => {
  assert.equal(readTotals({}), null);
  assert.equal(readTotals({ totals: { lines: [] } }), null);
  assert.equal(line(null, "balance"), null);
});
