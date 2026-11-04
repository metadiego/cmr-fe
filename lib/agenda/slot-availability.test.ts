import { test } from "node:test";
import assert from "node:assert/strict";

import { slotAvailability, type AgendaSlot } from "./slot-availability.ts";

const FU = "follow-up";
const NEW = "new";
const slots: AgendaSlot[] = [
  { time: "08:00", tipos: [{ appointmentTypeId: FU, vacios: 0 }, { appointmentTypeId: NEW, vacios: 2 }] },
  { time: "09:30", tipos: [{ appointmentTypeId: FU, vacios: 0 }] },
  { time: "10:00", tipos: [{ appointmentTypeId: FU, vacios: 3 }] },
  { time: null, tipos: [{ appointmentTypeId: FU, vacios: 9 }] },
];

test("room at the requested time, for that type only", () => {
  assert.deepEqual(slotAvailability(slots, FU, "10:00"), { free: 3, freeDay: 12, next: "10:00" });
  assert.equal(slotAvailability(slots, NEW, "08:00").free, 2);
});

test("full time: offers the next hour with room for the type", () => {
  assert.deepEqual(slotAvailability(slots, FU, "09:30"), { free: 0, freeDay: 12, next: "10:00" });
});

test("seconds in the appointment's time do not hide its slot", () => {
  assert.deepEqual(slotAvailability(slots, FU, "10:00:00"), { free: 3, freeDay: 12, next: "10:00" });
});

test("no time: free is 0 and next is the first hour with room; nothing after → null", () => {
  assert.deepEqual(slotAvailability(slots, FU, null), { free: 0, freeDay: 12, next: "10:00" });
  assert.equal(slotAvailability(slots, FU, "11:00").next, null);
});

test("day total adds every slot's room for the type, untimed slots included", () => {
  assert.equal(slotAvailability(slots, FU, null).freeDay, 12);
  assert.equal(slotAvailability(slots, NEW, null).freeDay, 2);
  assert.equal(slotAvailability(slots, "other", null).freeDay, 0);
});
