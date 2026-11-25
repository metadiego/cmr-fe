import { test } from "node:test";
import assert from "node:assert/strict";

import type { BookableService } from "../../api/frontdesk.ts";
import type { PatientAppointment } from "./patient-appointments.ts";
import { exhaustedOff, leftAfterEachDate, otherOnDay } from "./train-booked.ts";

function bookable(entries: Record<string, number>): Map<string, BookableService> {
  return new Map(
    Object.entries(entries).map(([serviceId, n]) => [serviceId, { serviceId, bought: n, booked: 0, bookable: n, sources: [] }]),
  );
}

function appt(p: Partial<PatientAppointment> & Pick<PatientAppointment, "date" | "typeId">): PatientAppointment {
  return { id: `${p.date}-${p.typeId}-${p.time}`, kind: "service", time: null, status: "pendiente", withLabel: null, isLive: true, ...p };
}

test("leftAfterEachDate counts each therapy down visit by visit, in date order", () => {
  const left = leftAfterEachDate(
    [
      { date: "2026-12-03", serviceIds: ["laser"] },
      { date: "2026-11-26", serviceIds: ["laser", "emtt"] },
    ],
    bookable({ laser: 5, emtt: 5 }),
  );
  assert.deepEqual(left, { "2026-11-26": { laser: 4, emtt: 4 }, "2026-12-03": { laser: 3 } });
});

test("leftAfterEachDate never goes below 0 and is empty without a balance", () => {
  const days = [
    { date: "2026-11-26", serviceIds: ["sonica"] },
    { date: "2026-11-27", serviceIds: ["sonica"] },
  ];
  assert.deepEqual(leftAfterEachDate(days, bookable({ sonica: 1 })), { "2026-11-26": { sonica: 0 }, "2026-11-27": { sonica: 0 } });
  assert.deepEqual(leftAfterEachDate(days, undefined), {});
});

test("otherOnDay lists that day's other live appointments by time, not the visit's own therapies", () => {
  const upcoming = [
    appt({ date: "2026-11-26", typeId: "laser", time: "09:00" }),
    appt({ date: "2026-11-26", typeId: "sonica", time: "11:00" }),
    appt({ date: "2026-11-26", typeId: "consulta", kind: "medical", time: "08:30" }),
    appt({ date: "2026-11-26", typeId: "emtt", time: "12:00", status: "cancelada", isLive: false }),
    appt({ date: "2026-11-27", typeId: "sonica", time: "09:00" }),
  ];
  assert.deepEqual(
    otherOnDay(upcoming, "2026-11-26", ["laser", "emtt"]).map((a) => `${a.time} ${a.typeId}`),
    ["08:30 consulta", "11:00 sonica"],
  );
});

test("otherOnDay keeps a medical appointment whose type id matches a therapy id", () => {
  const upcoming = [appt({ date: "2026-11-26", typeId: "laser", kind: "medical", time: "10:00" })];
  assert.equal(otherOnDay(upcoming, "2026-11-26", ["laser"]).length, 1);
});

test("exhaustedOff leaves a therapy out of the dates after its last session, in date order", () => {
  const days = [
    { date: "2026-12-17", serviceIds: ["laser", "iv", "emtt"] },
    { date: "2026-12-03", serviceIds: ["laser", "iv", "emtt"] },
    { date: "2026-12-10", serviceIds: ["laser", "iv", "emtt"] },
  ];
  assert.deepEqual(exhaustedOff(days, bookable({ laser: 2, iv: 6, emtt: 1 })), {
    "2026-12-10": ["emtt"],
    "2026-12-17": ["laser", "emtt"],
  });
});

test("exhaustedOff never empties a date and drops nothing without a balance", () => {
  const days = [
    { date: "2026-12-03", serviceIds: ["laser"] },
    { date: "2026-12-10", serviceIds: ["laser"] },
  ];
  assert.deepEqual(exhaustedOff(days, bookable({ laser: 1 })), {});
  assert.deepEqual(exhaustedOff(days, undefined), {});
});
