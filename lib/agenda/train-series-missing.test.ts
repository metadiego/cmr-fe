import { test } from "node:test";
import assert from "node:assert/strict";

import { bookableTrainDays, trainSeriesBlock, trainSeriesMissing } from "./train-series-missing.ts";

const full = { startDate: "2026-11-18", time: "09:00", weekdayCount: 1 };

test("trainSeriesMissing: all present → []", () => {
  assert.deepEqual(trainSeriesMissing(full), []);
});
test("trainSeriesMissing: blank start date → startDate listed", () => {
  assert.deepEqual(trainSeriesMissing({ ...full, startDate: "" }), ["startDate"]);
});
test("trainSeriesMissing: no time → time listed", () => {
  assert.deepEqual(trainSeriesMissing({ ...full, time: " " }), ["time"]);
});
test("trainSeriesMissing: no weekday → weekdays listed", () => {
  assert.deepEqual(trainSeriesMissing({ ...full, weekdayCount: 0 }), ["weekdays"]);
});
test("trainSeriesMissing: empty form → every field in on-screen order", () => {
  assert.deepEqual(trainSeriesMissing({ startDate: "", time: "", weekdayCount: 0 }), ["startDate", "time", "weekdays"]);
});
test("trainSeriesBlock: not calculated → notCalculated", () => {
  assert.equal(trainSeriesBlock(null), "notCalculated");
});
test("trainSeriesBlock: only skipped days → nothingPlanned", () => {
  assert.equal(trainSeriesBlock({ days: [{ status: "skipped" }] }), "nothingPlanned");
});
test("trainSeriesBlock: planned day without a time → nothingPlanned", () => {
  assert.equal(trainSeriesBlock({ days: [{ status: "planned", time: null }] }), "nothingPlanned");
});
test("trainSeriesBlock: one planned day with a time → null", () => {
  assert.equal(trainSeriesBlock({ days: [{ status: "skipped" }, { status: "planned", time: "09:00" }] }), null);
});
test("bookableTrainDays: keeps only planned days with a time", () => {
  const days = [
    { status: "planned", time: "09:00", date: "a" },
    { status: "planned", time: null, date: "b" },
    { status: "skipped", time: "10:00", date: "c" },
  ];
  assert.deepEqual(bookableTrainDays(days).map((d) => d.date), ["a"]);
});
