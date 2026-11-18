import { test } from "node:test";
import assert from "node:assert/strict";

import { dailyCsv, movementsCsv, ownerCsv } from "./kardex-csv.ts";
import type { KardexSummary } from "../api/inventory-kardex.ts";

const t = (k: string, v?: Record<string, string | number>) => (v ? `${k}(${Object.values(v).join(",")})` : k);
const reason = (r: string | null) => r ?? "";
const product = { id: "p", sku: "vitacintra", name: "VITAMINA C", capacity: 25 };

test("dailyCsv: proportion column only when the product has a capacity", () => {
  const day = { date: "2026-11-04", opening: 103, inbound: 0, applied: 16, appliedProportion: 15.6, adjustments: 52, closing: 139 };
  const rows = dailyCsv({ product, days: [day] }, t);
  assert.equal(rows[0].length, 7);
  assert.deepEqual(rows[1], ["2026-11-04", 103, 0, 16, 15.6, 52, 139]);
  assert.equal(dailyCsv({ product: { ...product, capacity: null }, days: [day] }, t)[0].length, 6);
  assert.deepEqual(dailyCsv(null, t), []);
});

const summary: KardexSummary = {
  product, from: "2026-10-01", to: "2026-10-31", opening: 158, applied: 383, appliedProportion: null, closing: 133,
  lines: [],
  ownerFormat: {
    opening: 158,
    inbound: [{ date: "2026-10-02", supplier: "New Era", documentNumber: "t3912923CV", quantity: 100, notes: null }],
    manualOutputs: [{ date: "2026-10-20", reason: "merma", adjustmentNumber: 6066, quantity: -1, notes: null }],
    appliedNet: 383, appliedProportion: null, correctionsNet: 0, corrections: [], closing: 133,
    closingBySupplier: [{ supplier: null, quantity: 133 }],
  },
};

test("ownerCsv: opening, inbound with supplier and #, manual output positive, no corrections row at 0", () => {
  const rows = ownerCsv(summary, t, reason);
  assert.deepEqual(rows[1], ["owner.opening", 158]);
  assert.equal(rows[2][0], "owner.inbound(2026-10-02) · New Era · owner.transfer # t3912923CV");
  assert.deepEqual(rows[3], ["merma · owner.adjustment # 6066 · 2026-10-20", 1]);
  assert.ok(!rows.some((r) => r[0] === "owner.corrections"));
  assert.deepEqual(rows.at(-1), ["owner.observations owner.noSupplier", 133]);
  assert.deepEqual(ownerCsv({ ...summary, ownerFormat: undefined }, t, reason), []);
});

test("movementsCsv: applied goes out negative", () => {
  const rows = movementsCsv(summary, t, reason);
  assert.deepEqual(rows.at(-2), ["2026-10-31", "summary.applied(2026-10-31)", "", "", -383]);
});
