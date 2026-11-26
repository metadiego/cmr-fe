import { test } from "node:test";
import assert from "node:assert/strict";

import { holdsTheBooking, sessionCancelled } from "./session-booked.ts";

const AT = "2026-11-26T13:00:00Z";

test("holdsTheBooking: a live session holds its slot; cancelled, not served and done do not", () => {
  assert.equal(holdsTheBooking({ status: "pendiente" }), true);
  assert.equal(holdsTheBooking({ status: "presente", calledAt: AT }), true);
  assert.equal(holdsTheBooking({ status: "en_terapia" }), true);
  assert.equal(holdsTheBooking({ status: "asistido" }), false);
  assert.equal(holdsTheBooking({ status: "cancelada" }), false);
  assert.equal(holdsTheBooking({ status: "cancelada", presentAt: AT }), false);
  assert.equal(holdsTheBooking({ bookingStatus: "arrived", careStatus: "done" }), false);
  // A status the mapping does not know keeps its slot, as the old read kept it.
  assert.equal(holdsTheBooking({ status: "rara" }), true);
});

test("sessionCancelled: cancelled or not served; a called session is not; unknown is not", () => {
  assert.equal(sessionCancelled({ status: "cancelada" }), true);
  assert.equal(sessionCancelled({ status: "cancelada", presentAt: AT }), true);
  assert.equal(sessionCancelled({ bookingStatus: "arrived", careStatus: "not_served" }), true);
  assert.equal(sessionCancelled({ status: "presente", calledAt: AT }), false);
  assert.equal(sessionCancelled({ status: "asistido" }), false);
  assert.equal(sessionCancelled({ status: "rara" }), false);
});
