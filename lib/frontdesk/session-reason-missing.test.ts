import { test } from "node:test";
import assert from "node:assert/strict";

import { sessionReasonMissing } from "./session-reason-missing.ts";

test("sessionReasonMissing: blank reason → listed", () => {
  assert.deepEqual(sessionReasonMissing({ reason: "" }), ["reason"]);
  assert.deepEqual(sessionReasonMissing({ reason: "   " }), ["reason"]);
});
test("sessionReasonMissing: reason present → []", () => {
  assert.deepEqual(sessionReasonMissing({ reason: "patient called" }), []);
});
