import { test } from "node:test";
import assert from "node:assert/strict";

import { isPeriod, periodFocus, periodForKey, shiftDay } from "./period.ts";

const today = "2026-11-04";
const nov = { year: 2026, month0: 10 };

test("isPeriod and periodForKey", () => {
  assert.ok(isPeriod("day") && isPeriod("week") && isPeriod("month"));
  assert.ok(!isPeriod("year") && !isPeriod(null) && !isPeriod(undefined));
  assert.equal(periodForKey("d"), "day");
  assert.equal(periodForKey("W"), "week");
  assert.equal(periodForKey("m"), "month");
  assert.equal(periodForKey("x"), null);
});

test("periodFocus: day view is its day, else today", () => {
  assert.equal(periodFocus({ period: "day", date: "2026-11-12", anchor: today, month: nov }, today), "2026-11-12");
  assert.equal(periodFocus({ period: "day", anchor: today, month: nov }, today), today);
});

test("periodFocus: week view keeps a selected day inside the week, else its Monday (not before today)", () => {
  assert.equal(
    periodFocus({ period: "week", date: "2026-11-11", anchor: "2026-11-09", month: nov }, today),
    "2026-11-11",
  );
  assert.equal(
    periodFocus({ period: "week", date: "2026-11-30", anchor: "2026-11-09", month: nov }, today),
    "2026-11-09",
  );
  // This week's Monday already passed: today.
  assert.equal(periodFocus({ period: "week", anchor: "2026-11-02", month: nov }, today), today);
});

test("periodFocus: month view → selected day in it, else today in the current month, else its 1st", () => {
  assert.equal(periodFocus({ period: "month", date: "2026-11-20", anchor: today, month: nov }, today), "2026-11-20");
  assert.equal(periodFocus({ period: "month", date: "2026-12-20", anchor: today, month: nov }, today), today);
  assert.equal(
    periodFocus({ period: "month", anchor: today, month: { year: 2027, month0: 1 } }, today),
    "2027-02-01",
  );
  // A past month never focuses a past day.
  assert.equal(periodFocus({ period: "month", anchor: today, month: { year: 2026, month0: 8 } }, today), today);
});

test("shiftDay: one day either way, across months", () => {
  assert.equal(shiftDay("2026-11-30", 1), "2026-12-01");
  assert.equal(shiftDay("2026-11-01", -1), "2026-10-31");
});
