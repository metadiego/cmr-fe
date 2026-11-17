import { test } from "node:test";
import assert from "node:assert/strict";

import { voidReasonMissing } from "./void-reason-missing.ts";

test("voidReasonMissing: blank reason → listed", () => {
  assert.deepEqual(voidReasonMissing({ reason: "" }), ["reason"]);
  assert.deepEqual(voidReasonMissing({ reason: " \t " }), ["reason"]);
});
test("voidReasonMissing: reason present → []", () => {
  assert.deepEqual(voidReasonMissing({ reason: "duplicated invoice" }), []);
});
