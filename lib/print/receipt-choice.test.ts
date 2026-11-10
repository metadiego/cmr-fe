import { test } from "node:test";
import assert from "node:assert/strict";

import { defaultReceipt, receiptUrl, refundsNewestFirst } from "./receipt-choice.ts";

test("the latest live refund is the default; no refunds → the invoice", () => {
  const rows = [
    { id: "r1", displayNumber: "D-000020", date: "2026-11-01", status: "activa" },
    { id: "r2", displayNumber: "D-000026", date: "2026-11-10", status: "activa" },
  ];
  assert.equal(defaultReceipt(rows), "r2");
  assert.equal(defaultReceipt([]), "");
});

test("a voided refund sorts last and is never the default", () => {
  const rows = [
    { id: "v", date: "2026-11-10", status: "anulada" },
    { id: "a", date: "2026-11-05", status: "activa" },
  ];
  assert.deepEqual(refundsNewestFirst(rows).map((r) => r.id), ["a", "v"]);
  assert.equal(defaultReceipt([{ id: "v", status: "anulada" }]), "");
});

test("receiptUrl: the refund page or the invoice page", () => {
  assert.equal(receiptUrl("inv", "ref"), "/print/refund/inv/ref");
  assert.equal(receiptUrl("inv", ""), "/print/invoice/inv");
});
