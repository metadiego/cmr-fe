import { test } from "node:test";
import assert from "node:assert/strict";

import { shouldReset } from "./dialog-form.ts";

test("closed to open resets", () => {
  assert.equal(shouldReset({ open: false, key: 1 }, { open: true, key: 1 }), true);
});
test("open to open with the same key does not reset", () => {
  assert.equal(shouldReset({ open: true, key: 1 }, { open: true, key: 1 }), false);
});
test("open to closed does not reset", () => {
  assert.equal(shouldReset({ open: true, key: 1 }, { open: false, key: 1 }), false);
});
test("open to open with a different key resets", () => {
  assert.equal(shouldReset({ open: true, key: "A" }, { open: true, key: "B" }), true);
});
test("closed to closed with a changed key does not reset", () => {
  assert.equal(shouldReset({ open: false, key: "A" }, { open: false, key: "B" }), false);
});
