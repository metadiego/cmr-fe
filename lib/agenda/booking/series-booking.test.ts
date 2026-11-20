import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applySuggestion,
  clampSessions,
  seriesHealth,
  seriesSpan,
  stepSessions,
  defaultSessions,
  dropRow,
  existingRange,
  groupByTime,
  notCreated,
  overridesOf,
  rowTimeOptions,
  setRowTime,
  suggestionExclusions,
} from "./series-booking.ts";
import type { DaySlots } from "./availability.ts";

test("defaultSessions uses the sessions left, clamped to 2–20, else 4", () => {
  assert.equal(defaultSessions(undefined), 4);
  assert.equal(defaultSessions(null), 4);
  assert.equal(defaultSessions(0), 4);
  assert.equal(defaultSessions(1), 2);
  assert.equal(defaultSessions(7), 7);
  assert.equal(defaultSessions(30), 20);
  assert.equal(clampSessions(Number.NaN), 4);
  assert.equal(clampSessions(3.6), 4);
});

test("groupByTime makes one request per distinct time, dates in order", () => {
  const groups = groupByTime([
    { date: "2026-11-17", time: "09:00" },
    { date: "2026-11-10", time: "9:00" },
    { date: "2026-11-24", time: "10:00:00" },
    { date: "2026-12-01", time: "09:00" },
  ]);
  assert.deepEqual(groups, [
    { time: "09:00", dates: ["2026-11-10", "2026-11-17", "2026-12-01"] },
    { time: "10:00", dates: ["2026-11-24"] },
  ]);
});

test("notCreated lists the requested dates the BE skipped", () => {
  assert.deepEqual(
    notCreated(["2026-11-10", "2026-11-17", "2026-11-24"], ["2026-11-10T00:00:00.000Z", "2026-11-24"]),
    ["2026-11-17"],
  );
});

test("row edits: time override, the series time clears it, suggestion and drop", () => {
  let items = [{ date: "2026-11-10" }, { date: "2026-11-17" }, { date: "2026-11-24" }];
  items = setRowTime(items, 1, "10:00", "09:00");
  assert.deepEqual(overridesOf(items), { 1: "10:00" });
  items = setRowTime(items, 1, "09:00", "09:00");
  assert.deepEqual(overridesOf(items), {});
  items = applySuggestion(items, 2, { date: "2026-11-26", time: "11:00" }, "09:00");
  assert.deepEqual(items[2], { date: "2026-11-26", time: "11:00" });
  items = applySuggestion(items, 0, { date: "2026-11-10", time: "09:00" }, "09:00");
  assert.deepEqual(items[0], { date: "2026-11-10" });
  items = dropRow(items, 1);
  assert.deepEqual(items.map((i) => i.date), ["2026-11-10", "2026-11-26"]);
  assert.deepEqual(overridesOf(items), { 1: "11:00" });
});

test("suggestionExclusions: other rows, existing sessions and holidays, not the row itself", () => {
  assert.deepEqual(
    suggestionExclusions(["2026-11-10", "2026-11-17"], 0, ["2026-11-03", "2026-11-17"], ["2026-11-19"]),
    ["2026-11-03", "2026-11-17", "2026-11-19"],
  );
});

test("existingRange covers the rows plus the forward search", () => {
  assert.equal(existingRange([]), null);
  assert.deepEqual(existingRange(["2026-11-17", "2026-11-10"]), { from: "2026-11-10", to: "2027-01-12" });
});

test("rowTimeOptions: open and full times, no unavailable, current kept disabled", () => {
  const day: DaySlots = {
    date: "2026-11-10",
    slots: [
      { time: "08:00", capacity: 1, free: 0, state: "unavailable", reasonKey: "x" },
      { time: "09:00", capacity: 2, free: 1, state: "open", reasonKey: null },
      { time: "10:00", capacity: 1, free: 0, state: "full", reasonKey: null },
    ],
  };
  assert.deepEqual(rowTimeOptions(day, "9:00"), [
    { time: "09:00", full: false, disabled: false, free: 1 },
    { time: "10:00", full: true, disabled: false, free: 0 },
  ]);
  assert.deepEqual(rowTimeOptions(day, "08:00"), [
    { time: "08:00", full: false, disabled: true, free: 0 },
    { time: "09:00", full: false, disabled: false, free: 1 },
    { time: "10:00", full: true, disabled: false, free: 0 },
  ]);
  assert.deepEqual(rowTimeOptions(null, "09:00"), [{ time: "09:00", full: false, disabled: true, free: 0 }]);
});

test("stepSessions moves one at a time inside 2–20", () => {
  assert.equal(stepSessions(4, 1), 5);
  assert.equal(stepSessions(4, -1), 3);
  assert.equal(stepSessions(2, -1), 2);
  assert.equal(stepSessions(20, 1), 20);
});

test("stepSessions after drops took the series below 2: minus stays, plus goes to 2", () => {
  assert.equal(stepSessions(1, -1), 1);
  assert.equal(stepSessions(1, 1), 2);
});

test("seriesSpan is the first and last date, whatever the row order", () => {
  assert.deepEqual(seriesSpan(["2026-12-04", "2026-11-27", "2026-12-18"]), { first: "2026-11-27", last: "2026-12-18" });
  assert.deepEqual(seriesSpan(["2026-11-27"]), { first: "2026-11-27", last: "2026-11-27" });
  assert.equal(seriesSpan([]), null);
});

test("seriesHealth counts free, full and blocked rows", () => {
  const row = (status: "free" | "full" | "blocked") => ({ index: 0, date: "2026-11-19", time: "16:00", status, reason: null, suggestion: null });
  assert.deepEqual(seriesHealth([row("free"), row("free"), row("full"), row("blocked")]), { free: 2, full: 1, blocked: 1 });
  assert.deepEqual(seriesHealth([]), { free: 0, full: 0, blocked: 0 });
});
