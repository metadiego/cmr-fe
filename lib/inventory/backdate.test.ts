import { test } from "node:test";
import assert from "node:assert/strict";

import { backdateBlock, countMoved, datesDiffer, dayPR, isFutureDay, isPastDay, maxDaysCheck } from "./backdate.ts";

test("isPastDay / isFutureDay compare calendar days; empty is today", () => {
  assert.equal(isPastDay("2026-10-31", "2026-11-19"), true);
  assert.equal(isPastDay("2026-11-19", "2026-11-19"), false);
  assert.equal(isPastDay("", "2026-11-19"), false);
  assert.equal(isFutureDay("2026-11-20", "2026-11-19"), true);
});

test("dayPR / datesDiffer read instants in Puerto Rico", () => {
  // 02:00 UTC on the 20th is still the 19th in PR.
  assert.equal(dayPR("2026-11-20T02:00:00.000Z"), "2026-11-19");
  assert.equal(dayPR(null), null);
  assert.equal(datesDiffer("2026-10-31T16:00:00.000Z", "2026-11-19T15:00:00.000Z"), true);
  assert.equal(datesDiffer("2026-11-19T16:00:00.000Z", "2026-11-20T02:00:00.000Z"), false);
  assert.equal(datesDiffer(null, "2026-11-19T15:00:00.000Z"), false);
});

test("backdateBlock: today never blocks; past waits for the preview, then permission, then problems", () => {
  assert.equal(backdateBlock({ past: false, preview: null, loading: false }), null);
  assert.deepEqual(backdateBlock({ past: true, preview: null, loading: true }), { kind: "loading" });
  assert.deepEqual(backdateBlock({ past: true, preview: { canBackdate: false, problems: [] }, loading: false }), { kind: "forbidden" });
  assert.deepEqual(
    backdateBlock({ past: true, preview: { canBackdate: true, problems: [{ labelKey: "inventory.backdate.negativeBalance" }] }, loading: false }),
    { kind: "problem", labelKey: "inventory.backdate.negativeBalance" },
  );
  assert.equal(backdateBlock({ past: true, preview: { canBackdate: true, problems: [] }, loading: false }), null);
});

test("maxDaysCheck: whole numbers 0–366", () => {
  assert.deepEqual(maxDaysCheck(""), { filled: false, value: null, invalid: false });
  assert.deepEqual(maxDaysCheck("45"), { filled: true, value: 45, invalid: false });
  assert.deepEqual(maxDaysCheck("0"), { filled: true, value: 0, invalid: false });
  assert.equal(maxDaysCheck("367").invalid, true);
  assert.equal(maxDaysCheck("4.5").invalid, true);
});

test("countMoved reads netChange (cmr-be #647) and falls back to quantity; deltas can be negative", () => {
  assert.equal(countMoved({ netChange: -7728 }), -7728);
  assert.equal(countMoved({ quantity: 8050 }), 8050);
  assert.equal(countMoved({ netChange: 5, quantity: 9 }), 5);
});
