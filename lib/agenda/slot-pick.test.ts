import { test } from "node:test";
import assert from "node:assert/strict";

import { slotPickable, slotWarns } from "./slot-pick.ts";

test("a slot that fits is pickable and does not warn", () => {
  assert.equal(slotPickable({ fits: true }), true);
  assert.equal(slotWarns({ fits: true }), false);
});

test("full for capacity, staff or the sheet: pickable, with a warning (intravenoso, Caguas, 10-nov)", () => {
  for (const reasonKey of ["therapies.full", "therapies.noStaff", "therapies.sheetFull"]) {
    assert.equal(slotPickable({ fits: false, reasonKey }), true, reasonKey);
    assert.equal(slotWarns({ fits: false, reasonKey }), true, reasonKey);
  }
});

test("the real rules keep blocking", () => {
  for (const reasonKey of ["therapies.trainPastClosing", "therapies.holiday", "therapies.notAStartTime", "therapies.overMaxPerPatient", null]) {
    assert.equal(slotPickable({ fits: false, reasonKey }), false, String(reasonKey));
  }
});

test("BE #547: `selectable` wins over the old heuristic, both ways", () => {
  // A center turned off the capacity rule — BE allows a non-full reason to still be picked.
  assert.equal(slotPickable({ fits: false, reasonKey: "therapies.notAStartTime", selectable: true }), true);
  assert.equal(slotWarns({ fits: false, reasonKey: "therapies.notAStartTime", selectable: true }), true);
  // A center turned ON a rule the old list would have waved through.
  assert.equal(slotPickable({ fits: false, reasonKey: "therapies.full", selectable: false }), false);
});

test("no `selectable` on the payload (older/unknown shape): falls back to the fixed list, never disables by default", () => {
  assert.equal(slotPickable({ fits: false, reasonKey: "therapies.sheetFull" }), true);
  assert.equal(slotPickable({ fits: false, reasonKey: "therapies.holiday" }), false);
});
