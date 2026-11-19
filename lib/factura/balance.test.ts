import { test } from "node:test";
import assert from "node:assert/strict";

import { invoiceBalance } from "./balance.ts";

test("a refunded invoice owes nothing (L006875: total 6360, paid back 6360)", () => {
  assert.equal(invoiceBalance("devuelta_total", 6360, 0), 0);
  assert.equal(invoiceBalance("devuelta_parcial", 600, 300), 0);
});

test("otherwise total − paid, to the cent", () => {
  assert.equal(invoiceBalance("emitida", 201.92, 100), 101.92);
  assert.equal(invoiceBalance("borrador", 0.3, 0.1), 0.2);
  assert.equal(invoiceBalance("emitida", 100, 120), -20, "over-paid stays visible");
});
