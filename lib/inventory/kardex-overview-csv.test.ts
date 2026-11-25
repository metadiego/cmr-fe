import { test } from "node:test";
import assert from "node:assert/strict";

import { overviewCsv } from "./kardex-overview-csv.ts";
import type { OverviewTableGroup } from "./kardex-overview.ts";

const t = Object.assign((k: string, v?: Record<string, string | number>) => (v ? `${k}(${Object.values(v).join(",")})` : k), {
  has: (k: string) => k === "overview.group.a_la_entrega",
});

const totals = { opening: 5, inbound: 2, applied: 1, manualOutputs: 0, adjustments: 0, closing: 6, pending: 3, physical: 9, freeStock: 6 };

const groups: OverviewTableGroup[] = [
  {
    deductionMode: "a_la_entrega",
    totals,
    products: [{ productId: "p1", sku: "NANO", name: "Nano Aer Plus", deductionMode: "a_la_entrega", ...totals }],
  },
];

test("overviewCsv: header, one row per product, then the group's own BE totals", () => {
  const rows = overviewCsv(groups, t);
  assert.deepEqual(rows[0], [
    "overview.col.sku",
    "overview.col.product",
    "overview.col.opening",
    "overview.col.inbound",
    "overview.col.applied",
    "overview.col.manualOutputs",
    "overview.col.adjustments",
    "overview.col.closing",
    "overview.col.pending",
    "overview.col.physical",
    "overview.col.freeStock",
  ]);
  assert.deepEqual(rows[1], ["NANO", "Nano Aer Plus", 5, 2, 1, 0, 0, 6, 3, 9, 6]);
  assert.deepEqual(rows[2], ["overview.group.a_la_entrega", "", 5, 2, 1, 0, 0, 6, 3, 9, 6]);
});

test("overviewCsv: no groups gives only the header", () => {
  assert.equal(overviewCsv([], t).length, 1);
});
