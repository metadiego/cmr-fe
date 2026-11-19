import { test } from "node:test";
import assert from "node:assert/strict";

import { cancelMissing } from "./cancel-missing.ts";

test("cancelMissing: reason present → []", () => {
  assert.deepEqual(cancelMissing({ reason: "Patient asked" }), []);
});
test("cancelMissing: blank reason → reason listed", () => {
  assert.deepEqual(cancelMissing({ reason: "  " }), ["reason"]);
});
