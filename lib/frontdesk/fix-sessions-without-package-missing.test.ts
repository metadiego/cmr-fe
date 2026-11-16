import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fixSessionsWithoutPackageInvalid,
  fixSessionsWithoutPackageMissing,
} from "./fix-sessions-without-package-missing.ts";

const base = { sessions: "12", needsProduct: false, productId: "" };

test("fixSessionsWithoutPackageMissing: empty total sessions → listed", () => {
  assert.deepEqual(fixSessionsWithoutPackageMissing({ ...base, sessions: "  " }), ["sessions"]);
});
test("fixSessionsWithoutPackageMissing: group service without product → listed", () => {
  assert.deepEqual(fixSessionsWithoutPackageMissing({ ...base, needsProduct: true }), ["product"]);
  assert.deepEqual(fixSessionsWithoutPackageMissing({ ...base, sessions: "", needsProduct: true }), ["sessions", "product"]);
});
test("fixSessionsWithoutPackageMissing: all present → []", () => {
  assert.deepEqual(fixSessionsWithoutPackageMissing(base), []);
  assert.deepEqual(fixSessionsWithoutPackageMissing({ ...base, needsProduct: true, productId: "p1" }), []);
  assert.deepEqual(fixSessionsWithoutPackageMissing({ ...base, sessions: "0" }), []);
});
test("fixSessionsWithoutPackageInvalid: a negative total", () => {
  assert.equal(fixSessionsWithoutPackageInvalid({ ...base, sessions: "-1" }), "sessionsNegative");
  assert.equal(fixSessionsWithoutPackageInvalid({ ...base, sessions: "0" }), null);
  assert.equal(fixSessionsWithoutPackageInvalid({ ...base, sessions: "" }), null);
});
