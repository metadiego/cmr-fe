// lib/personal/schedule.ts. Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { WEEK, byDay, collapseRepeats, hoursProblem, moveCenterSteps, splitRows, summarizeWeek, weekGrid, type ScheduleRow } from "./schedule.ts";

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

test("weekGrid: one line per center (by name), each weekday with its rows", () => {
  const rows = [
    row({ id: "c1", clinicId: "cag", clinicName: "Caguas", dayOfWeek: 2 }),
    row({ id: "b1", dayOfWeek: 1, startTime: "13:00", endTime: "17:00" }),
    row({ id: "b2", dayOfWeek: 1 }),
  ];
  const g = weekGrid(rows);
  assert.deepEqual(g.map((l) => l.clinicId), ["bay", "cag"]);
  assert.deepEqual(g[0].days.get(1)!.map((r) => r.id), ["b2", "b1"]);
  assert.deepEqual(g[0].days.get(2), []);
  assert.deepEqual(g[1].days.get(2)!.map((r) => r.id), ["c1"]);
});

test("summarizeWeek: consecutive days with the same hours collapse into a span", () => {
  const rows = [1, 2, 3, 4, 5, 6].map((d) => row({ id: `b${d}`, dayOfWeek: d, startTime: "07:00", endTime: "17:00" }))
    .concat([row({ id: "cag", clinicId: "cag", clinicName: "Caguas", dayOfWeek: 2 }), row({ id: "cag4", clinicId: "cag", clinicName: "Caguas", dayOfWeek: 4 })]);
  assert.deepEqual(summarizeWeek(rows), [
    { clinicId: "bay", clinicName: "Bayamón", spans: [{ from: 1, to: 6, startTime: "07:00", endTime: "17:00" }] },
    { clinicId: "cag", clinicName: "Caguas", spans: [
      { from: 2, to: 2, startTime: "08:00", endTime: "12:00" },
      { from: 4, to: 4, startTime: "08:00", endTime: "12:00" },
    ] },
  ]);
});

test("collapseRepeats: identical hours in one cell show once; the extra rows are listed for cleanup", () => {
  const cell = [
    row({ id: "a", startTime: "07:00", endTime: "17:00" }),
    row({ id: "b", startTime: "07:00", endTime: "17:00" }),
    row({ id: "c", startTime: "18:00", endTime: "19:00" }),
  ];
  const out = collapseRepeats(cell);
  assert.deepEqual(out.map((e) => [e.row.id, e.repeats.map((r) => r.id)]), [["a", ["b"]], ["c", []]]);
});
