// Patient display name (lib/pacientes/display-name.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { patientName } from "./display-name.ts";

test("patientName prefers the BE displayName, else joins first and last name", () => {
  assert.equal(patientName({ firstName: "Ana", lastName: "Ruiz", displayName: "Ana M. Ruiz" }), "Ana M. Ruiz");
  assert.equal(patientName({ firstName: "Ana", lastName: "Ruiz" }), "Ana Ruiz");
  assert.equal(patientName({ firstName: "Ana", lastName: null, displayName: "" }), "Ana");
});
