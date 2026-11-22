import { test } from "node:test";
import assert from "node:assert/strict";

import type { BookingSlot, DaySlots } from "./availability.ts";
import { bookableWeekDays, hourLabel, shiftWeek, weekCell, weekDays, weekHours, weekStart } from "./week.ts";

const slot = (time: string, free: number, capacity = 3, state?: BookingSlot["state"]): BookingSlot => ({
  time,
  free,
  capacity,
  state: state ?? (free > 0 ? "open" : "full"),
  reasonKey: null,
});

test("weekStart: Monday of the week; a Sunday belongs to the coming week", () => {
  assert.equal(weekStart("2026-11-04"), "2026-11-02"); // Wed
  assert.equal(weekStart("2026-11-02"), "2026-11-02"); // Mon
  assert.equal(weekStart("2026-11-07"), "2026-11-02"); // Sat
  assert.equal(weekStart("2026-11-08"), "2026-11-09"); // Sun → next Mon
  assert.equal(weekStart("2027-01-01"), "2026-12-28"); // across years
});

test("weekDays: Monday to Saturday, six days, Sunday left out", () => {
  assert.deepEqual(weekDays("2026-11-04"), [
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
  ]);
  assert.equal(weekDays("2026-11-30")[5], "2026-12-05");
});

test("shiftWeek: whole weeks from the Monday", () => {
  assert.equal(shiftWeek("2026-11-04", 1), "2026-11-09");
  assert.equal(shiftWeek("2026-11-04", -1), "2026-10-26");
  assert.equal(shiftWeek("2026-11-04", 0), "2026-11-02");
});

test("weekHours: union of bookable hours in the window, sorted; unavailable-only hours dropped", () => {
  const days: DaySlots[] = [
    { date: "2026-11-09", slots: [slot("07:00", 1), slot("07:20", 0), slot("13:00", 2)] },
    { date: "2026-11-10", slots: [slot("08:40", 1), slot("16:00", 0, 0, "unavailable")] },
  ];
  assert.deepEqual(weekHours(days, "any"), ["07", "08", "13"]);
  assert.deepEqual(weekHours(days, "morning"), ["07", "08"]);
  assert.deepEqual(weekHours(days, "afternoon"), ["13"]);
  assert.deepEqual(weekHours([], "any"), []);
});

test("weekCell: sums the hour's times and picks its first time with room", () => {
  const day: DaySlots = {
    date: "2026-11-09",
    slots: [slot("07:00", 0), slot("07:20", 2), slot("07:40", 1), slot("08:00", 3)],
  };
  assert.deepEqual(weekCell(day, "07", "any"), { free: 3, booked: 6, capacity: 9, time: "07:20" });
  assert.equal(weekCell(day, "09", "any"), null);
  assert.equal(weekCell(day, "07", "afternoon"), null);
});

test("weekCell: a full hour picks its first time (overbook); unavailable times do not count", () => {
  const day: DaySlots = {
    date: "2026-11-09",
    slots: [slot("10:00", 0, 0, "unavailable"), slot("10:30", 0, 2)],
  };
  assert.deepEqual(weekCell(day, "10", "any"), { free: 0, booked: 2, capacity: 2, time: "10:30" });
  const closed: DaySlots = { date: "2026-11-09", slots: [slot("11:00", 0, 0, "unavailable")] };
  assert.equal(weekCell(closed, "11", "any"), null);
});

test("hourLabel: 24-hour digits without a leading zero", () => {
  assert.equal(hourLabel("07"), "7:00");
  assert.equal(hourLabel("13"), "13:00");
});

test("bookableWeekDays: from today, no holidays", () => {
  const days = weekDays("2026-11-04");
  assert.deepEqual(bookableWeekDays(days, "2026-11-04", ["2026-11-06"]), ["2026-11-04", "2026-11-05", "2026-11-07"]);
});

test("weekCell: a service hour counts sessions that fit, not free stations per half-hour start", () => {
  // 5 rooms free at 09:00 and 09:30, 1-hour sessions → 5 sessions in that hour (not 10).
  const day: DaySlots = {
    date: "2026-11-09",
    slots: [slot("09:00", 5, 5), slot("09:30", 5, 5)],
    sessionMinutes: 60,
  };
  assert.deepEqual(weekCell(day, "09", "any"), { free: 5, booked: 0, capacity: 5, time: "09:00" });
});
