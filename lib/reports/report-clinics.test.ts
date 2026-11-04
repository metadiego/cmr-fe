// Which clinics a report covers (lib/reports/report-clinics.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { clinicCoverage, reportClinicChoice, reportFilterSelection } from "./report-clinics.ts";

const BOTH = ["bay", "cag"];

test("without a link or a filter, a report reads every readable clinic", () => {
  assert.deepEqual(reportClinicChoice(BOTH, null, null, false, null), BOTH);
});

test("a ?centro= link preselects that single clinic", () => {
  assert.deepEqual(reportClinicChoice(BOTH, null, "cag", false, null), ["cag"]);
  assert.deepEqual(reportFilterSelection(BOTH, null, "cag", false), ["cag"]);
});

test("once the filter is touched, the link no longer applies", () => {
  assert.deepEqual(reportClinicChoice(BOTH, null, "cag", true, null), BOTH);
  assert.deepEqual(reportClinicChoice(BOTH, ["bay"], "cag", true, null), ["bay"]);
  assert.deepEqual(reportFilterSelection(BOTH, ["bay"], "cag", true), ["bay"]);
});

test("a link to a clinic the person cannot read falls back to every readable clinic", () => {
  assert.deepEqual(reportClinicChoice(BOTH, null, "other", false, null), BOTH);
  assert.equal(reportFilterSelection(BOTH, null, "other", false), null);
});

test("while the readable clinics are unknown, a link's clinic is kept (the report never widens)", () => {
  assert.deepEqual(reportClinicChoice([], null, "cag", false, null), ["cag"]);
  assert.equal(reportClinicChoice([], null, null, false, null), null);
});

test("a link to the only readable clinic is the same as every clinic", () => {
  assert.deepEqual(reportClinicChoice(["cag"], null, "cag", false, null), ["cag"]);
});

test("the coverage of a total: one clinic by id, several by count", () => {
  assert.deepEqual(clinicCoverage(BOTH, null), { kind: "many", count: 2 });
  assert.deepEqual(clinicCoverage(BOTH, ["cag"]), { kind: "one", id: "cag" });
  assert.deepEqual(clinicCoverage(["bay"], null), { kind: "one", id: "bay" });
  assert.deepEqual(clinicCoverage([], null), { kind: "none" });
});
