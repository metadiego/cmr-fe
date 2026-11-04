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
  sessionCount,
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
  // noStaff is a warning (the BE books anyway): full/overbookable, never unavailable.
  assert.deepEqual(d.slots.map((s) => s.state), ["open", "full", "full"]);
  assert.deepEqual(d.slots.map((s) => s.capacity), [2, 1, 1]);
  assert.equal(d.slots[2].reasonKey, "therapies.noStaff");
  assert.equal(d.sessionMinutes, 30);
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

test("fromServiceAvailability: holiday stays unavailable", () => {
  const a: Availability = {
    configured: true,
    minutes: 30,
    slots: [{ time: "09:00", fits: false, reasonKey: "therapies.holiday" }],
  };
  assert.equal(fromServiceAvailability("2026-11-10", a)!.slots[0].state, "unavailable");
});

/** A BE day of service slots: 07:00..17:00 every 30 min (21 starts), `free` stations at each. */
function serviceDay(minutes: number, free: number): Availability {
  return {
    configured: true,
    minutes,
    slots: Array.from({ length: 21 }, (_, i) => {
      const m = 7 * 60 + i * 30;
      return { time: `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`, fits: true, freeStations: free };
    }),
  };
}

test("fromServiceAvailability: a start whose session ends after closing (17:30) is unavailable", () => {
  const d = fromServiceAvailability("2026-11-10", serviceDay(60, 5))!;
  const last = d.slots.at(-1)!;
  assert.equal(last.time, "17:00");
  assert.equal(last.state, "unavailable");
  assert.equal(last.reasonKey, "therapies.endsAfterClosing");
  // 16:30 + 60 = 17:30: ends exactly at closing → still bookable.
  assert.equal(d.slots.at(-2)!.state, "open");
  // A 30-minute session fits at 17:00.
  assert.equal(fromServiceAvailability("2026-11-10", serviceDay(30, 5))!.slots.at(-1)!.state, "open");
});

test("freeIn for services counts sessions, not free stations per start", () => {
  // Empty Láser day, 5 rooms, 1-hour sessions: 20 valid starts × 5 = 100 station-starts → 50 sessions
  // (before: 21 × 5 = 105).
  const d = fromServiceAvailability("2026-11-10", serviceDay(60, 5))!;
  assert.equal(freeIn(d, "any"), 50);
  // 30-minute sessions: every start is its own session.
  assert.equal(freeIn(fromServiceAvailability("2026-11-10", serviceDay(30, 5))!, "any"), 105);
  // Shorter than a slot still takes the slot (max(minutes, 30)).
  assert.equal(sessionCount({ sessionMinutes: 15 }, 7), 7);
  assert.equal(sessionCount({ sessionMinutes: 90 }, 7), 2);
  // Medical: unchanged.
  assert.equal(sessionCount({}, 7), 7);
});

test("dropPastTimes: a medical band stays until start + 60", () => {
  const bands: SlotLibre[] = [
    { time: "09:00", capacity: 3, free: 2, cappedBy: null },
    { time: "10:00", capacity: 3, free: 2, cappedBy: null },
  ];
  const d = fromMedicalBands("2026-11-10", bands);
  assert.deepEqual(dropPastTimes(d, "2026-11-10", "09:40").slots.map((s) => s.time), ["09:00", "10:00"]);
  assert.deepEqual(dropPastTimes(d, "2026-11-10", "10:00").slots.map((s) => s.time), ["10:00"]);
  // Services keep the old rule: gone once the start passed.
  const sv = fromServiceAvailability("2026-11-10", serviceDay(30, 1))!;
  assert.equal(dropPastTimes(sv, "2026-11-10", "07:10").slots[0].time, "07:30");
});

test("dropPastTimes counts what it dropped (today with nothing left vs closed)", () => {
  const today = day("2026-11-10", [["08:00", 2, 2], ["09:30", 1, 1]]);
  const d = dropPastTimes(today, "2026-11-10", "18:00");
  assert.equal(d.slots.length, 0);
  assert.equal(d.droppedPast, 2);
});
