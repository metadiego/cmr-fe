import { test } from "node:test";
import assert from "node:assert/strict";

import {
  addItem,
  fitLoadedTimes,
  fittedTime,
  generateItems,
  nextDate,
  rejectDate,
  replaceDate,
  type EditableItem,
} from "./series-edit.ts";
import { dropRow, groupByTime, overridesOf } from "./series-booking.ts";
import type { DaySlots } from "./availability.ts";

const TODAY = "2026-11-04"; // a Wednesday

const day = (date: string, slots: [string, number, DaySlots["slots"][number]["state"]][]): DaySlots => ({
  date,
  slots: slots.map(([time, free, state]) => ({ time, capacity: 2, free, state, reasonKey: null })),
});

test("generateItems: start + every N weeks, count dates, no time overrides", () => {
  assert.deepEqual(generateItems("2026-11-10", 2, 3), [
    { date: "2026-11-10" },
    { date: "2026-11-24" },
    { date: "2026-12-08" },
  ]);
});

test("rejectDate: past, Sunday, another row's date; the row's own date is fine", () => {
  const items = [{ date: "2026-11-10" }, { date: "2026-11-17" }];
  assert.equal(rejectDate(items, 0, "2026-11-03", TODAY), "past");
  assert.equal(rejectDate(items, 0, "2026-11-15", TODAY), "sunday");
  assert.equal(rejectDate(items, 0, "2026-11-17", TODAY), "taken");
  assert.equal(rejectDate(items, null, "2026-11-10", TODAY), "taken");
  assert.equal(rejectDate(items, 0, "2026-11-10", TODAY), null);
  assert.equal(rejectDate(items, 0, TODAY, TODAY), null);
  assert.equal(rejectDate(items, 1, "2026-11-12", TODAY), null);
});

test("replaceDate keeps the position and the time override, and marks the time to fit", () => {
  const items: EditableItem[] = [{ date: "2026-11-10" }, { date: "2026-11-17", time: "10:00" }, { date: "2026-11-24" }];
  const out = replaceDate(items, 1, "2026-11-19");
  assert.deepEqual(out.map((i) => i.date), ["2026-11-10", "2026-11-19", "2026-11-24"]);
  assert.deepEqual(out[1], { date: "2026-11-19", time: "10:00", fitTime: true });
  assert.deepEqual(items[1], { date: "2026-11-17", time: "10:00" }, "input untouched");
});

test("nextDate: every N weeks after the latest row, skipping taken dates; none at the max", () => {
  assert.equal(nextDate([{ date: "2026-11-10" }, { date: "2026-11-17" }], 1, TODAY), "2026-11-24");
  assert.equal(nextDate([{ date: "2026-11-10" }, { date: "2026-11-24" }], 2, TODAY), "2026-12-08");
  // Latest, not last: the rows keep their position after a date change.
  assert.equal(nextDate([{ date: "2026-11-24" }, { date: "2026-11-10" }], 1, TODAY), "2026-12-01");
  assert.equal(nextDate([], 1, TODAY), null);
  const twenty = Array.from({ length: 20 }, (_, i) => ({ date: `2027-01-${String(i + 1).padStart(2, "0")}` }));
  assert.equal(nextDate(twenty, 1, TODAY), null);
});

test("nextDate never proposes a Sunday or a past date", () => {
  assert.equal(nextDate([{ date: "2026-11-08" }], 1, TODAY), "2026-11-16"); // Sunday row → Monday
  assert.equal(nextDate([{ date: "2026-10-01" }], 1, TODAY), "2026-11-05");
});

test("addItem appends a row with the series time to fit, up to 20", () => {
  assert.deepEqual(addItem([{ date: "2026-11-10" }], "2026-11-17"), [
    { date: "2026-11-10" },
    { date: "2026-11-17", fitTime: true },
  ]);
  const twenty = Array.from({ length: 20 }, () => ({ date: "2026-11-10" }));
  assert.equal(addItem(twenty, "2026-11-17").length, 20);
});

test("fittedTime: keeps a free time, else the first free one, else keeps it", () => {
  const d = day("2026-11-19", [
    ["08:00", 0, "unavailable"],
    ["09:00", 0, "full"],
    ["10:00", 1, "open"],
    ["11:00", 2, "open"],
  ]);
  assert.equal(fittedTime(d, "11:00"), "11:00");
  assert.equal(fittedTime(d, "9:00"), "10:00");
  assert.equal(fittedTime(d, "13:00"), "10:00");
  assert.equal(fittedTime(day("2026-11-19", [["09:00", 0, "full"]]), "09:00"), "09:00");
  assert.equal(fittedTime(null, "09:00"), "09:00");
});

test("fitLoadedTimes resolves loaded rows only and returns the same array when nothing to do", () => {
  const items: EditableItem[] = [
    { date: "2026-11-10" },
    { date: "2026-11-19", fitTime: true },
    { date: "2026-11-26", fitTime: true },
    { date: "2026-12-03", time: "11:00", fitTime: true },
  ];
  const days = {
    "2026-11-19": day("2026-11-19", [["09:00", 0, "full"], ["10:00", 1, "open"]]),
    "2026-12-03": "error" as const,
  };
  const out = fitLoadedTimes(items, days, "09:00");
  assert.deepEqual(out, [
    { date: "2026-11-10" },
    { date: "2026-11-19", time: "10:00" },
    { date: "2026-11-26", fitTime: true },
    { date: "2026-12-03", time: "11:00" },
  ]);
  assert.equal(fitLoadedTimes(out, {}, "09:00"), out);
  // The series time again clears the override.
  const back = fitLoadedTimes([{ date: "2026-11-19", time: "10:00", fitTime: true }], {
    "2026-11-19": day("2026-11-19", [["09:00", 1, "open"]]),
  }, "09:00");
  assert.deepEqual(back, [{ date: "2026-11-19" }]);
});

test("edited rows still book as one request per time, after a drop and an add", () => {
  let items: EditableItem[] = generateItems("2026-11-10", 1, 3);
  items = replaceDate(items, 1, "2026-11-19");
  items = fitLoadedTimes(items, { "2026-11-19": day("2026-11-19", [["10:00", 1, "open"]]) }, "09:00");
  items = dropRow(items, 0);
  items = addItem(items, nextDate(items, 1, TODAY)!);
  assert.deepEqual(items.map((i) => i.date), ["2026-11-19", "2026-11-24", "2026-12-01"]);
  const ov = overridesOf(items);
  const rows = items.map((it, i) => ({ date: it.date, time: ov[i] ?? "09:00" }));
  assert.deepEqual(groupByTime(rows), [
    { time: "10:00", dates: ["2026-11-19"] },
    { time: "09:00", dates: ["2026-11-24", "2026-12-01"] },
  ]);
});
