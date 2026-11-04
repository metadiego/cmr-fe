// Reads across clinics (lib/clinic-read-scope.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { readCenterIds, spansClinics } from "./clinic-read-scope.ts";

test("a screen's picked center is sent as centerIds, so the read does not depend on the BE default", () => {
  assert.deepEqual(readCenterIds("cag", undefined), ["cag"]);
});

test("explicit centerIds win over the picked center", () => {
  assert.deepEqual(readCenterIds("cag", ["bay", "cag"]), ["bay", "cag"]);
});

test("nothing picked and nothing asked: nothing sent", () => {
  assert.equal(readCenterIds(undefined, undefined), undefined);
  assert.equal(readCenterIds(undefined, []), undefined);
});

test("rows from two clinics span clinics; one clinic, or rows without a clinic, do not", () => {
  assert.equal(spansClinics([{ clinicId: "bay" }, { clinicId: "cag" }]), true);
  assert.equal(spansClinics([{ clinicId: "bay" }, { clinicId: "bay" }]), false);
  assert.equal(spansClinics([{ clinicId: "bay" }, { clinicId: null }, {}]), false);
  assert.equal(spansClinics([]), false);
});
