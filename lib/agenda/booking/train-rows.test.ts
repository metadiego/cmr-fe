import { test } from "node:test";
import assert from "node:assert/strict";

import type { PatientTrain, TrainSlot } from "../../api/resources.ts";
import type { BookableService } from "../../api/frontdesk.ts";
import {
  sameDaySessions,
  trainCap,
  trainDaySlots,
  trainOrder,
  trainRequest,
  trainSchedule,
} from "./train-rows.ts";

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

function leg(serviceId: string, start: string, p: { parallel?: boolean; minutes?: number } = {}) {
  return { serviceId, start, slot: start, minutes: p.minutes ?? 10, parallel: p.parallel ?? false, configured: true };
}

test("trainSchedule lists one therapy per row, in train order, with its start, end and minutes", () => {
  const tr = train([
    slot({ time: "09:00", endsAt: "09:40:00", legs: [leg("laser", "09:00:00"), leg("emtt", "09:10", { minutes: 30 })] }),
  ]);
  assert.deepEqual(trainSchedule(tr, "09:00:00"), {
    legs: [
      { serviceId: "laser", start: "09:00", end: "09:10", minutes: 10, parallel: false, together: false },
      { serviceId: "emtt", start: "09:10", end: "09:40", minutes: 30, parallel: false, together: false },
    ],
    endsAt: "09:40",
  });
});

test("trainSchedule marks a blocking therapy that starts with one running alongside as together", () => {
  const tr = train([slot({ time: "14:10", legs: [leg("vitc", "14:10", { minutes: 60 }), leg("iv", "14:10", { minutes: 60, parallel: true })] })]);
  assert.deepEqual(
    trainSchedule(tr, "14:10")?.legs.map((l) => [l.serviceId, l.parallel || l.together]),
    [
      ["vitc", true],
      ["iv", true],
    ],
  );
});

test("trainSchedule marks therapies that start together as together (the IV chair)", () => {
  const tr = train([slot({ time: "09:00", endsAt: "10:00", legs: [leg("vitc", "09:00", { minutes: 60 }), leg("iv", "09:00", { minutes: 60 })] })]);
  assert.deepEqual(
    trainSchedule(tr, "09:00")?.legs.map((l) => [l.serviceId, l.together]),
    [
      ["vitc", true],
      ["iv", true],
    ],
  );
});

test("trainSchedule keeps a therapy that runs alongside apart, marked parallel", () => {
  const tr = train([
    slot({ time: "09:00", endsAt: "09:20", legs: [leg("emtt", "09:00"), leg("tms", "09:00", { parallel: true, minutes: 30 }), leg("laser", "09:10")] }),
  ]);
  assert.deepEqual(
    trainSchedule(tr, "09:00")?.legs.map((l) => [l.serviceId, l.end, l.parallel, l.together]),
    [
      ["emtt", "09:10", false, true],
      ["tms", "09:30", true, false],
      ["laser", "09:20", false, false],
    ],
  );
});

test("trainSchedule is null for an hour the plan does not have or one with no legs", () => {
  const tr = train([slot({ time: "09:00", legs: [] })]);
  assert.equal(trainSchedule(tr, "10:00"), null);
  assert.equal(trainSchedule(tr, "09:00"), null);
  assert.equal(trainSchedule(undefined, "09:00"), null);
});

test("sameDaySessions lists the live sessions of ticked therapies that day, by time", () => {
  const sessions = [
    { serviceId: "emtt", date: "2026-11-24", time: "10:30:00", status: "pendiente" },
    { serviceId: "laser", date: "2026-11-24T00:00:00.000Z", time: "09:00", status: "asistido" },
    { serviceId: "emtt", date: "2026-11-24", time: "08:00", status: "cancelada" },
    { serviceId: "pemf", date: "2026-11-24", time: "08:00", status: "pendiente" },
    { serviceId: "emtt", date: "2026-11-25", time: "08:00", status: "pendiente" },
    { serviceId: "laser", date: "2026-11-24", time: null, status: "pendiente" },
  ];
  assert.deepEqual(sameDaySessions(sessions, "2026-11-24", ["emtt", "laser"]), [
    { serviceId: "laser", time: "09:00", label: "done" },
    { serviceId: "emtt", time: "10:30", label: "upcoming" },
    { serviceId: "laser", time: null, label: "upcoming" },
  ]);
});

test("sameDaySessions reads the stage group: not served is out, a called session is in, stage columns alone count", () => {
  const sessions = [
    { serviceId: "emtt", date: "2026-11-24", time: "08:00", status: "cancelada", presentAt: "2026-11-24T12:00:00Z" },
    { serviceId: "emtt", date: "2026-11-24", time: "09:00", status: "presente", calledAt: "2026-11-24T13:00:00Z" },
    { serviceId: "laser", date: "2026-11-24", time: "10:00", status: "", bookingStatus: "cancelled" as const, careStatus: null },
    { serviceId: "laser", date: "2026-11-24", time: "11:00", status: "rara" },
  ];
  assert.deepEqual(sameDaySessions(sessions, "2026-11-24", ["emtt", "laser"]), [
    // A called session is labelled as waiting; an unknown status has no label (nothing is shown).
    { serviceId: "emtt", time: "09:00", label: "waiting" },
    { serviceId: "laser", time: "11:00", label: null },
  ]);
});
