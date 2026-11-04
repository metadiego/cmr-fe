import { test } from "node:test";
import assert from "node:assert/strict";

import { holidayDates } from "./holidays.ts";

test("holidayDates: keeps active, blocking holidays as YYYY-MM-DD", () => {
  const out = holidayDates([
    { date: "2026-11-11T00:00:00.000Z", active: true, blocksSchedule: true },
    { date: "2026-11-19", active: false, blocksSchedule: true },
    { date: "2026-11-26", active: true, blocksSchedule: false },
    { date: "2026-12-25" },
  ]);
  assert.deepEqual(out, ["2026-11-11", "2026-12-25"]);
});

test("holidayDates: empty list", () => {
  assert.deepEqual(holidayDates([]), []);
});
