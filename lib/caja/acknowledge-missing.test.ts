import { test } from "node:test";
import assert from "node:assert/strict";

import { acknowledgeInvalid, acknowledgeMissing } from "./acknowledge-missing.ts";

test("acknowledgeMissing: blank reason → listed", () => {
  assert.deepEqual(acknowledgeMissing({ reason: "" }), ["reason"]);
  assert.deepEqual(acknowledgeMissing({ reason: " \n " }), ["reason"]);
});
test("acknowledgeMissing: reason present → []", () => {
  assert.deepEqual(acknowledgeMissing({ reason: "late phone sale" }), []);
});
test("acknowledgeInvalid: 1–2 characters after trim → reasonTooShort (not missing)", () => {
  assert.equal(acknowledgeInvalid({ reason: " ab " }), "reasonTooShort");
  assert.deepEqual(acknowledgeMissing({ reason: " ab " }), []);
});
test("acknowledgeInvalid: blank is left to missing; 3+ characters is fine", () => {
  assert.equal(acknowledgeInvalid({ reason: "  " }), null);
  assert.equal(acknowledgeInvalid({ reason: "abc" }), null);
});
