import { test } from "node:test";
import assert from "node:assert/strict";

import { patientMergeBlock, patientMergeMissing, type PatientMergeState } from "./patient-merge-missing.ts";

const ready: PatientMergeState = {
  hasOther: true,
  simulating: false,
  hasPlan: true,
  planBlocked: false,
  needsPastAccept: true,
  acceptPast: true,
  reason: "Same person, two records",
};

test("patientMergeMissing: no other record picked → otherRecord", () => {
  assert.deepEqual(patientMergeMissing({ ...ready, hasOther: false }), ["otherRecord"]);
});
test("patientMergeMissing: past counts change and not acknowledged → acceptPastImpact", () => {
  assert.deepEqual(patientMergeMissing({ ...ready, acceptPast: false }), ["acceptPastImpact"]);
});
test("patientMergeMissing: blank reason → reason", () => {
  assert.deepEqual(patientMergeMissing({ ...ready, reason: "   " }), ["reason"]);
});
test("patientMergeMissing: both → on-screen order (acknowledgement, then reason)", () => {
  assert.deepEqual(patientMergeMissing({ ...ready, acceptPast: false, reason: "" }), ["acceptPastImpact", "reason"]);
});
test("patientMergeMissing: no acknowledgement needed → not listed", () => {
  assert.deepEqual(patientMergeMissing({ ...ready, needsPastAccept: false, acceptPast: false }), []);
});
test("patientMergeMissing: fields hidden (simulating, no plan, blocked plan) → nothing listed", () => {
  const blank = { ...ready, reason: "", acceptPast: false };
  assert.deepEqual(patientMergeMissing({ ...blank, simulating: true }), []);
  assert.deepEqual(patientMergeMissing({ ...blank, hasPlan: false }), []);
  assert.deepEqual(patientMergeMissing({ ...blank, planBlocked: true }), []);
});
test("patientMergeMissing: all present → []", () => {
  assert.deepEqual(patientMergeMissing(ready), []);
});

test("patientMergeBlock: ready or nothing picked → null", () => {
  assert.equal(patientMergeBlock(ready), null);
  assert.equal(patientMergeBlock({ ...ready, hasOther: false, hasPlan: false }), null);
});
test("patientMergeBlock: each cause", () => {
  assert.equal(patientMergeBlock({ ...ready, simulating: true }), "simulating");
  assert.equal(patientMergeBlock({ ...ready, hasPlan: false }), "simulationFailed");
  assert.equal(patientMergeBlock({ ...ready, planBlocked: true }), "mergeBlocked");
});
