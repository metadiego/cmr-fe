import { test } from "node:test";
import assert from "node:assert/strict";

import { chosenTime, dayFree, dayParts, shiftWeek, weekStrip } from "./appointment-when.ts";

const slot = (time: string, vacios: number) => ({ time, vacios, cupo: 6 });

test("weekStrip is Monday to Saturday of the date's week, marking days before today", () => {
  // 2026-11-25 is a Wednesday.
  assert.deepEqual(weekStrip("2026-11-25", "2026-11-25"), [
    { date: "2026-11-23", past: true },
    { date: "2026-11-24", past: true },
    { date: "2026-11-25", past: false },
    { date: "2026-11-26", past: false },
    { date: "2026-11-27", past: false },
    { date: "2026-11-28", past: false },
  ]);
  // A Sunday belongs to the week it closes (clinic closed): its Monday–Saturday.
  assert.equal(weekStrip("2026-11-29", "2026-11-20")[0].date, "2026-11-23");
});

test("shiftWeek moves to the same weekday a week away, never before today, never to a Sunday", () => {
  assert.equal(shiftWeek("2026-11-25", 1, "2026-11-20"), "2026-12-02");
  assert.equal(shiftWeek("2026-12-02", -1, "2026-11-20"), "2026-11-25");
  assert.equal(shiftWeek("2026-12-02", -1, "2026-11-27"), "2026-11-27"); // would be past → today
  assert.equal(shiftWeek("2026-12-02", -1, "2026-11-29"), "2026-11-30"); // today is Sunday → Monday
});

test("dayParts splits the hours at noon", () => {
  const parts = dayParts([slot("07:00", 2), slot("11:00", 0), slot("12:00", 4), slot("13:00", 0)]);
  assert.deepEqual(parts.morning.map((s) => s.time), ["07:00", "11:00"]);
  assert.deepEqual(parts.afternoon.map((s) => s.time), ["12:00", "13:00"]);
});

test("dayFree adds the free places of a day; null when it has no hours", () => {
  assert.equal(dayFree([slot("07:00", 2), slot("08:00", 6), slot("09:00", 0)]), 8);
  assert.equal(dayFree([]), null);
});

test("chosenTime drops a preset hour the day does not offer, so nothing unseen is booked", () => {
  const slots = [slot("07:00", 2), slot("09:00", 1)];
  // The desk opened it at 22:00: not one of the day's hours → nothing chosen.
  assert.equal(chosenTime({ time: "22:00", slots, loaded: true, keep: false }), "");
  assert.equal(chosenTime({ time: "09:00", slots, loaded: true, keep: false }), "09:00");
  // Edit, or an hour picked on the calendar: kept as given.
  assert.equal(chosenTime({ time: "22:00", slots, loaded: true, keep: true }), "22:00");
  // Hours still loading, or a type with no hours (free dropdown): left alone.
  assert.equal(chosenTime({ time: "22:00", slots: [], loaded: false, keep: false }), "22:00");
  assert.equal(chosenTime({ time: "10:00", slots: [], loaded: true, keep: false }), "10:00");
});
