import { test } from "node:test";
import assert from "node:assert/strict";

import { treatmentTransferInvalid, treatmentTransferMissing } from "./treatment-transfer-missing.ts";

const base = {
  packageId: "pkg1",
  pending: 5,
  destinationPatientId: "",
  destinationClinicId: "c2",
  sessions: "",
  reason: "",
};

test("treatmentTransferMissing: no package chosen → listed", () => {
  assert.deepEqual(treatmentTransferMissing({ ...base, packageId: "" }), ["package"]);
});
test("treatmentTransferMissing: neither destination picked → listed (would be TRANSFER_NOTHING_CHANGES)", () => {
  assert.deepEqual(treatmentTransferMissing({ ...base, destinationClinicId: "" }), ["destination"]);
});
test("treatmentTransferMissing: destination patient without a reason → listed", () => {
  assert.deepEqual(treatmentTransferMissing({ ...base, destinationClinicId: "", destinationPatientId: "p9" }), ["reason"]);
});
test("treatmentTransferMissing: destination patient WITH a reason → []", () => {
  assert.deepEqual(
    treatmentTransferMissing({ ...base, destinationClinicId: "", destinationPatientId: "p9", reason: "family request" }),
    [],
  );
});
test("treatmentTransferMissing: destination center only, no reason needed → []", () => {
  assert.deepEqual(treatmentTransferMissing(base), []);
});
test("treatmentTransferMissing: both destinations set, reason still required", () => {
  assert.deepEqual(treatmentTransferMissing({ ...base, destinationPatientId: "p9" }), ["reason"]);
});
test("treatmentTransferMissing: everything empty → all required fields, in on-screen order", () => {
  assert.deepEqual(treatmentTransferMissing({ ...base, packageId: "", destinationClinicId: "" }), ["package", "destination"]);
});

test("treatmentTransferInvalid: sessions out of range; empty means all pending", () => {
  assert.equal(treatmentTransferInvalid({ ...base, sessions: "0" }), "sessionsOutOfRange");
  assert.equal(treatmentTransferInvalid({ ...base, sessions: "6" }), "sessionsOutOfRange");
  assert.equal(treatmentTransferInvalid({ ...base, sessions: "5" }), null);
  assert.equal(treatmentTransferInvalid({ ...base, sessions: " " }), null);
});
test("treatmentTransferInvalid: a package with nothing pending", () => {
  assert.equal(treatmentTransferInvalid({ ...base, pending: 0 }), "nothingPending");
});
test("treatmentTransferInvalid: no package chosen yet never reads as nothingPending", () => {
  assert.equal(treatmentTransferInvalid({ ...base, packageId: "", pending: 0 }), null);
});
