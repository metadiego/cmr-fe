import { test } from "node:test";
import assert from "node:assert/strict";

import { trainFormReason, type TrainFormState } from "./train-form.ts";

const ok: TrainFormState = {
  permsReady: true,
  canBook: true,
  balanceHidden: false,
  balanceState: "ok",
  ticked: 2,
  rows: 1,
  max: 3,
  limitedBy: "emtt",
  startsSunday: false,
  rowsLoaded: true,
  rowsFailed: false,
  rowsBlocked: false,
};

test("trainFormReason is null when the visit can be booked", () => {
  assert.equal(trainFormReason(ok), null);
});

test("trainFormReason says loading while permissions load, before anything else", () => {
  assert.deepEqual(trainFormReason({ ...ok, permsReady: false, canBook: false, rowsBlocked: true }), { key: "loading" });
});

test("trainFormReason names a missing booking permission", () => {
  assert.deepEqual(trainFormReason({ ...ok, canBook: false }), { key: "noPermission" });
});

test("trainFormReason explains the balance before the rows", () => {
  assert.deepEqual(trainFormReason({ ...ok, balanceHidden: true, rowsBlocked: true }), { key: "balanceHidden" });
  assert.deepEqual(trainFormReason({ ...ok, balanceState: "fail" }), { key: "balanceFailed" });
  assert.deepEqual(trainFormReason({ ...ok, balanceState: "loading" }), { key: "checking" });
});

test("trainFormReason puts the cap ahead of rows to fix", () => {
  assert.deepEqual(trainFormReason({ ...ok, rows: 4, max: 3, rowsBlocked: true }), {
    key: "overCap",
    n: 3,
    therapyId: "emtt",
  });
});

test("trainFormReason has no reason with nothing ticked: «Terapias» is the missing field", () => {
  assert.equal(trainFormReason({ ...ok, ticked: 0, rows: 4, max: 0, rowsBlocked: true, rowsLoaded: false }), null);
});

test("trainFormReason refuses a Sunday start", () => {
  assert.deepEqual(trainFormReason({ ...ok, startsSunday: true }), { key: "dateSunday" });
});

test("trainFormReason waits for the rows, then reports a failed check, then rows to fix", () => {
  assert.deepEqual(trainFormReason({ ...ok, rowsLoaded: false, rowsBlocked: true }), { key: "checking" });
  assert.deepEqual(trainFormReason({ ...ok, rowsFailed: true, rowsBlocked: true }), { key: "checkFailed" });
  assert.deepEqual(trainFormReason({ ...ok, rowsBlocked: true }), { key: "fixRed" });
});
