import { test } from "node:test";
import assert from "node:assert/strict";

import { customizeKitAddMissing } from "./customize-kit-missing.ts";

test("customizeKitAddMissing: no product → listed", () => {
  assert.deepEqual(customizeKitAddMissing({ productId: "" }), ["product"]);
});
test("customizeKitAddMissing: product picked → []", () => {
  assert.deepEqual(customizeKitAddMissing({ productId: "p1" }), []);
});
