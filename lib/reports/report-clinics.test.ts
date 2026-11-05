// Which clinics a report covers (lib/reports/report-clinics.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { clinicCoverage } from "./report-clinics.ts";

const BOTH = ["bay", "cag"];

test("the coverage of a total: one clinic by id, several by count", () => {
  assert.deepEqual(clinicCoverage(BOTH, null), { kind: "many", count: 2 });
  assert.deepEqual(clinicCoverage(BOTH, ["cag"]), { kind: "one", id: "cag" });
  assert.deepEqual(clinicCoverage(["bay"], null), { kind: "one", id: "bay" });
  assert.deepEqual(clinicCoverage([], null), { kind: "none" });
});
