import { test } from "node:test";
import assert from "node:assert/strict";

import { transferTreatmentInvalid, transferTreatmentMissing } from "./transfer-treatment-missing.ts";

const base = {
  destination: "c2",
  mode: "virtual" as "virtual" | "fisica",
  sourceWarehouse: "",
  destinationWarehouse: "",
  sessions: "",
  pending: 5,
};

test("transferTreatmentMissing: no destination center → listed", () => {
  assert.deepEqual(transferTreatmentMissing({ ...base, destination: "" }), ["destination"]);
});
test("transferTreatmentMissing: physical mode without source warehouse → listed", () => {
  assert.deepEqual(transferTreatmentMissing({ ...base, mode: "fisica", destinationWarehouse: "w2" }), ["sourceWarehouse"]);
});
test("transferTreatmentMissing: physical mode without destination warehouse → listed", () => {
  assert.deepEqual(transferTreatmentMissing({ ...base, mode: "fisica", sourceWarehouse: "w1" }), ["destinationWarehouse"]);
});
test("transferTreatmentMissing: everything empty in physical mode → all, in on-screen order", () => {
  assert.deepEqual(transferTreatmentMissing({ ...base, destination: "", mode: "fisica" }), [
    "destination",
    "sourceWarehouse",
    "destinationWarehouse",
  ]);
});
test("transferTreatmentMissing: all present → []", () => {
  assert.deepEqual(transferTreatmentMissing(base), []);
  assert.deepEqual(transferTreatmentMissing({ ...base, mode: "fisica", sourceWarehouse: "w1", destinationWarehouse: "w2" }), []);
});
test("transferTreatmentInvalid: sessions out of range; empty means all", () => {
  assert.equal(transferTreatmentInvalid({ ...base, sessions: "0" }), "sessionsOutOfRange");
  assert.equal(transferTreatmentInvalid({ ...base, sessions: "6" }), "sessionsOutOfRange");
  assert.equal(transferTreatmentInvalid({ ...base, sessions: "5" }), null);
  assert.equal(transferTreatmentInvalid({ ...base, sessions: " " }), null);
});
test("transferTreatmentInvalid: a package with nothing pending", () => {
  assert.equal(transferTreatmentInvalid({ ...base, pending: 0 }), "nothingPending");
});
