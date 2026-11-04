import { test } from "node:test";
import assert from "node:assert/strict";

import { bookableDays, dayKind, monthWeeks } from "./month.ts";

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
