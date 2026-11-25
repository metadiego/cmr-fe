import { test } from "node:test";
import assert from "node:assert/strict";

import { transferManyInvalid, transferManyItemInvalid, transferManyMissing } from "./transfer-many-missing.ts";

test("transferManyMissing: nothing picked yet — every field missing, destination first", () => {
  assert.deepEqual(
    transferManyMissing({ destinationPatientId: "", isSelf: false, destinationClinicId: "", reason: "", checkedCount: 0 }),
    ["destination", "packages", "reason"],
  );
});

test("transferManyMissing: a different patient picked — clinic is not asked", () => {
  assert.deepEqual(
    transferManyMissing({ destinationPatientId: "p2", isSelf: false, destinationClinicId: "", reason: "porque sí", checkedCount: 2 }),
    [],
  );
});

test("transferManyMissing: the SAME patient picked (center-only move) — clinic becomes required", () => {
  assert.deepEqual(
    transferManyMissing({ destinationPatientId: "p1", isSelf: true, destinationClinicId: "", reason: "porque sí", checkedCount: 2 }),
    ["clinic"],
  );
});

test("transferManyMissing: self + clinic chosen — nothing missing", () => {
  assert.deepEqual(
    transferManyMissing({ destinationPatientId: "p1", isSelf: true, destinationClinicId: "c2", reason: "porque sí", checkedCount: 1 }),
    [],
  );
});

test("transferManyMissing: no package checked — missing, independent of destination", () => {
  assert.deepEqual(
    transferManyMissing({ destinationPatientId: "p2", isSelf: false, destinationClinicId: "", reason: "porque sí", checkedCount: 0 }),
    ["packages"],
  );
});

test("transferManyItemInvalid: within range is valid", () => {
  assert.equal(transferManyItemInvalid("6", 11), false);
  assert.equal(transferManyItemInvalid("11", 11), false);
});

test("transferManyItemInvalid: zero, negative, over-pending, empty and non-numeric are all invalid", () => {
  assert.equal(transferManyItemInvalid("0", 11), true);
  assert.equal(transferManyItemInvalid("-1", 11), true);
  assert.equal(transferManyItemInvalid("12", 11), true);
  assert.equal(transferManyItemInvalid("", 11), true);
  assert.equal(transferManyItemInvalid("abc", 11), true);
});

test("transferManyInvalid: self + picking the SAME clinic as today's is a no-op, not a save", () => {
  assert.equal(
    transferManyInvalid({ isSelf: true, destinationClinicId: "c1", currentClinicId: "c1", checkedItems: [{ sessions: "6", pending: 11 }] }),
    "sameDestination",
  );
});

test("transferManyInvalid: self + a DIFFERENT clinic is fine", () => {
  assert.equal(
    transferManyInvalid({ isSelf: true, destinationClinicId: "c2", currentClinicId: "c1", checkedItems: [{ sessions: "6", pending: 11 }] }),
    null,
  );
});

test("transferManyInvalid: one checked package with an out-of-range quantity blocks the whole submit", () => {
  assert.equal(
    transferManyInvalid({ isSelf: false, destinationClinicId: "", checkedItems: [{ sessions: "6", pending: 11 }, { sessions: "99", pending: 6 }] }),
    "sessionsOutOfRange",
  );
});

test("transferManyInvalid: all valid — null", () => {
  assert.equal(
    transferManyInvalid({ isSelf: false, destinationClinicId: "", checkedItems: [{ sessions: "6", pending: 11 }, { sessions: "6", pending: 6 }] }),
    null,
  );
});
