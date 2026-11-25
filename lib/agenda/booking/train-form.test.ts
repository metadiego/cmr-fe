import { test } from "node:test";
import assert from "node:assert/strict";

import { firstVisitDate, refitRows, seriesKey, trainFormReason, type TrainFormState } from "./train-form.ts";

const ok: TrainFormState = {
  permsReady: true,
  canBook: true,
  catalogueFailed: false,
  balanceHidden: false,
  balanceState: "ok",
  ticked: 2,
  overCap: null,
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

test("trainFormReason puts a therapy over its sessions left ahead of rows to fix", () => {
  assert.deepEqual(trainFormReason({ ...ok, overCap: { therapyId: "sonica", used: 3, left: 2 }, rowsBlocked: true }), {
    key: "overCap",
    therapyId: "sonica",
    used: 3,
    left: 2,
  });
});

test("trainFormReason has no reason with nothing ticked: «Terapias» is the missing field", () => {
  assert.equal(trainFormReason({ ...ok, ticked: 0, overCap: { therapyId: "x", used: 1, left: 0 }, rowsBlocked: true, rowsLoaded: false }), null);
});

test("trainFormReason refuses a Sunday start", () => {
  assert.deepEqual(trainFormReason({ ...ok, startsSunday: true }), { key: "dateSunday" });
});

test("trainFormReason waits for the rows, then reports a failed check, then rows to fix", () => {
  assert.deepEqual(trainFormReason({ ...ok, rowsLoaded: false, rowsBlocked: true }), { key: "checking" });
  assert.deepEqual(trainFormReason({ ...ok, rowsFailed: true, rowsBlocked: true }), { key: "checkFailed" });
  assert.deepEqual(trainFormReason({ ...ok, rowsBlocked: true }), { key: "fixRed" });
});

test("trainFormReason reports a failed catalogue before the balance", () => {
  assert.deepEqual(trainFormReason({ ...ok, catalogueFailed: true, balanceState: "loading" }), { key: "catalogueFailed" });
});

test("seriesKey does not change when only the sessions-left cap changes", () => {
  assert.equal(seriesKey("weekly", [2, 4], null), seriesKey("weekly", [2, 4], null));
  assert.notEqual(seriesKey("weekly", [2, 4], 3), seriesKey("weekly", [2, 4], null));
  assert.equal(seriesKey("manual", [2], 5), "manual");
});

test("refitRows leaves generated rows alone: ticking a therapy must not freeze them as edits", () => {
  assert.equal(refitRows(false, [{ date: "2026-11-24" }, { date: "2026-12-01" }]), null);
});

test("refitRows re-fits every edited row, or only the one date given", () => {
  const items = [{ date: "2026-11-24", time: "09:00" }, { date: "2026-12-01" }];
  assert.deepEqual(refitRows(true, items), [
    { date: "2026-11-24", time: "09:00", fitTime: true },
    { date: "2026-12-01", fitTime: true },
  ]);
  assert.deepEqual(refitRows(true, items, "2026-12-01"), [{ date: "2026-11-24", time: "09:00" }, { date: "2026-12-01", fitTime: true }]);
});

test("firstVisitDate starts tomorrow, not today, unless the desk is on a later day", () => {
  assert.equal(firstVisitDate("2026-11-24", "2026-11-24"), "2026-11-25"); // Tue → Wed
  assert.equal(firstVisitDate("2026-11-20", "2026-11-24"), "2026-11-25"); // a past desk day too
  assert.equal(firstVisitDate("2026-12-01", "2026-11-24"), "2026-12-01"); // the day the desk shows
  assert.equal(firstVisitDate("2026-11-28", "2026-11-28"), "2026-11-30"); // Sat → Mon (closed Sunday)
});
