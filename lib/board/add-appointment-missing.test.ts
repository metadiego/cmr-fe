import { test } from "node:test";
import assert from "node:assert/strict";

import { addAppointmentMissing } from "./add-appointment-missing.ts";

test("addAppointmentMissing: no patient → listed", () => {
  assert.deepEqual(addAppointmentMissing({ hasPatient: false, moving: false, reason: "" }), ["patient"]);
});
test("addAppointmentMissing: moving without a reason → listed", () => {
  assert.deepEqual(addAppointmentMissing({ hasPatient: true, moving: true, reason: "  " }), ["reason"]);
});
test("addAppointmentMissing: reason is not required when not moving", () => {
  assert.deepEqual(addAppointmentMissing({ hasPatient: true, moving: false, reason: "" }), []);
});
test("addAppointmentMissing: all present → []", () => {
  assert.deepEqual(addAppointmentMissing({ hasPatient: true, moving: true, reason: "patient asked" }), []);
});
