// Which centers the patient list shows (lib/pacientes/center-scope.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { patientRecordHref } from "./center-scope.ts";

test("a record opens by id alone, from any clinic the person can read", () => {
  assert.equal(patientRecordHref({ id: "p1" }), "/patients/p1");
});
