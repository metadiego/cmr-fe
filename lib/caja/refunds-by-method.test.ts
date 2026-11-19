import { test } from "node:test";
import assert from "node:assert/strict";

import { refundSplit } from "./refunds-by-method.ts";

test("Care Credit on Caguas 10-nov: nothing charged, 6960 refunded, net −6960", () => {
  assert.deepEqual(refundSplit({ amount: -6960, sales: 0, refunds: 6960 }), { sales: 0, refunds: 6960 });
});

test("a method without refunds, or an older BE without the split: no note", () => {
  assert.equal(refundSplit({ amount: 5731.72, sales: 5731.72, refunds: 0 }), null);
  assert.equal(refundSplit({ amount: 90 }), null);
});
