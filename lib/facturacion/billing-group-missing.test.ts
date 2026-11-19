import { test } from "node:test";
import assert from "node:assert/strict";

import { newBillingFieldMissing, newBillingGroupMissing } from "./billing-group-missing.ts";

test("newBillingGroupMissing: blank key → listed", () => {
  assert.deepEqual(newBillingGroupMissing({ key: "  " }), ["key"]);
});
test("newBillingGroupMissing: key present → []", () => {
  assert.deepEqual(newBillingGroupMissing({ key: "laser" }), []);
});
test("newBillingFieldMissing: blank name → listed", () => {
  assert.deepEqual(newBillingFieldMissing({ name: "" }), ["name"]);
});
test("newBillingFieldMissing: name present → []", () => {
  assert.deepEqual(newBillingFieldMissing({ name: "Áreas" }), []);
});
