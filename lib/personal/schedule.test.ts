// lib/personal/schedule.ts. Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { WEEK, byDay, hoursProblem, moveCenterSteps, splitRows, type ScheduleRow } from "./schedule.ts";

const row = (over: Partial<ScheduleRow>): ScheduleRow => ({
  id: "r", staffId: "p", clinicId: "bay", clinicName: "Bayamón", dayOfWeek: 1, startTime: "08:00", endTime: "12:00",
  active: true, ...over,
});

test("the week runs Monday to Sunday (0 = Sunday)", () => {
  assert.deepEqual(WEEK, [1, 2, 3, 4, 5, 6, 0]);
});

test("own rows vs the center's general rows (staffId null); inactive ones dropped", () => {
  const rows = [row({ id: "a" }), row({ id: "b", staffId: null }), row({ id: "c", active: false })];
  const { own, general } = splitRows(rows, "p");
  assert.deepEqual(own.map((r) => r.id), ["a"]);
  assert.deepEqual(general.map((r) => r.id), ["b"]);
});

test("byDay groups per day, sorted by start then center", () => {
  const rows = [
    row({ id: "late", startTime: "13:00" }),
    row({ id: "cag", clinicName: "Caguas", startTime: "08:00" }),
    row({ id: "bay", startTime: "08:00" }),
    row({ id: "tue", dayOfWeek: 2 }),
  ];
  const m = byDay(rows);
  assert.deepEqual(m.get(1)!.map((r) => r.id), ["bay", "cag", "late"]);
  assert.deepEqual(m.get(2)!.map((r) => r.id), ["tue"]);
  assert.deepEqual(m.get(0), []);
});

test("hours: both required, HH:mm, end after start", () => {
  assert.equal(hoursProblem("", "12:00"), "missing");
  assert.equal(hoursProblem("12:00", "12:00"), "endBeforeStart");
  assert.equal(hoursProblem("13:00", "12:00"), "endBeforeStart");
  assert.equal(hoursProblem("8:00", "12:00"), "format");
  assert.equal(hoursProblem("08:00", "12:00"), null);
});

test("moving a row to another center = create there first, then deactivate the old one", () => {
  const r = row({ id: "old", clinicId: "bay" });
  assert.deepEqual(moveCenterSteps(r, "cag", "p"), {
    create: { staffId: "p", centerId: "cag", dayOfWeek: 1, startTime: "08:00", endTime: "12:00" },
    deactivate: { id: "old", centerId: "bay" },
  });
  assert.equal(moveCenterSteps(r, "bay", "p"), null);
});
