import { test } from "node:test";
import assert from "node:assert/strict";

import { scanMissing } from "./scan-missing.ts";

test("scanMissing: no scanner → listed", () => {
  assert.deepEqual(scanMissing({ scannerId: "" }), ["scanner"]);
});
test("scanMissing: scanner picked → []", () => {
  assert.deepEqual(scanMissing({ scannerId: "s1" }), []);
});
