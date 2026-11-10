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
