// Which centers the patient list shows (lib/pacientes/center-scope.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { patientCenterScope, patientRecordHref } from "./center-scope.ts";

test("access to both clinics: both by default, with the filter and the clinic column", () => {
  assert.deepEqual(patientCenterScope(["bay", "cag"], null), {
    centerIds: ["bay", "cag"],
    showFilter: true,
    showColumn: true,
  });
});

test("filtered to one clinic: only it, the filter stays, the column goes (every row would say the same)", () => {
  assert.deepEqual(patientCenterScope(["bay", "cag"], ["cag"]), {
    centerIds: ["cag"],
    showFilter: true,
    showColumn: false,
  });
});

test("access to one clinic only: pre-filtered to it, no filter, no column", () => {
  assert.deepEqual(patientCenterScope(["bay"], null), {
    centerIds: ["bay"],
    showFilter: false,
    showColumn: false,
  });
});

test("a selection that no longer applies (empty, or centers without access) falls back to all", () => {
  assert.deepEqual(patientCenterScope(["bay", "cag"], []).centerIds, ["bay", "cag"]);
  assert.deepEqual(patientCenterScope(["bay", "cag"], ["pon"]).centerIds, ["bay", "cag"]);
  assert.deepEqual(patientCenterScope(["bay", "cag"], ["cag", "pon"]).centerIds, ["cag"]);
});

test("centers not known yet: nothing requested, the BE uses the session center", () => {
  assert.deepEqual(patientCenterScope([], null), { centerIds: undefined, showFilter: false, showColumn: false });
});

test("a patient of another clinic opens with ?centro=, so the record is looked up there", () => {
  assert.equal(patientRecordHref({ id: "p1", clinicId: "cag" }, "bay"), "/patients/p1?centro=cag");
  assert.equal(patientRecordHref({ id: "p1", clinicId: "bay" }, "bay"), "/patients/p1");
  assert.equal(patientRecordHref({ id: "p1", clinicId: null }, "bay"), "/patients/p1");
  assert.equal(patientRecordHref({ id: "p1", clinicId: "cag" }, null), "/patients/p1?centro=cag");
});
