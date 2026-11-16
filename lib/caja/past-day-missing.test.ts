import { test } from "node:test";
import assert from "node:assert/strict";

import { pastDayMissing } from "./past-day-missing.ts";

test("pastDayMissing: blank reason → listed", () => {
  assert.deepEqual(pastDayMissing({ reason: "" }), ["reason"]);
  assert.deepEqual(pastDayMissing({ reason: "  " }), ["reason"]);
});
test("pastDayMissing: reason present → []", () => {
  assert.deepEqual(pastDayMissing({ reason: "card payment entered twice" }), []);
});
