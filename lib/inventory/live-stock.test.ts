import { test } from "node:test";
import assert from "node:assert/strict";

import { groupPadsByDevice, isStale, latestReading, liveForRows, liveIndex, matchesQuery, STALE_AFTER_MS } from "./live-stock.ts";

const NOW = Date.parse("2026-10-27T17:00:00.000Z");

test("a reading older than 24 h is stale; a fresh one or an unparseable date is not", () => {
  assert.equal(isStale(new Date(NOW - STALE_AFTER_MS - 1).toISOString(), NOW), true);
  assert.equal(isStale(new Date(NOW - 60_000).toISOString(), NOW), false);
  assert.equal(isStale("not a date", NOW), false);
});

test("latestReading picks the newest measuredAt, null when empty", () => {
  assert.equal(latestReading([]), null);
  assert.equal(
    latestReading([
      { measuredAt: "2026-10-27T15:07:43.000Z" },
      { measuredAt: "2026-10-27T17:07:43.000Z" },
      { measuredAt: "2026-10-26T17:07:43.000Z" },
    ]),
    "2026-10-27T17:07:43.000Z",
  );
});

test("pads group by scale, scales alphabetical, pads by number; empty pads are kept", () => {
  const groups = groupPadsByDevice([
    { deviceId: "scale-2", pad: 1, units: 3 },
    { deviceId: "scale-1", pad: 3, units: 0 },
    { deviceId: "scale-1", pad: 1, units: 12 },
  ]);
  assert.deepEqual(
    groups.map((g) => [g.deviceId, g.pads.map((p) => p.pad)]),
    [
      ["scale-1", [1, 3]],
      ["scale-2", [1]],
    ],
  );
  assert.equal(groups[0].pads[1].units, 0);
});

test("matchesQuery searches SKU and name ignoring case and accents", () => {
  const p = { sku: "VALERI120", productName: "VALERIANA OFFICINALIS — 120 cápsulas" };
  assert.equal(matchesQuery(p, ""), true);
  assert.equal(matchesQuery(p, "valeri"), true);
  assert.equal(matchesQuery(p, "capsulas"), true);
  assert.equal(matchesQuery(p, "easy"), false);
  assert.equal(matchesQuery({ sku: null, productName: null }, "x"), false);
});

test("liveForRows: live goes on the first lot row of a product+warehouse only, never repeated", () => {
  const idx = liveIndex([
    { warehouseId: "w1", products: [{ productId: "p1", liveUnits: 59, doubtful: false, byPad: [{ measuredAt: "2026-10-28T17:00:00.000Z" }] }] },
    { warehouseId: "w2", products: [{ productId: "p1", liveUnits: 3, doubtful: true, byPad: [{ measuredAt: "2026-10-28T16:00:00.000Z" }] }] },
  ]);
  const cells = liveForRows(
    [
      { productId: "p1", warehouseId: "w1" },
      { productId: "p1", warehouseId: "w1" },
      { productId: "p2", warehouseId: "w1" },
      { productId: "p1", warehouseId: "w2" },
    ],
    idx,
  );
  assert.deepEqual(cells.map((c) => c?.units ?? null), [59, null, null, 3]);
  assert.equal(cells[3]?.doubtful, true);
});

test("liveForRows: a row without warehouse combines the product across warehouses, once", () => {
  const idx = liveIndex([
    { warehouseId: "w1", products: [{ productId: "p1", liveUnits: 5, doubtful: false, byPad: [{ measuredAt: "2026-10-28T10:00:00.000Z" }] }] },
    { warehouseId: "w2", products: [{ productId: "p1", liveUnits: 2, doubtful: true, byPad: [{ measuredAt: "2026-10-28T12:00:00.000Z" }] }] },
  ]);
  const cells = liveForRows([{ productId: "p1", warehouseId: null }, { productId: "p1", warehouseId: null }], idx);
  assert.deepEqual(cells[0], { units: 7, doubtful: true, measuredAt: "2026-10-28T12:00:00.000Z" });
  assert.equal(cells[1], null);
});
