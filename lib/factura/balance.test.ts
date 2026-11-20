import { test } from "node:test";
import assert from "node:assert/strict";

import { invoiceBalance } from "./balance.ts";

// cmr-be #650: the status no longer zeroes the balance. The callers take `totals`' balance line first
// (L007119, devuelta_total: total 3720, paid 3720, refunded −3720, balance 0); this fallback is plain math.
test("a refund status no longer zeroes the fallback balance (totals' balance line is the source)", () => {
  assert.equal(invoiceBalance("devuelta_total", 3720, 3720), 0);
  assert.equal(invoiceBalance("devuelta_parcial", 600, 300), 300);
});

test("otherwise total − paid, to the cent", () => {
  assert.equal(invoiceBalance("emitida", 201.92, 100), 101.92);
  assert.equal(invoiceBalance("borrador", 0.3, 0.1), 0.2);
  assert.equal(invoiceBalance("emitida", 100, 120), -20, "over-paid stays visible");
});
