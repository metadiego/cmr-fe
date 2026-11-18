import { test } from "node:test";
import assert from "node:assert/strict";

import { last30Days, lineTotal, receiptTotals } from "./receipts.ts";

test("last30Days: 30 days counting today, across a month edge", () => {
  assert.deepEqual(last30Days("2026-11-18"), { from: "2026-10-20", to: "2026-11-18" });
  assert.deepEqual(last30Days("2026-03-01"), { from: "2026-01-31", to: "2026-03-01" });
});

test("lineTotal: null without cost, cents-rounded with it", () => {
  assert.equal(lineTotal(6, null), null);
  assert.equal(lineTotal(3, 0.1), 0.3);
  assert.equal(lineTotal(848, 0), 0);
});

test("receiptTotals: sums lines and units; cost only from rows that have one", () => {
  assert.deepEqual(
    receiptTotals([
      { lines: 6, units: 848, totalCost: null },
      { lines: 2, units: 10, totalCost: 125.5 },
    ]),
    { receipts: 2, lines: 8, units: 858, totalCost: 125.5 },
  );
  assert.equal(receiptTotals([{ lines: 1, units: 1, totalCost: null }]).totalCost, null);
  assert.deepEqual(receiptTotals([]), { receipts: 0, lines: 0, units: 0, totalCost: null });
});
