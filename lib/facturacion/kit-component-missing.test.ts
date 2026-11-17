import { test } from "node:test";
import assert from "node:assert/strict";

import { kitComponentInvalid, kitComponentMissing } from "./kit-component-missing.ts";

test("kitComponentMissing: no component picked → listed", () => {
  assert.deepEqual(kitComponentMissing({ componentId: "", reason: "left out" }), ["component"]);
});
test("kitComponentMissing: blank reason → listed", () => {
  assert.deepEqual(kitComponentMissing({ componentId: "c1", reason: "   " }), ["reason"]);
});
test("kitComponentMissing: both empty → in on-screen order", () => {
  assert.deepEqual(kitComponentMissing({ componentId: "", reason: "" }), ["component", "reason"]);
});
test("kitComponentMissing: all present → []", () => {
  assert.deepEqual(kitComponentMissing({ componentId: "c1", reason: "left out" }), []);
});
test("kitComponentInvalid: 1–2 characters after trim → reasonTooShort (not missing)", () => {
  assert.equal(kitComponentInvalid({ reason: " ab " }), "reasonTooShort");
  assert.deepEqual(kitComponentMissing({ componentId: "c1", reason: " ab " }), []);
});
test("kitComponentInvalid: blank is left to missing; 3+ characters is fine", () => {
  assert.equal(kitComponentInvalid({ reason: "  " }), null);
  assert.equal(kitComponentInvalid({ reason: "abc" }), null);
});
