import { test } from "node:test";
import assert from "node:assert/strict";

import { holidayDates, mergeHolidays } from "./holidays.ts";

const C = "center-a";
const OTHER = "center-b";

test("holidayDates: keeps active, blocking holidays as YYYY-MM-DD", () => {
  const out = holidayDates(
    [
      { date: "2026-11-11T00:00:00.000Z", active: true, blocksSchedule: true, clinicId: C },
      { date: "2026-11-19", active: false, blocksSchedule: true, clinicId: C },
      { date: "2026-11-26", active: true, blocksSchedule: false, clinicId: C },
      { date: "2026-12-25" },
    ],
    C,
  );
  assert.deepEqual(out, ["2026-11-11", "2026-12-25"]);
});

test("holidayDates: empty list", () => {
  assert.deepEqual(holidayDates([], C), []);
});

test("holidayDates: another center's holiday never counts; global ones do", () => {
  const out = holidayDates(
    [
      { date: "2026-11-11", clinicId: OTHER },
      { date: "2026-11-19", clinicId: null },
      { date: "2026-11-20", clinicId: C },
    ],
    C,
  );
  assert.deepEqual(out, ["2026-11-19", "2026-11-20"]);
});

test("holidayDates: the center's own holiday wins over the global one on the same day (BE precedence)", () => {
  const out = holidayDates(
    [
      { date: "2026-11-19", clinicId: null, blocksSchedule: true },
      { date: "2026-11-19", clinicId: C, blocksSchedule: false },
      { date: "2026-11-20", clinicId: null, blocksSchedule: true },
      { date: "2026-11-20", clinicId: OTHER, blocksSchedule: false },
    ],
    C,
  );
  assert.deepEqual(out, ["2026-11-20"]);
});

test("mergeHolidays: the center list and the global list merge without duplicates", () => {
  const g = { id: "g1", date: "2026-12-25", clinicId: null };
  const own = { id: "c1", date: "2026-11-19", clinicId: C };
  const merged = mergeHolidays([[own, g], [g]]);
  assert.deepEqual(merged, [own, g]);
  assert.deepEqual(holidayDates(merged, C), ["2026-11-19", "2026-12-25"]);
  // Without ids, identical rows still collapse.
  assert.equal(mergeHolidays([[{ date: "2026-01-01" }], [{ date: "2026-01-01" }]]).length, 1);
});
