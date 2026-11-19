// lib/personal/staff-clinics.ts. Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { clinicNamesOf } from "./staff-clinics.ts";

test("a person serving in two clinics shows both", () => {
  assert.deepEqual(
    clinicNamesOf({
      clinicName: "Bayamón",
      servesInCenters: [{ clinicId: "bay", clinicName: "Bayamón" }, { clinicId: "cag", clinicName: "Caguas" }],
    }),
    ["Bayamón", "Caguas"],
  );
});

test("no service clinics in the scope: the home clinic", () => {
  assert.deepEqual(clinicNamesOf({ clinicName: "Caguas", servesInCenters: [] }), ["Caguas"]);
  assert.deepEqual(clinicNamesOf({ clinicName: "Caguas" }), ["Caguas"]);
});

test("nothing named: no badges", () => {
  assert.deepEqual(clinicNamesOf({ clinicName: null, servesInCenters: [{ clinicId: "x", clinicName: null }] }), []);
});
