import { test } from "node:test";
import assert from "node:assert/strict";

import type { PatientTrain, TrainSlot } from "../../api/resources.ts";
import type { DaySlots } from "./availability.ts";
import { closingOf, moveItem, nearestFree, slotWhy, trainTimeOptions } from "./train-why.ts";

function slot(p: Partial<TrainSlot> & { time: string }): TrainSlot {
  return { fits: true, endsAt: "", legs: [], staffBlocks: [], ...p };
}
function train(slots: TrainSlot[]): PatientTrain {
  return { date: "2026-12-10", order: "weight", legs: [], unconfiguredServiceIds: [], patientMinutes: 90, slots };
}
const day: DaySlots = {
  date: "2026-12-10",
  slots: [
    { time: "11:00", capacity: 1, free: 1, state: "open", reasonKey: null },
    { time: "11:30", capacity: 1, free: 0, state: "unavailable", reasonKey: null },
    { time: "12:00", capacity: 1, free: 0, state: "full", reasonKey: null },
    { time: "13:00", capacity: 1, free: 1, state: "open", reasonKey: null },
  ],
};

test("closingOf is the end of the day's last half hour, as the BE derives it", () => {
  assert.equal(closingOf(train([slot({ time: "07:00" }), slot({ time: "07:30" }), slot({ time: "17:00:00" })])), "17:30");
  assert.equal(closingOf(train([])), null);
});

test("slotWhy says a free hour fits and when the patient leaves", () => {
  const tr = train([slot({ time: "11:00", fits: true, endsAt: "12:30:00" })]);
  assert.deepEqual(slotWhy(tr, "11:00:00"), { kind: "free", endsAt: "12:30", serviceId: null, reasons: [], lateBy: null });
});

test("slotWhy names the therapy and every reason of an overbooked hour", () => {
  const tr = train([
    slot({ time: "12:00", fits: false, selectable: true, endsAt: "13:30", serviceId: "laser", reasonKey: "therapies.full", reasonKeys: ["therapies.full", "therapies.noStaff"] }),
  ]);
  assert.deepEqual(slotWhy(tr, "12:00"), {
    kind: "overbook",
    endsAt: "13:30",
    serviceId: "laser",
    reasons: ["therapies.full", "therapies.noStaff"],
    lateBy: null,
  });
});

test("slotWhy says by how many minutes a train ends after closing", () => {
  const tr = train([
    slot({ time: "16:30", fits: false, endsAt: "18:00", reasonKey: "therapies.trainPastClosing" }),
    slot({ time: "17:00", fits: false, endsAt: "18:30", reasonKey: "therapies.trainPastClosing" }),
  ]);
  const why = slotWhy(tr, "16:30");
  assert.equal(why?.kind, "blocked");
  assert.deepEqual(why?.reasons, ["therapies.trainPastClosing"]);
  assert.equal(why?.lateBy, 30);
  assert.equal(slotWhy(tr, "09:00"), null);
});

test("trainTimeOptions keeps hours that cannot be booked, disabled, so their reason can be read", () => {
  assert.deepEqual(trainTimeOptions(day, "12:00"), [
    { time: "11:00", full: false, disabled: false, free: 1 },
    { time: "11:30", full: false, disabled: true, free: 0 },
    { time: "12:00", full: true, disabled: false, free: 0 },
    { time: "13:00", full: false, disabled: false, free: 1 },
  ]);
  assert.deepEqual(trainTimeOptions(null, "09:00"), [{ time: "09:00", full: false, disabled: true, free: 0 }]);
});

test("nearestFree is the first free hour from the row's time on, else the last free one before it", () => {
  assert.equal(nearestFree(day, "12:00"), "13:00");
  assert.equal(nearestFree(day, "13:30"), "13:00");
  assert.equal(nearestFree(null, "12:00"), null);
});

test("moveItem moves one entry to another position", () => {
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.deepEqual(moveItem(["a", "b"], 0, 5), ["a", "b"]);
});
