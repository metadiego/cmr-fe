import { test } from "node:test";
import assert from "node:assert/strict";

import { nextAppointmentMissing } from "./next-appointment-missing.ts";

test("nextAppointmentMissing: no date → listed", () => {
  assert.deepEqual(nextAppointmentMissing({ typeId: "t1", date: "" }), ["date"]);
});
test("nextAppointmentMissing: no type → listed", () => {
  assert.deepEqual(nextAppointmentMissing({ typeId: "", date: "2026-12-01" }), ["type"]);
});
test("nextAppointmentMissing: nothing → date then type (on-screen order)", () => {
  assert.deepEqual(nextAppointmentMissing({ typeId: "", date: "" }), ["date", "type"]);
});
test("nextAppointmentMissing: all present → []", () => {
  assert.deepEqual(nextAppointmentMissing({ typeId: "t1", date: "2026-12-01" }), []);
});
