import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSeriesRows, canBookSeries, seriesDates } from "./series.ts";
import { fromServiceAvailability, type DaySlots } from "./availability.ts";
import type { RecurringPlanItem } from "../recurring-plan.ts";

function day(date: string, slots: [string, number][]): DaySlots {
  return {
    date,
    slots: slots.map(([time, free]) => ({
      time,
      capacity: 2,
      free,
      state: free > 0 ? ("open" as const) : ("full" as const),
      reasonKey: null,
    })),
  };
}

const D = ["2026-11-10", "2026-11-17", "2026-11-24"];
const base = {
  dates: D,
  time: "09:00",
  overrides: {},
  days: {
    "2026-11-10": day("2026-11-10", [["09:00", 2], ["10:00", 1]]),
    "2026-11-17": day("2026-11-17", [["09:00", 2], ["10:00", 1]]),
    "2026-11-24": day("2026-11-24", [["09:00", 2], ["10:00", 1]]),
  } as Record<string, DaySlots | null>,
  holidays: [] as string[],
  existingDates: [] as string[],
};

test("seriesDates every 1 and 2 weeks", () => {
  assert.deepEqual(seriesDates("2026-11-10", 1, 3), D);
  assert.deepEqual(seriesDates("2026-11-10", 2, 3), ["2026-11-10", "2026-11-24", "2026-12-08"]);
});

test("all-free series can be booked", () => {
  const rows = buildSeriesRows(base);
  assert.deepEqual(rows.map((r) => r.status), ["free", "free", "free"]);
  assert.equal(canBookSeries(rows), true);
  assert.deepEqual(rows.map((r) => r.index), [0, 1, 2]);
});

test("holiday row is blocked and blocks the series", () => {
  const rows = buildSeriesRows({ ...base, holidays: ["2026-11-17"] });
  assert.equal(rows[1].status, "blocked");
  assert.equal(rows[1].reason, "holiday");
  assert.equal(canBookSeries(rows), false);
});

test("duplicate row is blocked", () => {
  const rows = buildSeriesRows({ ...base, existingDates: ["2026-11-24"] });
  assert.equal(rows[2].status, "blocked");
  assert.equal(rows[2].reason, "duplicate");
});

test("a date whose only session is cancelled is blocked with its own reason", () => {
  const rows = buildSeriesRows({ ...base, existingDates: ["2026-11-24"], cancelledDates: ["2026-11-24"] });
  assert.equal(rows[2].status, "blocked");
  assert.equal(rows[2].reason, "cancelled");
  assert.equal(canBookSeries(rows), false);
});

test("a date with a live session stays duplicate even if listed as cancelled elsewhere", () => {
  const rows = buildSeriesRows({ ...base, existingDates: ["2026-11-24"], cancelledDates: [] });
  assert.equal(rows[2].reason, "duplicate");
});

test("missing day, null day or missing slot is closed", () => {
  const days: Record<string, DaySlots | null> = { ...base.days, "2026-11-10": null };
  delete days["2026-11-17"];
  days["2026-11-24"] = day("2026-11-24", [["10:00", 1]]);
  const rows = buildSeriesRows({ ...base, days });
  assert.deepEqual(rows.map((r) => r.reason), ["closed", "closed", "closed"]);
});

test("unavailable slot is closed", () => {
  const days = {
    ...base.days,
    "2026-11-10": {
      date: "2026-11-10",
      slots: [{ time: "09:00", capacity: 0, free: 0, state: "unavailable" as const, reasonKey: "therapies.endsAfterClosing" }],
    },
  };
  assert.equal(buildSeriesRows({ ...base, days })[0].reason, "closed");
});

test("noStaff is a warning, not closed: the row is full (overbookable) and the series can book", () => {
  const svc = fromServiceAvailability("2026-11-10", {
    configured: true,
    minutes: 30,
    slots: [{ time: "09:00", fits: false, freeStations: 0, reasonKey: "therapies.noStaff" }],
  });
  const rows = buildSeriesRows({ ...base, days: { ...base.days, "2026-11-10": svc } });
  assert.equal(rows[0].status, "full");
  assert.equal(rows[0].reason, null);
  assert.equal(canBookSeries(rows), true);
});

test("override time applies to that row only", () => {
  const rows = buildSeriesRows({ ...base, overrides: { 1: "10:00" } });
  assert.deepEqual(rows.map((r) => r.time), ["09:00", "10:00", "09:00"]);
});

test("full slot is full and still bookable", () => {
  const days = { ...base.days, "2026-11-17": day("2026-11-17", [["09:00", 0]]) };
  const rows = buildSeriesRows({ ...base, days });
  assert.equal(rows[1].status, "full");
  assert.equal(canBookSeries(rows), true);
});

test("plan suggestion attached only to non-free adjusted rows", () => {
  const days = { ...base.days, "2026-11-17": day("2026-11-17", [["09:00", 0]]) };
  const plan: RecurringPlanItem[] = [
    { index: 0, requestedDate: D[0], date: D[0], time: "09:00", status: "asRequested" },
    { index: 1, requestedDate: D[1], date: D[1], time: "10:00", status: "adjustedTime" },
    { index: 2, requestedDate: D[2], date: "2026-11-25", time: "09:00", status: "adjustedDate" },
  ];
  const rows = buildSeriesRows({ ...base, days, plan });
  assert.equal(rows[0].suggestion, null);
  assert.deepEqual(rows[1].suggestion, { date: D[1], time: "10:00" });
  assert.equal(rows[2].suggestion, null); // row 2 is free
});
