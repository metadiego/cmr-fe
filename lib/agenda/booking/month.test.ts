import { test } from "node:test";
import assert from "node:assert/strict";

import { bookableDays, dayKind, monthOf, monthWeeks, shiftMonth } from "./month.ts";

test("monthWeeks: only as many Sunday-first weeks as needed", () => {
  assert.equal(monthWeeks(2026, 10).length, 5); // Nov 2026
  assert.equal(monthWeeks(2026, 7).length, 6); // Aug 2026
  assert.equal(monthWeeks(2026, 1).length, 4); // Feb 2026
  assert.equal(monthWeeks(2026, 10)[0][0], "2026-11-01");
  assert.ok(monthWeeks(2026, 7).every((w) => w.length === 7));
});

test("bookableDays: in month, from today, no Sundays, no holidays", () => {
  const weeks = monthWeeks(2026, 10);
  const days = bookableDays(weeks, 10, "2026-11-04", ["2026-11-11"]);
  assert.ok(!days.includes("2026-11-01"));
  assert.ok(!days.includes("2026-11-03"));
  assert.ok(!days.includes("2026-11-11"));
  assert.ok(days.includes("2026-11-04"));
  assert.ok(!days.includes("2026-12-01"));
});

test("dayKind returns each kind", () => {
  const today = "2026-11-04";
  const h = ["2026-11-11"];
  assert.equal(dayKind("2026-11-03", 10, today, h), "past");
  assert.equal(dayKind("2026-12-01", 10, today, h), "outside");
  assert.equal(dayKind("2026-11-08", 10, today, h), "sunday");
  assert.equal(dayKind("2026-11-11", 10, today, h), "holiday");
  assert.equal(dayKind("2026-11-12", 10, today, h), "bookable");
});

test("monthOf: the month of a YYYY-MM-DD day", () => {
  assert.deepEqual(monthOf("2026-11-04"), { year: 2026, month0: 10 });
  assert.deepEqual(monthOf("2027-01-31"), { year: 2027, month0: 0 });
});

test("shiftMonth: forward, back and across years", () => {
  assert.deepEqual(shiftMonth({ year: 2026, month0: 10 }, 1), { year: 2026, month0: 11 });
  assert.deepEqual(shiftMonth({ year: 2026, month0: 11 }, 1), { year: 2027, month0: 0 });
  assert.deepEqual(shiftMonth({ year: 2027, month0: 0 }, -1), { year: 2026, month0: 11 });
  assert.deepEqual(shiftMonth({ year: 2026, month0: 5 }, -18), { year: 2024, month0: 11 });
  assert.deepEqual(shiftMonth({ year: 2026, month0: 5 }, 0), { year: 2026, month0: 5 });
});
