import { test } from "node:test";
import assert from "node:assert/strict";

import { attachmentDeleteInvalid, attachmentDeleteMissing } from "./attachment-delete-missing.ts";

test("attachmentDeleteMissing: blank reason → listed", () => {
  assert.deepEqual(attachmentDeleteMissing({ reason: "" }), ["reason"]);
  assert.deepEqual(attachmentDeleteMissing({ reason: "   " }), ["reason"]);
});
test("attachmentDeleteMissing: reason present → []", () => {
  assert.deepEqual(attachmentDeleteMissing({ reason: "duplicate scan" }), []);
});
test("attachmentDeleteInvalid: 1–2 characters after trim → reasonTooShort (not missing)", () => {
  assert.equal(attachmentDeleteInvalid({ reason: " x " }), "reasonTooShort");
  assert.deepEqual(attachmentDeleteMissing({ reason: " x " }), []);
});
test("attachmentDeleteInvalid: blank is left to missing; 3+ characters is fine", () => {
  assert.equal(attachmentDeleteInvalid({ reason: "" }), null);
  assert.equal(attachmentDeleteInvalid({ reason: "dup" }), null);
});
