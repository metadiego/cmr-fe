import { test } from "node:test";
import assert from "node:assert/strict";

import { reopenMissing } from "./reopen-missing.ts";

test("reopenMissing: blank reason → listed", () => {
  assert.deepEqual(reopenMissing({ reason: "" }), ["reason"]);
  assert.deepEqual(reopenMissing({ reason: "  \n " }), ["reason"]);
});
test("reopenMissing: reason present → []", () => {
  assert.deepEqual(reopenMissing({ reason: "wrong price on line 2" }), []);
});
