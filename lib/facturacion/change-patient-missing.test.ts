import { test } from "node:test";
import assert from "node:assert/strict";

import { changePatientMissing } from "./change-patient-missing.ts";

test("changePatientMissing: no patient picked → listed", () => {
  assert.deepEqual(changePatientMissing({ patientId: null, reason: "wrong patient" }), ["patient"]);
});
test("changePatientMissing: blank reason → listed", () => {
  assert.deepEqual(changePatientMissing({ patientId: "680", reason: "  " }), ["reason"]);
});
test("changePatientMissing: both empty → in on-screen order", () => {
  assert.deepEqual(changePatientMissing({ patientId: null, reason: "" }), ["patient", "reason"]);
});
test("changePatientMissing: all present → []", () => {
  assert.deepEqual(changePatientMissing({ patientId: "680", reason: "wrong patient" }), []);
});
