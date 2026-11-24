import { test } from "node:test";
import assert from "node:assert/strict";

import { pendingAreas, toggleSealedUnits } from "./protocol-change-origin.ts";

test("pending areas: 7 pending of a 6-area HILT session are 42", () => {
  assert.deepEqual(pendingAreas({ pendiente: 7, areasPerSession: 6 }), { perSession: 6, pending: 42 });
  assert.deepEqual(pendingAreas({ pendiente: null, areasPerSession: 6 }), { perSession: 6, pending: 0 });
});

test("no areas line when the BE does not know them", () => {
  assert.equal(pendingAreas({ pendiente: 7, areasPerSession: null }), null);
  assert.equal(pendingAreas({ pendiente: 7 }), null);
  assert.equal(pendingAreas({ pendiente: 7, areasPerSession: 0 }), null);
});

test("ticking prefills the pending count; unticking clears it", () => {
  const on = toggleSealedUnits({}, "mls", true, 7);
  assert.deepEqual(on, { mls: "7" });
  assert.deepEqual(toggleSealedUnits(on, "mls", false, 7), {});
});

test("ticking never overwrites what the person typed", () => {
  assert.deepEqual(toggleSealedUnits({ mls: "0" }, "mls", true, 7), { mls: "0" });
  assert.deepEqual(toggleSealedUnits({ mls: " " }, "mls", true, 7), { mls: "7" });
  assert.deepEqual(toggleSealedUnits({ hilt: "2" }, "mls", true, null), { hilt: "2", mls: "0" });
});
