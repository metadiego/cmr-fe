import { test } from "node:test";
import assert from "node:assert/strict";

import { isPeriod, PERIODS, periodFocus, periodForKey } from "./period.ts";

const today = "2026-11-04";
const nov = { year: 2026, month0: 10 };

test("isPeriod and periodForKey", () => {
  assert.ok(isPeriod("week") && isPeriod("month"));
  assert.ok(!isPeriod("year") && !isPeriod(null) && !isPeriod(undefined));
  assert.equal(periodForKey("W"), "week");
  assert.equal(periodForKey("m"), "month");
  assert.equal(periodForKey("x"), null);
});

test("there is no Day view: 'day' is not a view and D is not its shortcut", () => {
  assert.ok(!isPeriod("day"));
  assert.equal(periodForKey("d"), null);
  assert.equal(periodForKey("D"), null);
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

test("shiftDay is gone with the Day view; week and month still move one period", () => {
  // The Day view's ‹ › helper was deleted with the view; Week/Month shifts are covered in week/month tests.
  assert.equal(PERIODS.join(","), "week,month");
});
