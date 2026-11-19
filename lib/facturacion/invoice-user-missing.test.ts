import { test } from "node:test";
import assert from "node:assert/strict";

import { invoiceUserMissing } from "./invoice-user-missing.ts";

test("invoiceUserMissing: no user picked → listed", () => {
  assert.deepEqual(invoiceUserMissing({ userId: "" }), ["user"]);
  assert.deepEqual(invoiceUserMissing({ userId: null }), ["user"]);
  assert.deepEqual(invoiceUserMissing({ userId: undefined }), ["user"]);
});
test("invoiceUserMissing: user picked → []", () => {
  assert.deepEqual(invoiceUserMissing({ userId: "3f2a-profile-id" }), []);
});
