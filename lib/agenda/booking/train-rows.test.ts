import { test } from "node:test";
import assert from "node:assert/strict";

import type { PatientTrain, TrainSlot } from "../../api/resources.ts";
import type { BookableService } from "../../api/frontdesk.ts";
import { liveSessionDates, trainCap, trainDaySlots, trainEndsAt, trainOrder, trainRequest } from "./train-rows.ts";

function slot(p: Partial<TrainSlot> & { time: string }): TrainSlot {
  return { fits: true, endsAt: "", legs: [], staffBlocks: [], ...p };
}
function train(slots: TrainSlot[], legs: string[] = []): PatientTrain {
  return {
    date: "2026-11-24",
    order: "weight",
    legs: legs.map((serviceId) => ({
      serviceId,
      configured: true,
      minutes: 10,
      areas: 1,
      resourceId: null,
      resourceSlug: null,
      blocking: true,
      trainWeight: 1,
    })),
    unconfiguredServiceIds: [],
    patientMinutes: 10,
    slots,
  };
}
function bookable(entries: Record<string, number>): Map<string, BookableService> {
  return new Map(
    Object.entries(entries).map(([serviceId, n]) => [serviceId, { serviceId, bought: n, booked: 0, bookable: n, sources: [] }]),
  );
}

test("trainDaySlots maps fits to open with one free place", () => {
  const day = trainDaySlots(train([slot({ time: "09:00", fits: true, endsAt: "09:25" })]));
  assert.equal(day.date, "2026-11-24");
  assert.deepEqual(day.slots, [{ time: "09:00", capacity: 1, free: 1, state: "open", reasonKey: null }]);
});

test("trainDaySlots maps a selectable misfit to full", () => {
  const day = trainDaySlots(train([slot({ time: "10:00", fits: false, selectable: true, reasonKey: "therapies.full" })]));
  assert.deepEqual(day.slots, [{ time: "10:00", capacity: 1, free: 0, state: "full", reasonKey: "therapies.full" }]);
});

test("trainDaySlots marks an unselectable misfit unavailable", () => {
  const day = trainDaySlots(
    train([slot({ time: "11:00", fits: false }), slot({ time: "12:00", fits: false, selectable: false })]),
  );
  assert.deepEqual(
    day.slots.map((s) => s.state),
    ["unavailable", "unavailable"],
  );
});

test("trainDaySlots normalizes the time to HH:mm", () => {
  assert.equal(trainDaySlots(train([slot({ time: "9:00:00" })])).slots[0].time, "09:00");
});

test("trainEndsAt returns the slot's end as HH:mm, null for an unknown time or no train", () => {
  const t = train([slot({ time: "09:00", endsAt: "09:25:00" })]);
  assert.equal(trainEndsAt(t, "9:00"), "09:25");
  assert.equal(trainEndsAt(t, "10:00"), null);
  assert.equal(trainEndsAt(null, "09:00"), null);
  assert.equal(trainEndsAt(train([slot({ time: "09:00", endsAt: "" })]), "09:00"), null);
});

test("trainCap takes the smallest balance among the ticked therapies", () => {
  assert.deepEqual(trainCap(bookable({ laser: 3, emtt: 1 }), ["laser", "emtt"]), { max: 1, limitedBy: "emtt", left: 1 });
});

test("trainCap treats a ticked therapy missing from the balance as 0", () => {
  assert.deepEqual(trainCap(bookable({ laser: 3 }), ["laser", "pemf"]), { max: 0, limitedBy: "pemf", left: 0 });
});

test("trainCap never goes past 20 per booking", () => {
  assert.deepEqual(trainCap(bookable({ laser: 35 }), ["laser"]), { max: 20, limitedBy: null, left: 35 });
});

test("trainCap with an unknown balance or nothing ticked applies only the 20", () => {
  assert.deepEqual(trainCap(undefined, ["laser"]), { max: 20, limitedBy: null, left: undefined });
  assert.deepEqual(trainCap(bookable({ laser: 3 }), []), { max: 20, limitedBy: null, left: undefined });
});

test("liveSessionDates keeps live sessions of the ticked therapies only", () => {
  const dates = liveSessionDates(
    [
      { serviceId: "laser", date: "2026-11-26", status: "pendiente" },
      { serviceId: "laser", date: "2026-11-26T00:00:00", status: "asistido" },
      { serviceId: "emtt", date: "2026-11-27", status: "cancelada" },
      { serviceId: "pemf", date: "2026-11-28", status: "pendiente" },
      { serviceId: "emtt", date: "2026-11-25", status: "presente" },
    ],
    ["laser", "emtt"],
  );
  assert.deepEqual(dates, ["2026-11-25", "2026-11-26"]);
});

test("trainOrder follows the BE's legs, else the ticked order", () => {
  assert.deepEqual(trainOrder(train([], ["emtt", "laser"]), ["laser", "emtt"]), ["emtt", "laser"]);
  assert.deepEqual(trainOrder(null, ["laser", "emtt"]), ["laser", "emtt"]);
  assert.deepEqual(trainOrder(train([], []), ["laser"]), ["laser"]);
});

test("trainRequest keeps the ticked order when keepOrder is on", () => {
  const r = trainRequest(["zzz-laser", "aaa-emtt"], {}, true);
  assert.deepEqual(r.serviceIds, ["zzz-laser", "aaa-emtt"]);
  assert.notEqual(r.key, trainRequest(["aaa-emtt", "zzz-laser"], {}, true).key);
});

test("trainRequest ignores tick order when the BE orders by weight", () => {
  assert.equal(trainRequest(["zzz-laser", "aaa-emtt"], {}, false).key, trainRequest(["aaa-emtt", "zzz-laser"], {}, false).key);
});

test("trainRequest sends areas for the ticked therapies only, 1 when untouched", () => {
  assert.deepEqual(trainRequest(["laser", "emtt"], { laser: 3, pemf: 2 }, false).areas, { laser: 3, emtt: 1 });
});
