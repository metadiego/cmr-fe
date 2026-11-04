// Which centers the patient list shows (lib/pacientes/center-scope.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { patientCenterScope, patientRecordHref } from "./center-scope.ts";

test("access to both clinics, no filter: nothing sent (the BE reads both), filter shown, column from the response", () => {
  assert.deepEqual(patientCenterScope(["bay", "cag"], null, ["bay", "cag"]), {
    centerIds: undefined,
    showFilter: true,
    showColumn: true,
  });
});

test("filtered to one clinic: only it, the filter stays, the column goes (every row would say the same)", () => {
  assert.deepEqual(patientCenterScope(["bay", "cag"], ["cag"], ["cag"]), {
    centerIds: ["cag"],
    showFilter: true,
    showColumn: false,
  });
});

test("access to one clinic only: no filter, no column", () => {
  assert.deepEqual(patientCenterScope(["bay"], null, ["bay"]), {
    centerIds: undefined,
    showFilter: false,
    showColumn: false,
  });
});

test("a selection that no longer applies (empty, or centers without access) falls back to all", () => {
  assert.equal(patientCenterScope(["bay", "cag"], [], undefined).centerIds, undefined);
  assert.equal(patientCenterScope(["bay", "cag"], ["pon"], undefined).centerIds, undefined);
  assert.deepEqual(patientCenterScope(["bay", "cag"], ["cag", "pon"], undefined).centerIds, ["cag"]);
});

test("the list does not wait for the clinic list: unknown clinics send nothing, the column follows the response", () => {
  assert.deepEqual(patientCenterScope([], null, ["bay", "cag"]), { centerIds: undefined, showFilter: false, showColumn: true });
  assert.deepEqual(patientCenterScope([], null, undefined), { centerIds: undefined, showFilter: false, showColumn: false });
});

test("a record opens by id alone, from any clinic the person can read", () => {
  assert.equal(patientRecordHref({ id: "p1" }), "/patients/p1");
});
