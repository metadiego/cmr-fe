import { test } from "node:test";
import assert from "node:assert/strict";

import type { BookableService } from "../../api/frontdesk.ts";
import type { PatientTrain } from "../../api/resources.ts";
import { dayTherapies, forgetTherapy, moveOff, summaryTrain, overCapTherapy, removeOff, restoreOff, trainMaxRows } from "./train-days.ts";

function bookable(entries: Record<string, number>): Map<string, BookableService> {
  return new Map(
    Object.entries(entries).map(([serviceId, n]) => [serviceId, { serviceId, bought: n, booked: 0, bookable: n, sources: [] }]),
  );
}

test("dayTherapies is the ticked therapies, in tick order, minus the ones taken off that day", () => {
  const off = { "2026-11-25": ["sonica"] };
  assert.deepEqual(dayTherapies(["laser", "sonica", "emtt"], off, "2026-11-25"), ["laser", "emtt"]);
  assert.deepEqual(dayTherapies(["laser", "sonica"], off, "2026-11-26"), ["laser", "sonica"]);
});

test("removeOff takes one therapy off one day, never the day's last one", () => {
  const off = removeOff({}, "2026-11-25", "sonica", ["laser", "sonica"]);
  assert.deepEqual(off, { "2026-11-25": ["sonica"] });
  assert.equal(removeOff(off, "2026-11-25", "laser", ["laser", "sonica"]), off);
});

test("restoreOff puts a therapy back on its day and forgets an emptied day", () => {
  assert.deepEqual(restoreOff({ "2026-11-25": ["sonica", "emtt"] }, "2026-11-25", "sonica"), { "2026-11-25": ["emtt"] });
  assert.deepEqual(restoreOff({ "2026-11-25": ["sonica"] }, "2026-11-25", "sonica"), {});
});

test("moveOff carries a day's removals to its new date, or drops them when the row goes", () => {
  const off = { "2026-11-25": ["sonica"], "2026-11-27": ["emtt"] };
  assert.deepEqual(moveOff(off, "2026-11-25", "2026-11-26"), { "2026-11-26": ["sonica"], "2026-11-27": ["emtt"] });
  assert.deepEqual(moveOff(off, "2026-11-25", null), { "2026-11-27": ["emtt"] });
});

test("overCapTherapy names the first ticked therapy booked on more days than it has sessions left", () => {
  const days = [["laser", "sonica"], ["laser", "sonica"], ["laser", "sonica"], ["laser"]];
  assert.deepEqual(overCapTherapy(days, bookable({ laser: 8, sonica: 2 }), ["laser", "sonica"]), {
    therapyId: "sonica",
    used: 3,
    left: 2,
  });
  assert.equal(overCapTherapy([["laser", "sonica"], ["laser"]], bookable({ laser: 8, sonica: 2 }), ["laser", "sonica"]), null);
  assert.equal(overCapTherapy(days, undefined, ["laser", "sonica"]), null);
});

test("overCapTherapy treats a ticked therapy missing from the balance as none left", () => {
  assert.deepEqual(overCapTherapy([["x"]], bookable({}), ["x"]), { therapyId: "x", used: 1, left: 0 });
});

test("trainMaxRows lets the visits reach the largest balance among the ticked, never past 20", () => {
  assert.equal(trainMaxRows(bookable({ laser: 8, sonica: 2 }), ["laser", "sonica"]), 8);
  assert.equal(trainMaxRows(bookable({ laser: 30 }), ["laser"]), 20);
  assert.equal(trainMaxRows(undefined, ["laser"]), 20);
  assert.equal(trainMaxRows(bookable({ laser: 8 }), []), 20);
});

test("forgetTherapy drops an unticked therapy from every day, so ticking it again puts it on all", () => {
  assert.deepEqual(forgetTherapy({ "2026-11-25": ["sonica"], "2026-11-26": ["sonica", "emtt"] }, "sonica"), {
    "2026-11-26": ["emtt"],
  });
});

test("dayTherapies never leaves a date empty: with every ticked one taken off, the date gets them all back", () => {
  // EMTT and Láser off 25 nov, then SÓNICA unticked: nothing would be left to plan.
  assert.deepEqual(dayTherapies(["emtt", "laser"], { "2026-11-25": ["emtt", "laser"] }, "2026-11-25"), ["emtt", "laser"]);
});

test("summaryTrain describes the whole visit: the first loaded date that has every ticked therapy", () => {
  const plan = (date: string) => ({ date }) as unknown as PatientTrain;
  const trains = { "2026-11-25": plan("2026-11-25"), "2026-11-27": plan("2026-11-27") };
  const rows = [
    { date: "2026-11-25", serviceIds: ["sonica"] },
    { date: "2026-11-27", serviceIds: ["laser", "emtt", "sonica"] },
  ];
  assert.equal(summaryTrain(rows, trains, ["emtt", "laser", "sonica"]).train?.date, "2026-11-27");
  assert.deepEqual(summaryTrain(rows, {}, ["emtt", "laser", "sonica"]), { train: undefined, pending: true });
  assert.deepEqual(summaryTrain(rows.slice(0, 1), trains, ["emtt", "sonica"]), { train: undefined, pending: false });
});
