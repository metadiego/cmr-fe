import { test } from "node:test";
import assert from "node:assert/strict";

import {
  bookedBucket,
  bookedIn,
  dropPastTimes,
  freeBucket,
  freeIn,
  fromMedicalBands,
  fromServiceAvailability,
  inWindow,
  nextFree,
  normalizeTime,
  type DaySlots,
} from "./availability.ts";
import type { SlotLibre } from "../../api/citas.ts";
import type { Availability } from "../../api/resources.ts";

function day(date: string, slots: [string, number, number][]): DaySlots {
  return {
    date,
    slots: slots.map(([time, capacity, free]) => ({
      time,
      capacity,
      free,
      state: free > 0 ? "open" : "full",
      reasonKey: null,
    })),
  };
}

test("normalizeTime pads hours and drops seconds", () => {
  assert.equal(normalizeTime("7:00"), "07:00");
  assert.equal(normalizeTime("07:30:00"), "07:30");
  assert.equal(normalizeTime("07:00"), "07:00");
});

test("fromMedicalBands maps free/capacity and marks full", () => {
  const bands: SlotLibre[] = [
    { time: "8:30", capacity: 3, free: 0, cappedBy: "cupo" },
    { time: "08:00", capacity: 3, free: 2, cappedBy: null },
  ];
  const d = fromMedicalBands("2026-11-10", bands);
  assert.deepEqual(d.slots.map((s) => s.state), ["open", "full"]);
  assert.deepEqual(d.slots.map((s) => s.time), ["08:00", "08:30"]);
  assert.equal(d.slots[0].free, 2);
  assert.equal(d.slots[0].capacity, 3);
});

test("fromServiceAvailability returns null when not configured", () => {
  const a: Availability = { configured: false, minutes: 30, slots: [] };
  assert.equal(fromServiceAvailability("2026-11-10", a), null);
});

test("fromServiceAvailability maps fits, full and unavailable", () => {
  const a: Availability = {
    configured: true,
    minutes: 30,
    slots: [
      { time: "07:00", fits: true, freeStations: 2 },
      { time: "07:30", fits: false, reasonKey: "therapies.full" },
      { time: "08:00", fits: false, reasonKey: "therapies.noStaff" },
    ],
  };
  const d = fromServiceAvailability("2026-11-10", a)!;
  assert.deepEqual(d.slots.map((s) => s.free), [2, 0, 0]);
  assert.deepEqual(d.slots.map((s) => s.state), ["open", "full", "unavailable"]);
  assert.deepEqual(d.slots.map((s) => s.capacity), [2, 1, 0]);
});

test("fromServiceAvailability: fits without freeStations counts as one free", () => {
  const a: Availability = { configured: true, minutes: 30, slots: [{ time: "9:00", fits: true }] };
  const s = fromServiceAvailability("2026-11-10", a)!.slots[0];
  assert.equal(s.free, 1);
  assert.equal(s.capacity, 1);
  assert.equal(s.time, "09:00");
});

test("fromServiceAvailability: overMaxPerPatient is full", () => {
  const a: Availability = {
    configured: true,
    minutes: 30,
    slots: [{ time: "09:00", fits: false, reasonKey: "therapies.overMaxPerPatient" }],
  };
  const s = fromServiceAvailability("2026-11-10", a)!.slots[0];
  assert.equal(s.state, "full");
  assert.equal(s.reasonKey, "therapies.overMaxPerPatient");
});

test("inWindow: 12:00 is afternoon", () => {
  assert.equal(inWindow("11:59", "morning"), true);
  assert.equal(inWindow("12:00", "morning"), false);
  assert.equal(inWindow("12:00", "afternoon"), true);
  assert.equal(inWindow("7:00", "any"), true);
});

test("freeIn respects the window", () => {
  const d = day("2026-11-10", [["08:00", 3, 2], ["13:00", 3, 3], ["12:00", 3, 0]]);
  assert.equal(freeIn(d, "any"), 5);
  assert.equal(freeIn(d, "morning"), 2);
  assert.equal(freeIn(d, "afternoon"), 3);
});

test("bookedIn ignores unavailable slots", () => {
  const d: DaySlots = {
    date: "2026-11-10",
    slots: [
      { time: "08:00", capacity: 3, free: 1, state: "open", reasonKey: null },
      { time: "08:30", capacity: 2, free: 0, state: "full", reasonKey: null },
      { time: "09:00", capacity: 0, free: 0, state: "unavailable", reasonKey: "therapies.noStaff" },
    ],
  };
  assert.deepEqual(bookedIn(d), { booked: 4, capacity: 5 });
});

test("freeBucket thresholds", () => {
  assert.equal(freeBucket(0), "full");
  assert.equal(freeBucket(1), "low");
  assert.equal(freeBucket(3), "low");
  assert.equal(freeBucket(4), "some");
  assert.equal(freeBucket(8), "some");
  assert.equal(freeBucket(9), "many");
});

test("bookedBucket thresholds", () => {
  assert.equal(bookedBucket(0, 0), 0);
  assert.equal(bookedBucket(1, 10), 0);
  assert.equal(bookedBucket(3, 10), 1);
  assert.equal(bookedBucket(5, 10), 2);
  assert.equal(bookedBucket(8, 10), 3);
  assert.equal(bookedBucket(10, 10), 4);
});

test("nextFree returns earliest n, skipping past times on the start date", () => {
  const d2 = day("2026-11-11", [["08:00", 1, 1]]);
  const d1 = day("2026-11-10", [["08:00", 1, 1], ["09:30", 1, 1], ["10:00", 1, 0]]);
  const r = nextFree([d2, d1], "any", 2, { date: "2026-11-10", time: "9:00" });
  assert.deepEqual(r, [
    { date: "2026-11-10", time: "09:30" },
    { date: "2026-11-11", time: "08:00" },
  ]);
});

test("nextFree honours the window", () => {
  const d1 = day("2026-11-10", [["08:00", 1, 1], ["13:00", 1, 1]]);
  assert.deepEqual(nextFree([d1], "afternoon", 5, { date: "2026-11-10" }), [
    { date: "2026-11-10", time: "13:00" },
  ]);
});

test("dropPastTimes trims today's past times only", () => {
  const today = day("2026-11-10", [["08:00", 2, 2], ["09:30", 1, 1], ["10:00", 1, 0]]);
  assert.deepEqual(
    dropPastTimes(today, "2026-11-10", "9:30").slots.map((s) => s.time),
    ["09:30", "10:00"],
  );
  assert.equal(freeIn(dropPastTimes(today, "2026-11-10", "09:31"), "any"), 0);
  const tomorrow = day("2026-11-11", [["08:00", 1, 1]]);
  assert.equal(dropPastTimes(tomorrow, "2026-11-10", "23:00"), tomorrow);
});
